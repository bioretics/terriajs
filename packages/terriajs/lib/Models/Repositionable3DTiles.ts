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
import RepositionableBoxDrawing from "./RepositionableBoxDrawing";
import createRepositionableBoxDrawing from "./createRepositionableBoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import ViewerMode from "./ViewerMode";
import RepositionableLayer, {
  RepositionableLayerAdapter,
  getDefaultTrait
} from "./RepositionableLayer";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";

type RepositionableItem = Cesium3dTilesMixin.Instance;

export interface TransformationSnapshot {
  latitude?: number;
  longitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  scale?: number;
}

export function snapshotTransformation(
  item: RepositionableItem
): TransformationSnapshot {
  return {
    latitude: item.origin.latitude,
    longitude: item.origin.longitude,
    height: item.origin.height,
    heading: item.rotation.heading,
    pitch: item.rotation.pitch,
    roll: item.rotation.roll,
    scale: item.scale
  };
}

/**
 * Catalog baseline matrix: tileset root transform + definition-stratum traits only.
 * Mirrors {@link Cesium3dTilesMixin} model-matrix composition without user overrides.
 */
function catalogModelMatrixForItem(item: RepositionableItem): Matrix4 {
  const rootTransform = Matrix4.clone(
    (item as unknown as { originalRootTransform: Matrix4 })
      .originalRootTransform
  );
  let scale = Matrix4.getScale(rootTransform, new Cartesian3());
  const position = Matrix4.getTranslation(rootTransform, new Cartesian3());
  let orientation = Quaternion.fromRotationMatrix(
    Matrix4.getRotation(rootTransform, new Matrix3())
  );

  const origin = getDefaultTrait<LatLonHeightTraits>(item, "origin");
  if (origin?.latitude !== undefined && origin?.longitude !== undefined) {
    const positionFromLatLng = Cartesian3.fromDegrees(
      origin.longitude,
      origin.latitude,
      origin.height
    );
    position.x = positionFromLatLng.x;
    position.y = positionFromLatLng.y;
    if (origin.height !== undefined) {
      position.z = positionFromLatLng.z;
    }
  }

  const rotation = getDefaultTrait<HeadingPitchRollTraits>(item, "rotation");
  if (
    rotation?.heading !== undefined &&
    rotation?.pitch !== undefined &&
    rotation?.roll !== undefined
  ) {
    const hpr = HeadingPitchRoll.fromDegrees(
      rotation.heading,
      rotation.pitch,
      rotation.roll
    );
    orientation = Transforms.headingPitchRollQuaternion(position, hpr);
  }

  const scaleTrait = getDefaultTrait<number>(item, "scale");
  if (scaleTrait !== undefined) {
    scale = new Cartesian3(scaleTrait, scaleTrait, scaleTrait);
  }

  return Matrix4.fromTranslationQuaternionRotationScale(
    position,
    orientation,
    scale
  );
}

function transformationSnapshotFromModelMatrix(
  transform: Matrix4
): TransformationSnapshot | undefined {
  const position = Matrix4.getTranslation(transform, new Cartesian3());
  const cartographic = Ellipsoid.WGS84.cartesianToCartographic(position);
  if (!cartographic) return;
  const rotation = Transforms.fixedFrameToHeadingPitchRoll(transform);
  const matrixScale = Matrix4.getScale(transform, new Cartesian3()).x;
  return {
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    height: cartographic.height,
    heading: CesiumMath.toDegrees(rotation.heading),
    pitch: CesiumMath.toDegrees(rotation.pitch),
    roll: CesiumMath.toDegrees(rotation.roll),
    scale: Number.isFinite(matrixScale) ? matrixScale : undefined
  };
}

export function defaultTransformation(
  item: RepositionableItem
): TransformationSnapshot {
  return (
    transformationSnapshotFromModelMatrix(catalogModelMatrixForItem(item)) ?? {}
  );
}

export function restoreTransformation(
  item: RepositionableItem,
  snapshot: TransformationSnapshot
) {
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
  item.setTrait(CommonStrata.user, "scale", snapshot.scale);
}

