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
  gridWidth: number;
  cellSize: number;
  heights: Float32Array;
  groundHeightAtObserver: number;
}

export interface SampleGridOptions {
  cellSize?: number;
  maxCellsPerSide?: number;
}

const DEFAULT_MAX_CELLS_PER_SIDE = 300;

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
  numRays?: number;
}

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
      if (Number.isNaN(h)) continue;

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
