import Matrix3 from "terriajs-cesium/Source/Core/Matrix3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import I3SDataProvider from "terriajs-cesium/Source/Scene/I3SDataProvider";
import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset";
import I3SCatalogItem from "./Catalog/CatalogItems/I3SCatalogItem";
import HeadingPitchRollTraits from "../Traits/TraitsClasses/HeadingPitchRollTraits";
import LatLonHeightTraits from "../Traits/TraitsClasses/LatLonHeightTraits";
import BoxDrawing from "./BoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import ViewerMode from "./ViewerMode";
import RepositionableLayer, {
  RepositionableLayerAdapter,
  getDefaultTrait
} from "./RepositionableLayer";

interface TransformationSnapshot {
  latitude?: number;
  longitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  scale?: number;
}

export default class RepositionableI3S extends RepositionableLayer<
  TransformationSnapshot,
  I3SCatalogItem
> {
  private constructor(
    item: I3SCatalogItem,
    cesium: Cesium,
    tilesets: Cesium3DTileset[],
    center: Cartesian3
  ) {
    const is2D =
      cesium.terria.mainViewer.viewerMode === ViewerMode.Cesium2D ||
      item.repositionMode === "2d";
    const initialEditorCenter = Cartesian3.clone(center);
    const initialItemPosition = Cartesian3.clone(center);
    const initialMatrices = tilesets.map((tileset) =>
      Matrix4.clone(tileset.modelMatrix)
    );

    const savedHpr = HeadingPitchRoll.fromDegrees(
      item.rotation.heading ?? 0,
      item.rotation.pitch ?? 0,
      item.rotation.roll ?? 0
    );
    const initialWorldRotation = Transforms.headingPitchRollQuaternion(
      center,
      savedHpr
    );
    const radius = Math.max(item.boundingSphere?.radius ?? 1, 1);
    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      center,
      initialWorldRotation,
      new Cartesian3(radius, radius, radius)
    );
    const boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: false,
      disableVerticalMovement: is2D,
      allowedTranslationAxes: is2D ? ["x", "y"] : ["x", "y", "z"],
      allowedRotationAxes: is2D ? ["map-normal"] : undefined,
      drawNonUniformScaleGrips: false
    });

    const preview = (modelMatrix: Matrix4) => {
      const editorPosition = Matrix4.getTranslation(
        modelMatrix,
        new Cartesian3()
      );
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
      LatLonHeightTraits.setFromCartesian(
        item.origin,
        CommonStrata.user,
        position
      );

      const worldRotation = Quaternion.fromRotationMatrix(
        Matrix4.getRotation(modelMatrix, new Matrix3()),
        new Quaternion()
      );
      const inverseInitial = Quaternion.inverse(
        initialWorldRotation,
        new Quaternion()
      );
      const relativeRotation = Quaternion.multiply(
        worldRotation,
        inverseInitial,
        new Quaternion()
      );

      tilesets.forEach((tileset, index) => {
        const initialMatrix = initialMatrices[index];
        const translation = Matrix4.getTranslation(
          initialMatrix,
          new Cartesian3()
        );
        const scale = Matrix4.getScale(initialMatrix, new Cartesian3());
        const initialRotation = Quaternion.fromRotationMatrix(
          Matrix4.getRotation(initialMatrix, new Matrix3()),
          new Quaternion()
        );
        const newRotation = Quaternion.multiply(
          relativeRotation,
          initialRotation,
          new Quaternion()
        );
        const newTranslation = Cartesian3.add(
          translation,
          editorMove,
          new Cartesian3()
        );
        tileset.modelMatrix = Matrix4.fromTranslationQuaternionRotationScale(
          newTranslation,
          newRotation,
          scale
        );
      });

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
    };

    const adapter: RepositionableLayerAdapter<
      TransformationSnapshot,
      I3SCatalogItem
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
      defaultSnapshot: () => {
        const origin = getDefaultTrait<LatLonHeightTraits>(item, "origin");
        const rotation = getDefaultTrait<HeadingPitchRollTraits>(
          item,
          "rotation"
        );
        return {
          latitude: origin?.latitude,
          longitude: origin?.longitude,
          height: origin?.height,
          heading: rotation?.heading,
          pitch: rotation?.pitch,
          roll: rotation?.roll,
          scale: getDefaultTrait<number>(item, "scale")
        };
      },
      preview,
      restore: (snapshot) => {
        updateModelFromJson(item.origin, CommonStrata.user, {
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          height: snapshot.height
        }).logError("Failed to restore I3S origin");
        updateModelFromJson(item.rotation, CommonStrata.user, {
          heading: snapshot.heading,
          pitch: snapshot.pitch,
          roll: snapshot.roll
        }).logError("Failed to restore I3S rotation");
        if (snapshot.scale !== undefined) {
          item.setTrait(CommonStrata.user, "scale", snapshot.scale);
        } else {
          item.setTrait(CommonStrata.user, "scale", undefined);
        }
        tilesets.forEach((tileset, index) => {
          tileset.modelMatrix = initialMatrices[index];
        });
      }
    };

    super(adapter, cesium, boxDrawing);
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = true;
  }

  static create(
    item: I3SCatalogItem,
    cesium: Cesium
  ): RepositionableI3S | undefined {
    if (item.isLoadingMapItems || item.boundingSphere === undefined) return;

    const provider = item.mapItems.find(
      (mapItem) => mapItem instanceof I3SDataProvider
    );
    if (!(provider instanceof I3SDataProvider) || provider.isDestroyed()) {
      return;
    }

    const tilesets = provider.layers
      .map((layer) => layer.tileset)
      .filter((tileset): tileset is Cesium3DTileset => tileset !== undefined);
    if (tilesets.length === 0) return;

    return new RepositionableI3S(
      item,
      cesium,
      tilesets,
      item.boundingSphere.center
    );
  }
}
