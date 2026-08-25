/**
 * Render-independent terrain visibility ("viewshed") analysis.
 *
 * Why this file exists
 * ---------------------
 * Viewshed3D.ts computes visibility by rendering an omnidirectional shadow
 * map from the observer, reusing whatever Globe surface commands the MAIN
 * camera already assembled for the current frame. Cesium's terrain quadtree
 * only ever streams tiles for the screen-space error of the CURRENT camera
 * pose, so the depth captured into that shadow map - and therefore the
 * visible/occluded classification - depends on zoom and viewing angle, even
 * though the real terrain hasn't changed.
 *
 * This module sidesteps the renderer entirely: it asks the TerrainProvider
 * directly (sampleTerrainMostDetailed) for heights over a fixed analysis
 * grid, independent of the camera or of what the Globe currently has loaded.
 * The result only changes when the observer or range changes, never when
 * the user looks around.
 *
 * The grid lives in a local East-North-Up (ENU) tangent plane centred on the
 * observer, so cells are evenly spaced in metres (a raw lon/lat grid would
 * be squashed east-west away from the equator). This is a standard planar
 * approximation - accurate to a few centimetres within a few hundred metres
 * of the observer and to within a few metres out to 5-10km. It does NOT
 * correct for Earth curvature / atmospheric refraction over long ranges. If
 * maximumDistance can be multi-kilometre, add a correction of roughly
 * d^2 / (2R) * (1 - k) to target heights, R = 6371000, k = 0.13.
 */

import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";

/** Sentinel written into TerrainVisibilityGrid.heights for cells outside the analysis radius or with no terrain data. */
export const NO_DATA = Number.NaN;

/** Visibility codes written by computeViewshed. Plain numeric constants (not `enum`) so this stays safe under isolatedModules/Babel transpilation. */
export const VISIBILITY_NO_DATA = 255;
export const VISIBILITY_HIDDEN = 0;
export const VISIBILITY_VISIBLE = 1;

export interface TerrainVisibilityGrid {
  /** Cells per side. Always odd, so a single centre cell sits exactly on the observer. */
  gridWidth: number;
  /** Metres between adjacent sample points. */
  cellSize: number;
  /** gridWidth*gridWidth, row-major (index = j*gridWidth+i, i=east, j=north), ellipsoid height in metres. NaN = outside radius / no data. */
  heights: Float32Array;
  /** Ellipsoid height (metres) of the ground directly under the observer, from the same sampling pass. */
  groundHeightAtObserver: number;
}

export interface SampleGridOptions {
  /** Metres between samples. Default: derived automatically from maximumDistance and maxCellsPerSide. */
  cellSize?: number;
  /** Upper bound on cells per side, used to auto-derive cellSize when cellSize is not given. Default 300 (~70k cells inside the circle). */
  maxCellsPerSide?: number;
}

const DEFAULT_MAX_CELLS_PER_SIDE = 300;

/**
 * Builds the analysis grid and fetches heights straight from the terrain
 * provider at its most detailed available level - independent of anything
 * currently rendered by the Scene/Globe, so independent of camera zoom and
 * angle. Re-run this when the observer position or maximumDistance changes;
 * there is no need to re-run it when the camera merely moves.
 */
export async function sampleTerrainVisibilityGrid(
  terrainProvider: TerrainProvider,
  observerPosition: Cartesian3,
  maximumDistance: number,
  options: SampleGridOptions = {}
): Promise<TerrainVisibilityGrid> {
  if (!terrainProvider.availability) {
    throw new Error(
      "sampleTerrainVisibilityGrid needs a terrain provider that exposes tile availability (e.g. a quantized-mesh / Cesium Ion terrain provider)."
    );
  }

  const maxCellsPerSide = options.maxCellsPerSide ?? DEFAULT_MAX_CELLS_PER_SIDE;
  const cellSize =
    options.cellSize ?? Math.max(1, (2 * maximumDistance) / maxCellsPerSide);

  let gridWidth = Math.ceil((2 * maximumDistance) / cellSize) + 1;
  if (gridWidth % 2 === 0) gridWidth += 1; // keep an exact centre cell
  const half = (gridWidth - 1) / 2;

  const enuFrame = Transforms.eastNorthUpToFixedFrame(observerPosition);

  // Row-major (east, north) offsets in metres, masked to the analysis circle.
  // cellIndexForPosition[k] says which heights[] slot cartographicPositions[k] fills in once sampled.
  const cartographicPositions: Cartographic[] = [];
  const cellIndexForPosition: number[] = [];

  for (let j = 0; j < gridWidth; j++) {
    const north = (j - half) * cellSize;
    for (let i = 0; i < gridWidth; i++) {
      const east = (i - half) * cellSize;
      if (east * east + north * north > maximumDistance * maximumDistance) {
        continue; // outside the circle: leave as NO_DATA, don't spend a terrain request on it
      }
      const local = new Cartesian3(east, north, 0);
      const world = Matrix4.multiplyByPoint(enuFrame, local, new Cartesian3());
      cartographicPositions.push(Cartographic.fromCartesian(world));
      cellIndexForPosition.push(j * gridWidth + i);
    }
  }

  const sampled = await sampleTerrainMostDetailed(
    terrainProvider,
    cartographicPositions
  );

  const heights = new Float32Array(gridWidth * gridWidth).fill(NO_DATA);
  for (let k = 0; k < sampled.length; k++) {
    const h = sampled[k].height;
    if (h !== undefined) {
      heights[cellIndexForPosition[k]] = h;
    }
  }

  const centreIndex = half * gridWidth + half;
  const groundHeightAtObserver = heights[centreIndex];

  return { gridWidth, cellSize, heights, groundHeightAtObserver };
}

