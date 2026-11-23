import Matrix3 from "terriajs-cesium/Source/Core/Matrix3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import GltfMixin from "../ModelMixins/GltfMixin";
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

type RepositionableItem = GltfMixin.Instance;

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

export default class RepositionableGltf extends RepositionableLayer<
  TransformationSnapshot,
  RepositionableItem
> {
  private constructor(item: RepositionableItem, cesium: Cesium) {
    const is2D =
      cesium.terria.mainViewer.viewerMode === ViewerMode.Cesium2D ||
      item.repositionMode === "2d";
    const center = item.cesiumPosition;
    const initialEditorCenter = Cartesian3.clone(center);
    const initialItemPosition = Cartesian3.clone(center);

    const { heading = 0, pitch = 0, roll = 0 } = item.rotation;
    const hpr = HeadingPitchRoll.fromDegrees(heading, pitch, roll);
    const itemRotation = Transforms.headingPitchRollQuaternion(center, hpr);
    const initialWorldRotation = Quaternion.clone(item.cesiumRotation);
    const boundingSphere = item.getRepositioningBoundingSphere(cesium);
    const radius = Math.max(boundingSphere.radius, 1);

    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      boundingSphere.center,
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
        }).logError("Failed to restore glTF origin");
        updateModelFromJson(item.rotation, CommonStrata.user, {
          heading: snapshot.heading,
          pitch: snapshot.pitch,
          roll: snapshot.roll
        }).logError("Failed to restore glTF rotation");
        if (snapshot.scale !== undefined) {
          item.setTrait(CommonStrata.user, "scale", snapshot.scale);
        } else {
          item.setTrait(CommonStrata.user, "scale", undefined);
        }
      }
    };

    super(adapter, cesium, boxDrawing);
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = true;
  }

  static create(
    item: RepositionableItem,
    cesium: Cesium
  ): RepositionableGltf | undefined {
    if (item.isLoadingMapItems) return;

    const { latitude, longitude, height } = item.origin;
    if (
      latitude === undefined ||
      longitude === undefined ||
      height === undefined
    ) {
      return;
    }

    const hasMapItem = item.mapItems.some(
      (mapItem) => mapItem.entities.values.length > 0
    );
    if (!hasMapItem) return;

    return new RepositionableGltf(item, cesium);
  }
}
