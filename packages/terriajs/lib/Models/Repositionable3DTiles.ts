import { action } from "mobx";
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

export default class Repositionable3DTiles {
  readonly boxDrawing: BoxDrawing;
  private readonly snapshot: TransformationSnapshot;
  private readonly previousFeaturePickingPaused: boolean;
  private finished = false;
  private readonly initialWorldRotation: Quaternion;
  private readonly initialEditorCenter: Cartesian3;
  private readonly initialItemPosition: Cartesian3;

  private constructor(
    readonly item: RepositionableItem,
    readonly cesium: Cesium,
    readonly tileset: Cesium3DTileset
  ) {
    this.snapshot = {
      latitude: item.origin.latitude,
      longitude: item.origin.longitude,
      height: item.origin.height,
      heading: item.rotation.heading,
      pitch: item.rotation.pitch,
      roll: item.rotation.roll,
      scale: item.scale
    };

    this.previousFeaturePickingPaused = cesium.isFeaturePickingPaused;
    cesium.isFeaturePickingPaused = true;

    const center = tileset.boundingSphere.center;
    const radius = tileset.boundingSphere.radius;
    this.initialEditorCenter = Cartesian3.clone(center);
    this.initialItemPosition = Matrix4.getTranslation(
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
    this.initialWorldRotation = Quaternion.clone(itemRotation);
    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      center,
      itemRotation,
      new Cartesian3(radius, radius, radius)
    );

    this.boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: false,
      disableVerticalMovement: false,
      drawNonUniformScaleGrips: false,
      onChange: action(({ modelMatrix }) => {
        this.previewModelMatrix(modelMatrix);
      })
    });
    this.boxDrawing.enableScaling = false;
    this.boxDrawing.enableRotation = true;
    (
      this.item as unknown as { repositionBoxDrawing?: BoxDrawing }
    ).repositionBoxDrawing = this.boxDrawing;
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
    controller.boxDrawing.dataSource.show = true;
    return controller;
  }

  private previewModelMatrix(modelMatrix: Matrix4) {
    const editorPosition = Matrix4.getTranslation(
      modelMatrix,
      new Cartesian3()
    );
    const editorMove = Cartesian3.subtract(
      editorPosition,
      this.initialEditorCenter,
      new Cartesian3()
    );
    const position = Cartesian3.add(
      this.initialItemPosition,
      editorMove,
      new Cartesian3()
    );
    LatLonHeightTraits.setFromCartesian(
      this.item.origin,
      CommonStrata.user,
      position
    );

    const worldRotation = Quaternion.fromRotationMatrix(
      Matrix4.getRotation(modelMatrix, new Matrix3()),
      new Quaternion()
    );
    if (
      !Quaternion.equalsEpsilon(
        worldRotation,
        this.initialWorldRotation,
        0.000001
      )
    ) {
      const hpr = Transforms.fixedFrameToHeadingPitchRoll(modelMatrix);
      HeadingPitchRollTraits.setFromHeadingPitchRoll(
        this.item.rotation,
        CommonStrata.user,
        hpr
      );
    }
  }

  save() {
    this.finished = true;
    this.dispose();
  }

  cancel() {
    if (this.finished) return;
    this.finished = true;
    updateModelFromJson(this.item.origin, CommonStrata.user, {
      latitude: this.snapshot.latitude,
      longitude: this.snapshot.longitude,
      height: this.snapshot.height
    }).logError("Failed to restore 3D Tiles origin");
    updateModelFromJson(this.item.rotation, CommonStrata.user, {
      heading: this.snapshot.heading,
      pitch: this.snapshot.pitch,
      roll: this.snapshot.roll
    }).logError("Failed to restore 3D Tiles rotation");
    if (this.snapshot.scale !== undefined) {
      this.item.setTrait(CommonStrata.user, "scale", this.snapshot.scale);
    } else {
      this.item.setTrait(CommonStrata.user, "scale", undefined);
    }
    this.dispose();
  }

  dispose() {
    this.boxDrawing.enableScaling = false;
    this.boxDrawing.enableRotation = false;
    (this.boxDrawing as any).stopInteractions();
    this.boxDrawing.dataSource.show = false;
    (
      this.item as unknown as {
        repositionBoxDrawing?: BoxDrawing;
      }
    ).repositionBoxDrawing = undefined;
    void this.cesium.dataSources.remove(this.boxDrawing.dataSource);
    this.cesium.isFeaturePickingPaused = this.previousFeaturePickingPaused;
  }
}
