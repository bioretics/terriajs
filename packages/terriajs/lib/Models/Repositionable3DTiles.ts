import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Matrix3 from "terriajs-cesium/Source/Core/Matrix3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset";
import Cesium3dTilesMixin from "../ModelMixins/Cesium3dTilesMixin";
import HeadingPitchRollTraits from "../Traits/TraitsClasses/HeadingPitchRollTraits";
import LatLonHeightTraits from "../Traits/TraitsClasses/LatLonHeightTraits";
import BoxDrawing from "./BoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import ViewerMode from "./ViewerMode";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "./RepositionableLayer";

type RepositionableItem = Cesium3dTilesMixin.Instance;

interface TransformationSnapshot {
  latitude?: number;
  longitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  scale?: number;
}

function previewModelMatrix(
  item: RepositionableItem,
  modelMatrix: Matrix4,
  initialEditorCenter: Cartesian3,
  initialItemPosition: Cartesian3,
  initialWorldRotation: Quaternion,
  is2D: boolean
) {
  const editorPosition = Matrix4.getTranslation(modelMatrix, new Cartesian3());
  const editorMove = Cartesian3.subtract(
    editorPosition,
    initialEditorCenter,
    new Cartesian3()
  );
  const position = Cartesian3.add(
    initialItemPosition,
    editorMove,
    new Cartesian3()
  );
  LatLonHeightTraits.setFromCartesian(item.origin, CommonStrata.user, position);

  const worldRotation = Quaternion.fromRotationMatrix(
    Matrix4.getRotation(modelMatrix, new Matrix3()),
    new Quaternion()
  );
  if (
    !Quaternion.equalsEpsilon(worldRotation, initialWorldRotation, 0.000001)
  ) {
    const hpr = Transforms.fixedFrameToHeadingPitchRoll(modelMatrix);
    if (is2D) {
      HeadingPitchRollTraits.setFromHeadingPitchRoll(
        item.rotation,
        CommonStrata.user,
        new HeadingPitchRoll(hpr.heading, 0, 0)
      );
    } else {
      HeadingPitchRollTraits.setFromHeadingPitchRoll(
        item.rotation,
        CommonStrata.user,
        hpr
      );
    }
  }
}

export default class Repositionable3DTiles extends RepositionableLayer<
  TransformationSnapshot,
  RepositionableItem
> {
  private constructor(
    item: RepositionableItem,
    cesium: Cesium,
    tileset: Cesium3DTileset
  ) {
    const is2D =
      cesium.terria.mainViewer.viewerMode === ViewerMode.Cesium2D ||
      item.repositionMode === "2d";
    const center = tileset.boundingSphere.center;
    const radius = tileset.boundingSphere.radius;
    const initialEditorCenter = Cartesian3.clone(center);
    const initialItemPosition = Matrix4.getTranslation(
      item.modelMatrix,
      new Cartesian3()
    );
    const savedHpr = HeadingPitchRoll.fromDegrees(
      item.rotation.heading ?? 0,
      item.rotation.pitch ?? 0,
      item.rotation.roll ?? 0
    );
    const itemRotation = Transforms.headingPitchRollQuaternion(
      center,
      savedHpr
    );
    const initialWorldRotation = Quaternion.clone(itemRotation);
    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      center,
      itemRotation,
      new Cartesian3(radius, radius, radius)
    );

    const boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: false,
      disableVerticalMovement: is2D,
      allowedTranslationAxes: is2D ? ["x", "y"] : ["x", "y", "z"],
      allowedRotationAxes: is2D ? ["map-normal"] : undefined,
      drawNonUniformScaleGrips: false
    });
    const adapter: RepositionableLayerAdapter<
      TransformationSnapshot,
      RepositionableItem
    > = {
      item,
      snapshot: () => ({
        latitude: item.origin.latitude,
        longitude: item.origin.longitude,
        height: item.origin.height,
        heading: item.rotation.heading,
        pitch: item.rotation.pitch,
        roll: item.rotation.roll,
        scale: item.scale
      }),
      preview: (modelMatrix) => {
        previewModelMatrix(
          item,
          modelMatrix,
          initialEditorCenter,
          initialItemPosition,
          initialWorldRotation,
          is2D
        );
      },
      restore: (snapshot) => {
        updateModelFromJson(item.origin, CommonStrata.user, {
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          height: snapshot.height
        }).logError("Failed to restore 3D Tiles origin");
        updateModelFromJson(item.rotation, CommonStrata.user, {
          heading: snapshot.heading,
          pitch: snapshot.pitch,
          roll: snapshot.roll
        }).logError("Failed to restore 3D Tiles rotation");
        if (snapshot.scale !== undefined) {
          item.setTrait(CommonStrata.user, "scale", snapshot.scale);
        } else {
          item.setTrait(CommonStrata.user, "scale", undefined);
        }
      },
      activate: (boxDrawing) => {
        (
          item as unknown as { repositionBoxDrawing?: BoxDrawing }
        ).repositionBoxDrawing = boxDrawing;
      },
      deactivate: () => {
        (
          item as unknown as { repositionBoxDrawing?: BoxDrawing }
        ).repositionBoxDrawing = undefined;
      }
    };
    super(adapter, cesium, boxDrawing);
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = true;
  }

  static create(
    item: RepositionableItem,
    cesium: Cesium
  ): Repositionable3DTiles | undefined {
    if (item.isLoadingMapItems) return;

    const mapItem = item.mapItems.find(
      (candidate) => candidate instanceof Cesium3DTileset
    );
    if (!(mapItem instanceof Cesium3DTileset) || mapItem.isDestroyed()) {
      return;
    }
    const tileset = mapItem;

    const controller = new Repositionable3DTiles(item, cesium, tileset);
    return controller;
  }
}
