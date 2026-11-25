import Cesium3dTilesMixin from "../ModelMixins/Cesium3dTilesMixin";
import CompositeCatalogItem from "./Catalog/CatalogItems/CompositeCatalogItem";
import Cesium from "./Cesium";
import Repositionable3DTiles, {
  defaultTransformation,
  previewWholeTransformation,
  restoreTransformation,
  snapshotTransformation,
  TransformationSnapshot
} from "./Repositionable3DTiles";
import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset";
import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import ScreenSpaceEventHandler from "terriajs-cesium/Source/Core/ScreenSpaceEventHandler";
import ScreenSpaceEventType from "terriajs-cesium/Source/Core/ScreenSpaceEventType";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import createRepositionableBoxDrawing from "./createRepositionableBoxDrawing";
import ViewerMode from "./ViewerMode";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "./RepositionableLayer";

type RepositionableItem = Cesium3dTilesMixin.Instance;

export interface RepositionableCompositeSnapshot {
  item: RepositionableItem;
  snapshot: TransformationSnapshot;
}

export function getCompositeTransformation(
  transform: Matrix4
): TransformationSnapshot | undefined {
  const position = Matrix4.getTranslation(transform, new Cartesian3());
  const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position);
  if (!cartographic) return;
  const rotation = Transforms.fixedFrameToHeadingPitchRoll(transform);
  return {
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    height: cartographic.height,
    heading: CesiumMath.toDegrees(rotation.heading),
    pitch: CesiumMath.toDegrees(rotation.pitch),
    roll: CesiumMath.toDegrees(rotation.roll)
  };
}

export function createCompositeTransform(
  currentTransform: Matrix4,
  transformation: TransformationSnapshot
): Matrix4 {
  const position = Cartesian3.fromDegrees(
    transformation.longitude ?? 0,
    transformation.latitude ?? 0,
    transformation.height ?? 0
  );
  const transform = Transforms.headingPitchRollToFixedFrame(
    position,
    HeadingPitchRoll.fromDegrees(
      transformation.heading ?? 0,
      transformation.pitch ?? 0,
      transformation.roll ?? 0
    )
  );
  return Matrix4.setScale(
    transform,
    Matrix4.getScale(currentTransform, new Cartesian3()),
    transform
  );
}

export default class RepositionableComposite {
  private readonly initialSnapshots: RepositionableCompositeSnapshot[];
  private readonly defaultSnapshots: RepositionableCompositeSnapshot[];
  private activePieceController?: Repositionable3DTiles;
  private selectedPiece?: RepositionableItem;
  private selectionHandler?: ScreenSpaceEventHandler;
  private readonly previousFeaturePickingPaused: boolean;
  private readonly wholeController?: RepositionableLayer<
    RepositionableCompositeSnapshot[],
    CompositeCatalogItem
  >;

  private constructor(
    readonly item: CompositeCatalogItem,
    private readonly cesium: Cesium,
    private readonly memberItems: RepositionableItem[],
    private readonly mode: "whole" | "pieces",
    wholeController?: RepositionableLayer<
      RepositionableCompositeSnapshot[],
      CompositeCatalogItem
    >,
    private readonly onPieceSelected?: (
      item: RepositionableItem | undefined
    ) => void,
    private readonly onWholeTransformationChange?: () => void,
    initialSnapshots?: RepositionableCompositeSnapshot[]
  ) {
    this.wholeController = wholeController;
    this.previousFeaturePickingPaused = cesium.isFeaturePickingPaused;
    this.initialSnapshots =
      initialSnapshots ??
      memberItems.map((member) => ({
        item: member,
        snapshot: snapshotTransformation(member)
      }));
    this.defaultSnapshots = memberItems.map((member) => ({
      item: member,
      snapshot: defaultTransformation(member)
    }));
    if (mode === "pieces") {
      this.beginPieceSelection();
    }
  }

  get selectedPieceItem(): RepositionableItem | undefined {
    return this.selectedPiece;
  }

  static create(
    item: CompositeCatalogItem,
    cesium: Cesium,
    mode: "whole" | "pieces" = "whole",
    callbacks?: {
      onPieceSelected?: (item: RepositionableItem | undefined) => void;
      onWholeTransformationChange?: () => void;
      initialSnapshots?: RepositionableCompositeSnapshot[];
    }
  ): RepositionableComposite | undefined {
    if (item.isLoadingMapItems) return;

    const memberItems = item.memberModels.filter(
      Cesium3dTilesMixin.isMixedInto
    );
    if (memberItems.length === 0) return;

    if (mode === "pieces") {
      return new RepositionableComposite(
        item,
        cesium,
        memberItems,
        mode,
        undefined,
        callbacks?.onPieceSelected,
        callbacks?.onWholeTransformationChange,
        callbacks?.initialSnapshots
      );
    }

    const tilesets: Cesium3DTileset[] = [];
    memberItems.forEach((member) => {
      member.mapItems.forEach((mapItem) => {
        if (mapItem instanceof Cesium3DTileset && !mapItem.isDestroyed()) {
          tilesets.push(mapItem);
        }
      });
    });
    if (tilesets.length === 0) return;

    const aggregateCenter = BoundingSphere.fromBoundingSpheres(
      tilesets.map((tileset) => tileset.boundingSphere)
    ).center;
    const aggregateRadius = Math.max(
      ...tilesets.map(
        (tileset) =>
          Cartesian3.distance(aggregateCenter, tileset.boundingSphere.center) +
          tileset.boundingSphere.radius
      ),
      1
    );
    const is2D =
      cesium.terria.mainViewer.viewerMode === ViewerMode.Cesium2D ||
      item.repositionMode === "2d";
    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      aggregateCenter,
      Quaternion.IDENTITY,
      new Cartesian3(aggregateRadius, aggregateRadius, aggregateRadius)
    );
    const boxDrawing = createRepositionableBoxDrawing(
      cesium,
      editorTransform,
      is2D
    );
    boxDrawing.enableRotation = true;

