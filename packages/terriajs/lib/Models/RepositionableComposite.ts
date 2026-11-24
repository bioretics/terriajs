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
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import BoxDrawing from "./BoxDrawing";
import ViewerMode from "./ViewerMode";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "./RepositionableLayer";

type RepositionableItem = Cesium3dTilesMixin.Instance;

interface CompositeSnapshot {
  item: RepositionableItem;
  snapshot: TransformationSnapshot;
}

export default class RepositionableComposite {
  private readonly controllers: Repositionable3DTiles[] = [];
  private readonly wholeController?: RepositionableLayer<
    CompositeSnapshot[],
    CompositeCatalogItem
  >;

  private constructor(
    readonly item: CompositeCatalogItem,
    controllers: Repositionable3DTiles[] = [],
    wholeController?: RepositionableLayer<
      CompositeSnapshot[],
      CompositeCatalogItem
    >
  ) {
    this.controllers = [...controllers];
    this.wholeController = wholeController;
  }

  static create(
    item: CompositeCatalogItem,
    cesium: Cesium,
    mode: "whole" | "pieces" = "whole"
  ): RepositionableComposite | undefined {
    if (item.isLoadingMapItems) return;

    const memberItems = item.memberModels.filter(
      Cesium3dTilesMixin.isMixedInto
    );
    if (memberItems.length === 0) return;

    if (mode === "pieces") {
      const controllers = memberItems
        .map((member) => Repositionable3DTiles.create(member, cesium))
        .filter(
          (controller): controller is Repositionable3DTiles =>
            controller !== undefined
        );

      if (controllers.length === 0) return;
      return new RepositionableComposite(item, controllers);
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
    const boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: false,
      disableVerticalMovement: is2D,
      allowedTranslationAxes: is2D ? ["x", "y"] : ["x", "y", "z"],
      allowedRotationAxes: is2D ? ["map-normal"] : undefined,
      drawNonUniformScaleGrips: false
    });
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = true;

    const initialItemMatrices = new Map(
      memberItems.map(
        (member) => [member, Matrix4.clone(member.modelMatrix)] as const
      )
    );
    const adapter: RepositionableLayerAdapter<
      CompositeSnapshot[],
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
    return new RepositionableComposite(item, [], wholeController);
  }

  save() {
    if (this.wholeController) {
      this.wholeController.save();
    } else {
      this.controllers.forEach((controller) => controller.save());
    }
  }

  cancel() {
    if (this.wholeController) {
      this.wholeController.cancel();
    } else {
      this.controllers.forEach((controller) => controller.cancel());
    }
  }

  reset() {
    if (this.wholeController) {
      this.wholeController.reset();
    } else {
      this.controllers.forEach((controller) => controller.reset());
    }
  }

  async clampToGround(): Promise<boolean> {
    if (this.wholeController) {
      return this.wholeController.clampToGround();
    }
    const results = await Promise.all(
      this.controllers.map((controller) => controller.clampToGround())
    );
    return results.some((success) => success);
  }
}
