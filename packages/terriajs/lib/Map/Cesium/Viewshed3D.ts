import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import ImageryLayer from "terriajs-cesium/Source/Scene/ImageryLayer";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import SingleTileImageryProvider from "terriajs-cesium/Source/Scene/SingleTileImageryProvider";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import {
  sampleTerrainVisibilityGrid,
  computeViewshed,
  rasterizeVisibilityToCanvas,
  computeGridRectangle,
  TerrainVisibilityGrid,
  VISIBILITY_VISIBLE
} from "./TerrainViewshed";

/**
 * Viewshed analysis status reported via the {@link Viewshed3DOptions.onStatusChange} callback.
 *
 * - `"computing"` — terrain is being sampled and line-of-sight computed
 * - `"ready"` — the viewshed overlay has been applied to the scene
 * - `"unavailable"` — terrain provider does not support viewshed analysis
 */
export type ViewshedStatus = "computing" | "ready" | "unavailable";

/** Information about where visibility ends along the observer→target ray. */
export interface VisibilityLineInfo {
  /** Distance from observer to the first hidden cell along the ray, or undefined if the entire ray is visible. */
  visibleDistance: number | undefined;
  /** Total distance from observer to target. */
  totalDistance: number;
  /** World-space Cartesian3 position of the visibility boundary, or undefined if the entire ray is visible. */
  boundaryPosition: Cartesian3 | undefined;
}

/**
 * Parameters for an omnidirectional terrain viewshed. Distances are in metres.
 * The analysis covers a sphere of radius `maximumDistance` around the observer;
 * only terrain that is line-of-sight visible is tinted.
 */
export interface Viewshed3DOptions {
  terrainProvider: TerrainProvider;
  observerPosition: Cartesian3;
  maximumDistance: number;
  /** Height of the observer above the ground, in metres. Defaults to 0. */
  observerHeight?: number;
  visibleColor?: Color;
  alpha?: number;
  onStatusChange?: (status: ViewshedStatus) => void;
  /** The second (target) point, used to compute the visibility line. */
  targetPosition?: Cartesian3;
  /** Called after each compute with info about where visibility ends along the observer→target ray. */
  onVisibilityLineComputed?: (info: VisibilityLineInfo) => void;
}

export interface Viewshed3DUpdateOptions extends Partial<
  Omit<Viewshed3DOptions, "terrainProvider">
> {}

export const DEFAULT_VIEWSHED_ALPHA = 0.45;

/** Debounce interval (ms) for update() calls during point dragging. */
const UPDATE_DEBOUNCE_MS = 200;

type NormalisedOptions = Required<
  Omit<
    Viewshed3DOptions,
    "onStatusChange" | "targetPosition" | "onVisibilityLineComputed"
  >
> & {
  onStatusChange?: Viewshed3DOptions["onStatusChange"];
  targetPosition?: Viewshed3DOptions["targetPosition"];
  onVisibilityLineComputed?: Viewshed3DOptions["onVisibilityLineComputed"];
};

/**
 * Render-independent terrain viewshed for one observer.
 *
 * Uses {@link sampleTerrainVisibilityGrid} to sample terrain heights at
 * maximum detail directly from the TerrainProvider (independent of the Globe's
 * current LOD), computes line-of-sight with a CPU ray sweep, and drapes the
 * result as a {@link SingleTileImageryProvider} layer. The overlay is stable
 * across all camera movements.
 *
 * Callers create it after choosing observer and range points, call
 * {@link update} while editing, and always {@link destroy} it.
 */
export default class Viewshed3D {
  private options: NormalisedOptions;

  private readonly scene: Scene;
  private imageryLayer?: ImageryLayer;
  private destroyed = false;
  private computeGeneration = 0;
  private debounceTimer?: ReturnType<typeof setTimeout>;

  constructor(scene: Scene, options: Viewshed3DOptions) {
    this.scene = scene;
    this.options = Viewshed3D.normaliseOptions(options);

    if (!this.options.terrainProvider.availability) {
      this.options.onStatusChange?.("unavailable");
      return;
    }

    this.scheduleCompute();
  }

  update(updateOpts: Viewshed3DUpdateOptions) {
    if (this.destroyed) return;
    this.options = Viewshed3D.normaliseOptions({
      ...this.options,
      ...updateOpts
    });

    if (!this.options.terrainProvider.availability) {
      this.options.onStatusChange?.("unavailable");
      return;
    }

    this.scheduleCompute();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.computeGeneration++;

    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.removeImageryLayer();
    this.scene.requestRender();
  }

