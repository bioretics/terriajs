import { action } from "mobx";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import BoxDrawing from "./BoxDrawing";
import Cesium from "./Cesium";
import { BaseModel } from "./Definition/Model";

export interface RepositionableLayerAdapter<
  TSnapshot,
  TItem extends BaseModel = BaseModel
> {
  readonly item: TItem;
  snapshot(): TSnapshot;
  preview(modelMatrix: Matrix4): void;
  restore(snapshot: TSnapshot): void;
  activate?(boxDrawing: BoxDrawing): void;
  deactivate?(): void;
}

/**
 * Shared lifecycle for temporary repositioning tools.
 *
 * Provider-specific snapshot and preview behavior belongs in an adapter.
 * This class owns the editor lifecycle, feature-picking pause and cleanup.
 */
export default class RepositionableLayer<
  TSnapshot,
  TItem extends BaseModel = BaseModel
> {
  readonly snapshot: TSnapshot;
  private readonly previousFeaturePickingPaused: boolean;
  private finished = false;
  private disposed = false;

  constructor(
    readonly adapter: RepositionableLayerAdapter<TSnapshot, TItem>,
    readonly cesium: Cesium,
    readonly boxDrawing: BoxDrawing
  ) {
    this.snapshot = adapter.snapshot();
    this.previousFeaturePickingPaused = cesium.isFeaturePickingPaused;
    cesium.isFeaturePickingPaused = true;

    this.boxDrawing.onChange = action(({ modelMatrix }) => {
      adapter.preview(modelMatrix);
    });
    this.boxDrawing.dataSource.show = true;
    adapter.activate?.(this.boxDrawing);
  }

  get item(): TItem {
    return this.adapter.item;
  }

  save() {
    if (this.finished) return;
    this.finished = true;
    this.dispose();
  }

  cancel() {
    if (this.finished) return;
    this.finished = true;
    this.adapter.restore(this.snapshot);
    this.dispose();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this.boxDrawing.enableScaling = false;
    this.boxDrawing.enableRotation = false;
    (
      this.boxDrawing as unknown as { stopInteractions(): void }
    ).stopInteractions();
    this.boxDrawing.dataSource.show = false;
    this.adapter.deactivate?.();
    void this.cesium.dataSources.remove(this.boxDrawing.dataSource);
    this.cesium.isFeaturePickingPaused = this.previousFeaturePickingPaused;
  }
}