    const initialItemMatrices = new Map(
      memberItems.map(
        (member) => [member, Matrix4.clone(member.modelMatrix)] as const
      )
    );
    const adapter: RepositionableLayerAdapter<
      RepositionableCompositeSnapshot[],
      CompositeCatalogItem
    > = {
      item,
      snapshot: () =>
        memberItems.map((member) => ({
          item: member,
          snapshot: snapshotTransformation(member)
        })),
      defaultSnapshot: () =>
        memberItems.map((member) => ({
          item: member,
          snapshot: defaultTransformation(member)
        })),
      preview: (modelMatrix) => {
        memberItems.forEach((member) => {
          const initialItemMatrix = initialItemMatrices.get(member);
          if (initialItemMatrix) {
            previewWholeTransformation(
              member,
              modelMatrix,
              aggregateCenter,
              initialItemMatrix,
              is2D
            );
          }
        });
        callbacks?.onWholeTransformationChange?.();
      },
      restore: (snapshots) => {
        snapshots.forEach(({ item: member, snapshot }) =>
          restoreTransformation(member, snapshot)
        );
      }
    };
    const wholeController = new RepositionableLayer(
      adapter,
      cesium,
      boxDrawing
    );
    return new RepositionableComposite(
      item,
      cesium,
      memberItems,
      mode,
      wholeController,
      callbacks?.onPieceSelected,
      callbacks?.onWholeTransformationChange,
      callbacks?.initialSnapshots
    );
  }

  getInitialSnapshots(): RepositionableCompositeSnapshot[] {
    return this.initialSnapshots;
  }

  getWholeTransformation(): TransformationSnapshot | undefined {
    if (!this.wholeController) return;
    return getCompositeTransformation(
      this.wholeController.boxDrawing.getTransform()
    );
  }

  setWholeTransformation(transformation: TransformationSnapshot) {
    if (!this.wholeController) return;
    this.wholeController.boxDrawing.setTransformAndNotify(
      createCompositeTransform(
        this.wholeController.boxDrawing.getTransform(),
        transformation
      )
    );
  }

  changeSelectedPiece() {
    if (this.mode !== "pieces") return;
    this.activePieceController?.save();
    this.activePieceController = undefined;
    this.beginPieceSelection();
  }

  refreshSelectedPiece(): boolean {
    if (this.mode !== "pieces" || !this.selectedPiece) return false;
    this.activePieceController?.save();
    const controller = Repositionable3DTiles.create(
      this.selectedPiece,
      this.cesium
    );
    if (!controller) return false;
    this.activePieceController = controller;
    return true;
  }

  save() {
    if (this.wholeController) {
      this.wholeController.save();
    } else {
      this.activePieceController?.save();
      this.finishPieceSelection();
    }
  }

  cancel() {
    if (this.wholeController) {
      this.wholeController.cancel();
    } else {
      this.activePieceController?.save();
      this.restoreSnapshots(this.initialSnapshots);
      this.finishPieceSelection();
    }
  }

  reset() {
    if (this.wholeController) {
      this.wholeController.reset();
    } else {
      this.activePieceController?.save();
      this.restoreSnapshots(this.defaultSnapshots);
      this.finishPieceSelection();
    }
  }

  async clampToGround(): Promise<boolean> {
    if (this.wholeController) {
      return this.wholeController.clampToGround();
    }
    return this.activePieceController?.clampToGround() ?? false;
  }

  private beginPieceSelection() {
    this.selectionHandler?.destroy();
    this.onPieceSelected?.(undefined);
    this.selectedPiece = undefined;
    this.cesium.isFeaturePickingPaused = true;
    const handler = new ScreenSpaceEventHandler(this.cesium.scene.canvas);
    this.selectionHandler = handler;
    handler.setInputAction(
      ({ position }: ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = this.cesium.scene.pick(position) as
          | {
              primitive?: unknown;
              content?: { tileset?: unknown };
              tileset?: unknown;
            }
          | undefined;
        const pickedTileset =
          picked?.primitive instanceof Cesium3DTileset
            ? picked.primitive
            : picked?.content?.tileset instanceof Cesium3DTileset
              ? picked.content.tileset
              : picked?.tileset instanceof Cesium3DTileset
                ? picked.tileset
                : undefined;
        if (!pickedTileset) return;
        const member = this.memberItems.find((candidate) =>
          candidate.mapItems.some(
            (mapItem) =>
              mapItem instanceof Cesium3DTileset && mapItem === pickedTileset
          )
        );
        if (!member) return;
        const controller = Repositionable3DTiles.create(member, this.cesium);
        if (!controller) return;
        this.selectionHandler?.destroy();
        this.selectionHandler = undefined;
        this.selectedPiece = member;
        this.activePieceController = controller;
        this.onPieceSelected?.(member);
      },
      ScreenSpaceEventType.LEFT_CLICK
    );
  }

  private finishPieceSelection() {
    this.selectionHandler?.destroy();
    this.selectionHandler = undefined;
    this.selectedPiece = undefined;
    this.onPieceSelected?.(undefined);
    this.cesium.isFeaturePickingPaused = this.previousFeaturePickingPaused;
  }

  private restoreSnapshots(snapshots: RepositionableCompositeSnapshot[]) {
    snapshots.forEach(({ item, snapshot }) =>
      restoreTransformation(item, snapshot)
    );
  }
}