  isDestroyed() {
    return this.destroyed;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private scheduleCompute() {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.runCompute();
    }, UPDATE_DEBOUNCE_MS);
  }

  private runCompute() {
    if (this.destroyed) return;

    const generation = ++this.computeGeneration;
    const {
      terrainProvider,
      observerPosition,
      maximumDistance,
      alpha,
      observerHeight
    } = this.options;
    const visibleColor = this.options.visibleColor;

    this.options.onStatusChange?.("computing");

    sampleTerrainVisibilityGrid(
      terrainProvider,
      observerPosition,
      maximumDistance
    )
      .then((grid: TerrainVisibilityGrid) => {
        if (this.destroyed || generation !== this.computeGeneration) return;

        const groundHeight = Number.isNaN(grid.groundHeightAtObserver)
          ? Cartesian3.magnitude(observerPosition) - 6371000 // rough fallback
          : grid.groundHeightAtObserver;
        const eyeHeight = groundHeight + observerHeight;

        const visibility = computeViewshed(grid, eyeHeight);
        const canvas = rasterizeVisibilityToCanvas(grid, visibility, [
          Math.round(visibleColor.red * 255),
          Math.round(visibleColor.green * 255),
          Math.round(visibleColor.blue * 255),
          Math.round(alpha * 255)
        ]);

        const rectangle = computeGridRectangle(observerPosition, grid);
        const dataUrl = canvas.toDataURL("image/png");

        // Compute the visibility line info if a target position is given
        if (
          this.options.targetPosition &&
          this.options.onVisibilityLineComputed
        ) {
          const lineInfo = Viewshed3D.computeVisibilityLine(
            observerPosition,
            this.options.targetPosition,
            grid,
            visibility
          );
          this.options.onVisibilityLineComputed(lineInfo);
        }

        return SingleTileImageryProvider.fromUrl(dataUrl, { rectangle }).then(
          (imageryProvider) => {
            if (this.destroyed || generation !== this.computeGeneration) return;

            this.removeImageryLayer();

            this.imageryLayer = new ImageryLayer(imageryProvider, {
              rectangle
            });
            this.scene.imageryLayers.add(this.imageryLayer);
            this.scene.requestRender();

            this.options.onStatusChange?.("ready");
          }
        );
      })
      .catch((error: unknown) => {
        if (this.destroyed || generation !== this.computeGeneration) return;
        console.warn("Viewshed3D computation failed:", error);
        this.options.onStatusChange?.("unavailable");
      });
  }

  /**
   * Walk the visibility grid along the observer→target direction and find
   * where visibility ends (first transition from VISIBLE to non-VISIBLE).
   */
  private static computeVisibilityLine(
    observerPosition: Cartesian3,
    targetPosition: Cartesian3,
    grid: TerrainVisibilityGrid,
    visibility: Uint8Array
  ): VisibilityLineInfo {
    const totalDistance = Cartesian3.distance(observerPosition, targetPosition);
    const { gridWidth, cellSize } = grid;
    const half = (gridWidth - 1) / 2;

    // Build the ENU frame centred on the observer (same as used for the grid)
    const enuFrame = Transforms.eastNorthUpToFixedFrame(observerPosition);
    const enuInverse = Matrix4.inverse(enuFrame, new Matrix4());

    // Project target into ENU to get the ray direction
    const targetENU = Matrix4.multiplyByPoint(
      enuInverse,
      targetPosition,
      new Cartesian3()
    );
    const dirLen = Math.sqrt(
      targetENU.x * targetENU.x + targetENU.y * targetENU.y
    );
    if (dirLen < 1e-6) {
      return {
        visibleDistance: undefined,
        totalDistance,
        boundaryPosition: undefined
      };
    }
    const dirE = targetENU.x / dirLen;
    const dirN = targetENU.y / dirLen;

    const maxRadius = half * cellSize;
    const walkDistance = Math.min(dirLen, maxRadius);

    let lastVisibleDistance = 0;
    let foundHidden = false;

    for (let r = cellSize; r <= walkDistance; r += cellSize) {
      const i = Math.round((dirE * r) / cellSize + half);
      const j = Math.round((dirN * r) / cellSize + half);
      if (i < 0 || i >= gridWidth || j < 0 || j >= gridWidth) break;

      const index = j * gridWidth + i;
      if (visibility[index] === VISIBILITY_VISIBLE) {
        lastVisibleDistance = r;
      } else {
        // First non-visible cell: this is where visibility ends
        foundHidden = true;
        break;
      }
    }

    if (!foundHidden) {
      return {
        visibleDistance: undefined,
        totalDistance,
        boundaryPosition: undefined
      };
    }

    // Convert the boundary distance back to a world position
    const boundaryENU = new Cartesian3(
      dirE * lastVisibleDistance,
      dirN * lastVisibleDistance,
      0
    );
    const boundaryPosition = Matrix4.multiplyByPoint(
      enuFrame,
      boundaryENU,
      new Cartesian3()
    );

    return {
      visibleDistance: lastVisibleDistance,
      totalDistance,
      boundaryPosition
    };
  }

  private removeImageryLayer() {
    if (this.imageryLayer) {
      this.scene.imageryLayers.remove(this.imageryLayer, true);
      this.imageryLayer = undefined;
    }
  }

  private static normaliseOptions(
    options: Viewshed3DOptions
  ): NormalisedOptions {
    const alpha = options.alpha ?? DEFAULT_VIEWSHED_ALPHA;
    return {
      terrainProvider: options.terrainProvider,
      observerPosition: options.observerPosition,
      maximumDistance: options.maximumDistance,
      observerHeight: options.observerHeight ?? 0,
      alpha,
      visibleColor: (options.visibleColor ?? Color.LIME).withAlpha(alpha),
      onStatusChange: options.onStatusChange,
      targetPosition: options.targetPosition,
      onVisibilityLineComputed: options.onVisibilityLineComputed
    };
  }
}
