import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Matrix3 from "terriajs-cesium/Source/Core/Matrix3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import Cesium3DTileset from "terriajs-cesium/Source/Scene/Cesium3DTileset";
import Cesium3dTilesMixin from "../ModelMixins/Cesium3dTilesMixin";
import HeadingPitchRollTraits from "../Traits/TraitsClasses/HeadingPitchRollTraits";
import LatLonHeightTraits from "../Traits/TraitsClasses/LatLonHeightTraits";
import CompositeCatalogItem from "./Catalog/CatalogItems/CompositeCatalogItem";
import BoxDrawing from "./BoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "./RepositionableLayer";

interface MemberSnapshot {
  item: Cesium3dTilesMixin.Instance;
  latitude?: number;
  longitude?: number;
  height?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  scale?: number;
  position: Cartesian3;
  rotation: Quaternion;
  scaleVector: Cartesian3;
}

interface CompositeSnapshot {
  members: MemberSnapshot[];
}

export default class RepositionableComposite extends RepositionableLayer<
  CompositeSnapshot,
  CompositeCatalogItem
> {
  private constructor(
    item: CompositeCatalogItem,
    cesium: Cesium,
    tilesets: Cesium3DTileset[],
    memberItems: Cesium3dTilesMixin.Instance[]
  ) {
    const boundingSphere = BoundingSphere.fromBoundingSpheres(
      tilesets.map((tileset) => tileset.boundingSphere)
    );
    const initialEditorCenter = Cartesian3.clone(boundingSphere.center);
    const radius = Math.max(boundingSphere.radius, 1);
    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      boundingSphere.center,
      Quaternion.IDENTITY,
      new Cartesian3(radius, radius, radius)
    );

    const boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: false,
      disableVerticalMovement: false,
      drawNonUniformScaleGrips: false
    });
    const initialPositions = memberItems.map((member) =>
      Matrix4.getTranslation(member.modelMatrix, new Cartesian3())
    );
    const initialSnapshots = memberItems.map((member) => ({
      heading: member.rotation.heading ?? 0,
      pitch: member.rotation.pitch ?? 0,
      roll: member.rotation.roll ?? 0
    }));

    const adapter: RepositionableLayerAdapter<
      CompositeSnapshot,
      CompositeCatalogItem
    > = {
      item,
      snapshot: () => ({
        members: memberItems.map((member) => {
          const matrix = member.modelMatrix;
          return {
            item: member,
            latitude: member.origin.latitude,
            longitude: member.origin.longitude,
            height: member.origin.height,
            heading: member.rotation.heading,
            pitch: member.rotation.pitch,
            roll: member.rotation.roll,
            scale: member.scale,
            position: Matrix4.getTranslation(matrix, new Cartesian3()),
            rotation: Quaternion.fromRotationMatrix(
              Matrix4.getRotation(matrix, new Matrix3()),
              new Quaternion()
            ),
            scaleVector: Matrix4.getScale(matrix, new Cartesian3())
          };
        })
      }),
      preview: (modelMatrix) => {
        const editorPosition = Matrix4.getTranslation(
          modelMatrix,
          new Cartesian3()
        );
        const move = Cartesian3.subtract(
          editorPosition,
          initialEditorCenter,
          new Cartesian3()
        );

        memberItems.forEach((member, index) => {
          const position = Cartesian3.add(
            initialPositions[index],
            move,
            new Cartesian3()
          );
          LatLonHeightTraits.setFromCartesian(
            member.origin,
            CommonStrata.user,
            position
          );

          const hpr = Transforms.fixedFrameToHeadingPitchRoll(modelMatrix);
          HeadingPitchRollTraits.setFromHeadingPitchRoll(
            member.rotation,
            CommonStrata.user,
            HeadingPitchRoll.fromDegrees(
              initialSnapshots[index].heading +
                CesiumMath.toDegrees(hpr.heading),
              initialSnapshots[index].pitch + CesiumMath.toDegrees(hpr.pitch),
              initialSnapshots[index].roll + CesiumMath.toDegrees(hpr.roll)
            )
          );
        });
      },
      restore: (snapshot) => {
        snapshot.members.forEach((memberSnapshot) => {
          updateModelFromJson(memberSnapshot.item.origin, CommonStrata.user, {
            latitude: memberSnapshot.latitude,
            longitude: memberSnapshot.longitude,
            height: memberSnapshot.height
          }).logError("Failed to restore composite member origin");
          updateModelFromJson(memberSnapshot.item.rotation, CommonStrata.user, {
            heading: memberSnapshot.heading,
            pitch: memberSnapshot.pitch,
            roll: memberSnapshot.roll
          }).logError("Failed to restore composite member rotation");
          memberSnapshot.item.setTrait(
            CommonStrata.user,
            "scale",
            memberSnapshot.scale
          );
        });
      }
    };

    super(adapter, cesium, boxDrawing);
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = true;
  }

  static create(
    item: CompositeCatalogItem,
    cesium: Cesium
  ): RepositionableComposite | undefined {
    if (item.isLoadingMapItems) return;

    const tilesets = item.mapItems.filter(
      (mapItem): mapItem is Cesium3DTileset =>
        mapItem instanceof Cesium3DTileset
    );
    if (tilesets.length === 0) return;

    const memberItems = item.memberModels.filter(
      Cesium3dTilesMixin.isMixedInto
    );
    if (memberItems.length === 0) return;

    return new RepositionableComposite(item, cesium, tilesets, memberItems);
  }
}
