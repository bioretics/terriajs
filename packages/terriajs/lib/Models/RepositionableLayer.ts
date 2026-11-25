import { action } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import RepositionableBoxDrawing from "./RepositionableBoxDrawing";
import Cesium from "./Cesium";
import { BaseModel } from "./Definition/Model";

export interface RepositionableLayerAdapter<
  TSnapshot,
  TItem extends BaseModel = BaseModel
> {
  readonly item: TItem;
  snapshot(): TSnapshot;
  defaultSnapshot(): TSnapshot;
  preview(modelMatrix: Matrix4): void;
  restore(snapshot: TSnapshot): void;
  originPosition?(): Cartesian3 | undefined;
  activate?(boxDrawing: RepositionableBoxDrawing): void;
  deactivate?(): void;
}

export function getDefaultTrait<T>(
  item: BaseModel,
  trait: string
): T | undefined {
  for (const [stratumId, stratum] of item.strataTopToBottom) {
    if (
      stratumId !== "user" &&
      stratumId !== "edit" &&
      stratum[trait as keyof typeof stratum] !== undefined
    ) {
      return stratum[trait as keyof typeof stratum] as T;
    }
  }
  return undefined;
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
  private originalOriginPosition?: Cartesian3;
  private readonly previousFeaturePickingPaused: boolean;
  private finished = false;
  private disposed = false;
  private dataSourceAdded = false;

  constructor(
    readonly adapter: RepositionableLayerAdapter<TSnapshot, TItem>,
    readonly cesium: Cesium,
    readonly boxDrawing: RepositionableBoxDrawing
  ) {
    this.snapshot = adapter.snapshot();
    this.originalOriginPosition = adapter.originPosition?.();
    this.previousFeaturePickingPaused = cesium.isFeaturePickingPaused;
    cesium.isFeaturePickingPaused = true;

    this.boxDrawing.onChange = action(({ modelMatrix }) => {
      adapter.preview(modelMatrix);
      this.boxDrawing.setOriginMarkerPosition(adapter.originPosition?.());
    });
    this.boxDrawing.setOriginMarkerPosition(adapter.originPosition?.());
    this.boxDrawing.setOriginalOriginMarkerPosition(
      this.originalOriginPosition
    );
    adapter.activate?.(this.boxDrawing);
    const itemMapItems = (
      this.adapter.item as unknown as { mapItems?: unknown[] }
    ).mapItems;
    if (
      !itemMapItems?.some((mapItem) => mapItem === this.boxDrawing.dataSource)
    ) {
      this.dataSourceAdded = true;
      void this.cesium.dataSources.add(this.boxDrawing.dataSource).then(() => {
        if (!this.disposed) {
          this.boxDrawing.dataSource.show = true;
        }
      });
    } else {
      this.boxDrawing.dataSource.show = true;
    }
  }

  get item(): TItem {
    return this.adapter.item;
  }

  getOriginalOriginPosition(): Cartesian3 | undefined {
    return this.originalOriginPosition
      ? Cartesian3.clone(this.originalOriginPosition)
      : undefined;
  }

  setOriginalOriginPosition(position?: Cartesian3) {
    this.originalOriginPosition = position
      ? Cartesian3.clone(position)
      : undefined;
    this.boxDrawing.setOriginalOriginMarkerPosition(
      this.originalOriginPosition
    );
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

  reset() {
    if (this.finished) return;
    this.finished = true;
    this.adapter.restore(this.adapter.defaultSnapshot());
    this.dispose();
  }

  restoreToDefault() {
    if (this.finished) return;
    this.adapter.restore(this.adapter.defaultSnapshot());
  }

  async clampToGround(): Promise<boolean> {
    if (this.finished) return false;
    return this.boxDrawing.clampToGroundOnce();
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
    if (this.dataSourceAdded) {
      void this.cesium.dataSources.remove(this.boxDrawing.dataSource);
    }
    this.cesium.isFeaturePickingPaused = this.previousFeaturePickingPaused;
  }
}
