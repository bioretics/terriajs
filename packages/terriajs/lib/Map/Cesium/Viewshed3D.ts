import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import SingleTileImageryProvider from "terriajs-cesium/Source/Scene/SingleTileImageryProvider";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";
import { ImageryParts } from "../../ModelMixins/MappableMixin";
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
  /** Height of the observer above the ground, in metres. Defaults to 0. */
  observerHeight?: number;
  visibleColor?: Color;
  alpha?: number;
  onStatusChange?: (status: ViewshedStatus) => void;
  /**
   * Called whenever the draped imagery should change. The owner must put the
   * parts (when defined) into its `mapItems` so Cesium's imagery sync owns the
   * layer — do not add it to `scene.imageryLayers` directly.
   */
  onImageryPartsChanged?: (parts: ImageryParts | undefined) => void;
}

export interface Viewshed3DUpdateOptions extends Partial<
  Omit<Viewshed3DOptions, "terrainProvider" | "onImageryPartsChanged">
> {}

export const DEFAULT_VIEWSHED_ALPHA = 0.45;

/** Debounce interval (ms) for update() calls during point dragging. */
const UPDATE_DEBOUNCE_MS = 200;

type NormalisedOptions = Required<
  Omit<Viewshed3DOptions, "onStatusChange" | "onImageryPartsChanged">
> & {
  onStatusChange?: Viewshed3DOptions["onStatusChange"];
  onImageryPartsChanged?: Viewshed3DOptions["onImageryPartsChanged"];
};

/**
 * Render-independent terrain viewshed for one observer.
 *
 * Computes visibility and reports {@link ImageryParts} via
 * {@link Viewshed3DOptions.onImageryPartsChanged} for inclusion in `mapItems`.
 */
export default class Viewshed3D {
  private options: NormalisedOptions;
  private readonly onImageryPartsChanged?: (
    parts: ImageryParts | undefined
  ) => void;

  private readonly scene: Scene;
  private destroyed = false;
  private computeGeneration = 0;
  private debounceTimer?: ReturnType<typeof setTimeout>;

  constructor(scene: Scene, options: Viewshed3DOptions) {
    this.scene = scene;
    this.onImageryPartsChanged = options.onImageryPartsChanged;
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

    this.onImageryPartsChanged?.(undefined);
    this.scene.requestRender();
  }

  isDestroyed() {
    return this.destroyed;
  }

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
        // Alpha is baked into the canvas; ImageryParts.alpha stays 1.
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

            this.onImageryPartsChanged?.(
              new ImageryParts({
                imageryProvider,
                alpha: 1,
                clippingRectangle: rectangle,
                show: true
              })
            );
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
      onImageryPartsChanged: options.onImageryPartsChanged
    };
  }
}
