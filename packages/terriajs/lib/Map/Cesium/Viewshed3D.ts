import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import ImageryLayer from "terriajs-cesium/Source/Scene/ImageryLayer";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import SingleTileImageryProvider from "terriajs-cesium/Source/Scene/SingleTileImageryProvider";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";
import {
  sampleTerrainVisibilityGrid,
  computeViewshed,
  rasterizeVisibilityToCanvas,
  computeGridRectangle,
  TerrainVisibilityGrid
} from "./TerrainViewshed";

/**
 * Viewshed analysis status reported via the {@link Viewshed3DOptions.onStatusChange} callback.
 *
 * - `"computing"` — terrain is being sampled and line-of-sight computed
 * - `"ready"` — the viewshed overlay has been applied to the scene
 * - `"unavailable"` — terrain provider does not support viewshed analysis
 */
export type ViewshedStatus = "computing" | "ready" | "unavailable";

/**
 * Parameters for an omnidirectional terrain viewshed. Distances are in metres.
 * The analysis covers a sphere of radius `maximumDistance` around the observer;
 * only terrain that is line-of-sight visible is tinted.
 */
export interface Viewshed3DOptions {
  terrainProvider: TerrainProvider;
  observerPosition: Cartesian3;
  maximumDistance: number;
  visibleColor?: Color;
  alpha?: number;
  onStatusChange?: (status: ViewshedStatus) => void;
}

export interface Viewshed3DUpdateOptions extends Partial<
  Omit<Viewshed3DOptions, "terrainProvider">
> {}

export const DEFAULT_VIEWSHED_ALPHA = 0.45;

/** Debounce interval (ms) for update() calls during point dragging. */
const UPDATE_DEBOUNCE_MS = 200;

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
  private options: Required<Omit<Viewshed3DOptions, "onStatusChange">> & {
    onStatusChange?: Viewshed3DOptions["onStatusChange"];
  };

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
    const { terrainProvider, observerPosition, maximumDistance, alpha } =
      this.options;
    const visibleColor = this.options.visibleColor;

    this.options.onStatusChange?.("computing");

    sampleTerrainVisibilityGrid(
      terrainProvider,
      observerPosition,
      maximumDistance
    )
      .then((grid: TerrainVisibilityGrid) => {
        if (this.destroyed || generation !== this.computeGeneration) return;

        const eyeHeight = Number.isNaN(grid.groundHeightAtObserver)
          ? Cartesian3.magnitude(observerPosition) - 6371000 // rough fallback
          : grid.groundHeightAtObserver;

        const visibility = computeViewshed(grid, eyeHeight);
        const canvas = rasterizeVisibilityToCanvas(grid, visibility, [
          Math.round(visibleColor.red * 255),
          Math.round(visibleColor.green * 255),
          Math.round(visibleColor.blue * 255),
          Math.round(alpha * 255)
        ]);

        const rectangle = computeGridRectangle(observerPosition, grid);
        const dataUrl = canvas.toDataURL("image/png");

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

  private removeImageryLayer() {
    if (this.imageryLayer) {
      this.scene.imageryLayers.remove(this.imageryLayer, true);
      this.imageryLayer = undefined;
    }
  }

  private static normaliseOptions(options: Viewshed3DOptions): Required<
    Omit<Viewshed3DOptions, "onStatusChange">
  > & {
    onStatusChange?: Viewshed3DOptions["onStatusChange"];
  } {
    const alpha = options.alpha ?? DEFAULT_VIEWSHED_ALPHA;
    return {
      terrainProvider: options.terrainProvider,
      observerPosition: options.observerPosition,
      maximumDistance: options.maximumDistance,
      alpha,
      visibleColor: (options.visibleColor ?? Color.LIME).withAlpha(alpha),
      onStatusChange: options.onStatusChange
    };
  }
}