export interface ComputeViewshedOptions {
  /** Rays cast around the observer. Default: enough that adjacent rays stay within one cell of each other at the grid's outer edge. */
  numRays?: number;
}

/**
 * Pure line-of-sight sweep over a TerrainVisibilityGrid. Deliberately free of
 * any Cesium/DOM/WebGL dependency so it can be copied into a Web Worker (see
 * the accompanying note on wiring one up) - this is the CPU-heavy part, and
 * running it off the main thread keeps drag/edit interactions responsive.
 *
 * Algorithm: a rotational sweep (the standard grid-viewshed technique, aka
 * R2/R3). For each ray radiating from the observer, walk outward in
 * cellSize steps, tracking the steepest elevation angle seen so far; a cell
 * is visible iff its own elevation angle is not lower than every
 * obstruction already passed on that ray. Cost is roughly
 * numRays * (maximumDistance / cellSize) steps - for a 300-cell-wide grid
 * that's on the order of 10^6 simple arithmetic steps, comfortably
 * sub-second in a worker. Testing every cell against every other cell
 * directly would cost roughly N^2 and is not used here.
 */
export function computeViewshed(
  grid: Pick<TerrainVisibilityGrid, "gridWidth" | "cellSize" | "heights">,
  eyeHeight: number,
  options: ComputeViewshedOptions = {}
): Uint8Array {
  const { gridWidth, cellSize, heights } = grid;
  const half = (gridWidth - 1) / 2;
  const maxRadius = half * cellSize;

  const numRays =
    options.numRays ??
    Math.max(360, Math.ceil((2 * Math.PI * maxRadius) / cellSize));

  const result = new Uint8Array(gridWidth * gridWidth).fill(VISIBILITY_NO_DATA);

  // The observer's own cell is visible by definition.
  const centreIndex = half * gridWidth + half;
  if (!Number.isNaN(heights[centreIndex])) {
    result[centreIndex] = VISIBILITY_VISIBLE;
  }

  for (let ray = 0; ray < numRays; ray++) {
    const theta = (ray / numRays) * 2 * Math.PI;
    const dirE = Math.sin(theta);
    const dirN = Math.cos(theta);

    let maxAngleSoFar = -Infinity;

    for (let r = cellSize; r <= maxRadius; r += cellSize) {
      const i = Math.round((dirE * r) / cellSize + half);
      const j = Math.round((dirN * r) / cellSize + half);
      if (i < 0 || i >= gridWidth || j < 0 || j >= gridWidth) break;

      const index = j * gridWidth + i;
      const h = heights[index];
      if (Number.isNaN(h)) continue; // no data here - a gap must not fake an obstruction

      const elevationAngle = Math.atan2(h - eyeHeight, r);
      if (elevationAngle >= maxAngleSoFar) {
        result[index] = VISIBILITY_VISIBLE;
        maxAngleSoFar = elevationAngle;
      } else if (result[index] !== VISIBILITY_VISIBLE) {
        result[index] = VISIBILITY_HIDDEN;
      }
    }
  }

  return result;
}

/**
 * Rasterises a visibility result to an off-screen canvas, ready to hand to a
 * Cesium imagery provider (e.g. SingleTileImageryProvider via
 * canvas.toDataURL()) so it drapes over whatever terrain LOD the Scene
 * currently happens to be showing. Imagery layers are textures projected
 * onto the Globe surface - Cesium already re-drapes them correctly on every
 * LOD change, which is what lets a STABLE, pre-computed analysis look
 * correct under a CHANGING render mesh without the two ever needing to
 * share a single mesh.
 */
export function rasterizeVisibilityToCanvas(
  grid: Pick<TerrainVisibilityGrid, "gridWidth">,
  visibility: Uint8Array,
  visibleColor: [number, number, number, number] = [0, 255, 0, 140]
): HTMLCanvasElement {
  const { gridWidth } = grid;
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridWidth;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const image = ctx.createImageData(gridWidth, gridWidth);
  for (let j = 0; j < gridWidth; j++) {
    for (let i = 0; i < gridWidth; i++) {
      if (visibility[j * gridWidth + i] !== VISIBILITY_VISIBLE) continue;
      // Canvas row 0 is the image's north edge; flip so it matches computeGridRectangle (south->north).
      const dstRow = gridWidth - 1 - j;
      const dstIndex = (dstRow * gridWidth + i) * 4;
      image.data[dstIndex] = visibleColor[0];
      image.data[dstIndex + 1] = visibleColor[1];
      image.data[dstIndex + 2] = visibleColor[2];
      image.data[dstIndex + 3] = visibleColor[3];
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Geographic rectangle covering the grid, for use as an imagery layer's `rectangle` option. */
export function computeGridRectangle(
  observerPosition: Cartesian3,
  grid: Pick<TerrainVisibilityGrid, "gridWidth" | "cellSize">
): Rectangle {
  const half = (grid.gridWidth - 1) / 2;
  const maxRadius = half * grid.cellSize;
  const enuFrame = Transforms.eastNorthUpToFixedFrame(observerPosition);
  const corners = [
    [-maxRadius, -maxRadius],
    [maxRadius, -maxRadius],
    [maxRadius, maxRadius],
    [-maxRadius, maxRadius]
  ].map(([east, north]) => {
    const world = Matrix4.multiplyByPoint(
      enuFrame,
      new Cartesian3(east, north, 0),
      new Cartesian3()
    );
    return Cartographic.fromCartesian(world);
  });
  return Rectangle.fromCartographicArray(corners);
}