export function previewWholeTransformation(
  item: RepositionableItem,
  modelMatrix: Matrix4,
  initialAggregateCenter: Cartesian3,
  initialItemMatrix: Matrix4,
  is2D: boolean
) {
  const aggregatePosition = Matrix4.getTranslation(
    modelMatrix,
    new Cartesian3()
  );
  const aggregateMove = Cartesian3.subtract(
    aggregatePosition,
    initialAggregateCenter,
    new Cartesian3()
  );
  const aggregateWorldRotation = Quaternion.fromRotationMatrix(
    Matrix4.getRotation(modelMatrix, new Matrix3()),
    new Quaternion()
  );

  const is2DRotationChanged =
    is2D &&
    !Quaternion.equalsEpsilon(
      aggregateWorldRotation,
      Quaternion.IDENTITY,
      0.000001
    );
  let transformedItemMatrix: Matrix4;
  if (!is2D || is2DRotationChanged) {
    const centerOrigin = Matrix4.fromTranslation(
      Cartesian3.negate(initialAggregateCenter, new Cartesian3())
    );
    const centerRotation = Matrix4.fromTranslationQuaternionRotationScale(
      initialAggregateCenter,
      aggregateWorldRotation,
      new Cartesian3(1, 1, 1)
    );
    const moveTranslation = Matrix4.fromTranslation(aggregateMove);
    const pivoted = Matrix4.multiply(
      centerRotation,
      Matrix4.multiply(centerOrigin, initialItemMatrix, new Matrix4()),
      new Matrix4()
    );
    transformedItemMatrix = Matrix4.multiply(
      moveTranslation,
      pivoted,
      new Matrix4()
    );
  } else {
    transformedItemMatrix = Matrix4.multiply(
      Matrix4.fromTranslation(aggregateMove),
      initialItemMatrix,
      new Matrix4()
    );
  }

  const transformedPosition = Matrix4.getTranslation(
    transformedItemMatrix,
    new Cartesian3()
  );
  LatLonHeightTraits.setFromCartesian(
    item.origin,
    CommonStrata.user,
    transformedPosition
  );

  if (is2D) {
    if (is2DRotationChanged) {
      const hpr = Transforms.fixedFrameToHeadingPitchRoll(
        transformedItemMatrix
      );
      HeadingPitchRollTraits.setFromHeadingPitchRoll(
        item.rotation,
        CommonStrata.user,
        new HeadingPitchRoll(hpr.heading, 0, 0)
      );
    }
  } else {
    const hpr = Transforms.fixedFrameToHeadingPitchRoll(transformedItemMatrix);
    HeadingPitchRollTraits.setFromHeadingPitchRoll(
      item.rotation,
      CommonStrata.user,
      hpr
    );
  }
}

function previewModelMatrix(
  item: RepositionableItem,
  modelMatrix: Matrix4,
  initialEditorCenter: Cartesian3,
  initialItemPosition: Cartesian3,
  initialItemMatrix: Matrix4,
  initialWorldRotation: Quaternion,
  is2D: boolean
) {
  const editorPosition = Matrix4.getTranslation(modelMatrix, new Cartesian3());
  const editorMove = Cartesian3.subtract(
    editorPosition,
    initialEditorCenter,
    new Cartesian3()
  );
  const worldRotation = Quaternion.fromRotationMatrix(
    Matrix4.getRotation(modelMatrix, new Matrix3()),
    new Quaternion()
  );

  let transformedItemMatrix: Matrix4;
  if (!is2D) {
    const inverseInitialRotation = Quaternion.inverse(
      initialWorldRotation,
      new Quaternion()
    );
    const relativeRotation = Quaternion.multiply(
      worldRotation,
      inverseInitialRotation,
      new Quaternion()
    );
    const centerOrigin = Matrix4.fromTranslation(
      Cartesian3.negate(initialEditorCenter, new Cartesian3())
    );
    const centerRotation = Matrix4.fromTranslationQuaternionRotationScale(
      initialEditorCenter,
      relativeRotation,
      new Cartesian3(1, 1, 1)
    );
    const moveTranslation = Matrix4.fromTranslation(editorMove);
    const pivoted = Matrix4.multiply(
      centerRotation,
      Matrix4.multiply(centerOrigin, initialItemMatrix, new Matrix4()),
      new Matrix4()
    );
    transformedItemMatrix = Matrix4.multiply(
      moveTranslation,
      pivoted,
      new Matrix4()
    );
  } else {
    const position = Cartesian3.add(
      initialItemPosition,
      editorMove,
      new Cartesian3()
    );
    transformedItemMatrix = Matrix4.multiply(
      Matrix4.fromTranslation(
        Cartesian3.subtract(position, initialItemPosition, new Cartesian3())
      ),
      initialItemMatrix,
      new Matrix4()
    );
  }

  const transformedPosition = Matrix4.getTranslation(
    transformedItemMatrix,
    new Cartesian3()
  );
  LatLonHeightTraits.setFromCartesian(
    item.origin,
    CommonStrata.user,
    transformedPosition
  );

  if (
    !Quaternion.equalsEpsilon(worldRotation, initialWorldRotation, 0.000001)
  ) {
    const hpr = Transforms.fixedFrameToHeadingPitchRoll(
      is2D ? modelMatrix : transformedItemMatrix
    );
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
    const initialItemMatrix = Matrix4.clone(item.modelMatrix);
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

    const boxDrawing = createRepositionableBoxDrawing(
      cesium,
      editorTransform,
      is2D
    );
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
      defaultSnapshot: () => defaultTransformation(item),
      originPosition: () =>
        Matrix4.getTranslation(item.modelMatrix, new Cartesian3()),
      preview: (modelMatrix) => {
        previewModelMatrix(
          item,
          modelMatrix,
          initialEditorCenter,
          initialItemPosition,
          initialItemMatrix,
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
          item as unknown as {
            repositionBoxDrawing?: RepositionableBoxDrawing;
          }
        ).repositionBoxDrawing = boxDrawing;
      },
      deactivate: () => {
        (
          item as unknown as {
            repositionBoxDrawing?: RepositionableBoxDrawing;
          }
        ).repositionBoxDrawing = undefined;
      }
    };
    super(adapter, cesium, boxDrawing);
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
