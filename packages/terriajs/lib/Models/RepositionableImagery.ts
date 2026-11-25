import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import { runInAction } from "mobx";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import Color from "terriajs-cesium/Source/Core/Color";
import IonImageryCatalogItem from "./Catalog/CatalogItems/IonImageryCatalogItem";
import { ImageryParts } from "../ModelMixins/MappableMixin";
import { RectangleTraits } from "../Traits/TraitsClasses/MappableTraits";
import createRepositionableBoxDrawing from "./createRepositionableBoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import RepositionableLayer, {
  RepositionableLayerAdapter,
  getDefaultTrait
} from "./RepositionableLayer";

interface RectangleSnapshot {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
}

interface ImagerySnapshot {
  rectangle: RectangleSnapshot;
  clipToRectangle?: boolean;
}

export default class RepositionableImagery extends RepositionableLayer<
  ImagerySnapshot,
  IonImageryCatalogItem
> {
  private constructor(
    item: IonImageryCatalogItem,
    cesium: Cesium,
    rectangle: Rectangle
  ) {
    const is2D = true;
    const centerCartographic = Rectangle.center(rectangle, new Cartographic());
    const center = Cartesian3.fromRadians(
      centerCartographic.longitude,
      centerCartographic.latitude,
      5000
    );
    const southwest = Ellipsoid.WGS84.cartographicToCartesian(
      new Cartographic(rectangle.west, rectangle.south, 0)
    );
    const southeast = Ellipsoid.WGS84.cartographicToCartesian(
      new Cartographic(rectangle.east, rectangle.south, 0)
    );
    const northwest = Ellipsoid.WGS84.cartographicToCartesian(
      new Cartographic(rectangle.west, rectangle.north, 0)
    );
    const widthMeters = Math.max(
      100,
      Cartesian3.distance(southwest, southeast)
    );
    const heightMeters = Math.max(
      100,
      Cartesian3.distance(southwest, northwest)
    );
    const initialEditorCenter = Cartesian3.clone(center);
    const initialRectangle = {
      west: CesiumMath.toDegrees(rectangle.west),
      south: CesiumMath.toDegrees(rectangle.south),
      east: CesiumMath.toDegrees(rectangle.east),
      north: CesiumMath.toDegrees(rectangle.north)
    };

    const editorTransform = Matrix4.fromTranslationQuaternionRotationScale(
      center,
      Quaternion.IDENTITY,
      new Cartesian3(widthMeters, heightMeters, 100)
    );
    const boxDrawing = createRepositionableBoxDrawing(
      cesium,
      editorTransform,
      is2D,
      { keepBoxAboveGround: true }
    );
    boxDrawing.enableRotation = !is2D;
    boxDrawing.dataSource.entities.add(
      new Entity({
        position: center,
        point: {
          show: true,
          pixelSize: 18,
          color: Color.CYAN,
          outlineColor: Color.WHITE,
          outlineWidth: 3,
          disableDepthTestDistance: 0
        }
      })
    );

    const adapter: RepositionableLayerAdapter<
      ImagerySnapshot,
      IonImageryCatalogItem
    > = {
      item,
      snapshot: () => ({
        rectangle: {
          west: item.rectangle?.west,
          south: item.rectangle?.south,
          east: item.rectangle?.east,
          north: item.rectangle?.north
        },
        clipToRectangle: item.clipToRectangle
      }),
      defaultSnapshot: () => {
        const rectangle = getDefaultTrait<RectangleTraits>(item, "rectangle");
        return {
          rectangle: {
            west: rectangle?.west,
            south: rectangle?.south,
            east: rectangle?.east,
            north: rectangle?.north
          },
          clipToRectangle: getDefaultTrait<boolean>(item, "clipToRectangle")
        };
      },
      preview: (modelMatrix) => {
        const position = Matrix4.getTranslation(modelMatrix, new Cartesian3());
        const cartographic = Cartographic.fromCartesian(position);
        const initialCartographic =
          Cartographic.fromCartesian(initialEditorCenter);
        const longitudeDelta =
          cartographic.longitude - initialCartographic.longitude;
        const latitudeDelta =
          cartographic.latitude - initialCartographic.latitude;
        const longitudeDeltaDegrees = CesiumMath.toDegrees(longitudeDelta);
        const latitudeDeltaDegrees = CesiumMath.toDegrees(latitudeDelta);

        const west = initialRectangle.west + longitudeDeltaDegrees;
        const south = initialRectangle.south + latitudeDeltaDegrees;
        const east = initialRectangle.east + longitudeDeltaDegrees;
        const north = initialRectangle.north + latitudeDeltaDegrees;

        if (
          !Number.isFinite(west) ||
          !Number.isFinite(south) ||
          !Number.isFinite(east) ||
          !Number.isFinite(north) ||
          west < -180 ||
          east > 180 ||
          south < -90 ||
          north > 90 ||
          west >= east ||
          south >= north
        ) {
          return;
        }

        runInAction(() => {
          item.setTrait(CommonStrata.user, "rectangle", {
            west,
            south,
            east,
            north
          });
          item.setTrait(CommonStrata.user, "clipToRectangle", true);
        });
      },
      restore: (snapshot) => {
        runInAction(() => {
          if (item.rectangle) {
            updateModelFromJson(item.rectangle, CommonStrata.user, {
              west: snapshot.rectangle.west,
              south: snapshot.rectangle.south,
              east: snapshot.rectangle.east,
              north: snapshot.rectangle.north
            }).logError("Failed to restore imagery rectangle");
          } else if (
            snapshot.rectangle.west !== undefined &&
            snapshot.rectangle.south !== undefined &&
            snapshot.rectangle.east !== undefined &&
            snapshot.rectangle.north !== undefined
          ) {
            item.setTrait(CommonStrata.user, "rectangle", snapshot.rectangle);
          }
          item.setTrait(
            CommonStrata.user,
            "clipToRectangle",
            snapshot.clipToRectangle
          );
        });
      }
    };

    super(adapter, cesium, boxDrawing);
  }

  static create(
    item: IonImageryCatalogItem,
    cesium: Cesium
  ): RepositionableImagery | undefined {
    if (item.isLoadingMapItems || item.mapItems.length === 0) return;

    const imagery = item.mapItems.find((mapItem) => ImageryParts.is(mapItem));
    if (!imagery || !ImageryParts.is(imagery)) return;
    const providerRectangle = imagery.imageryProvider?.rectangle;
    let rectangle =
      item.rectangle &&
      item.rectangle.west !== undefined &&
      item.rectangle.south !== undefined &&
      item.rectangle.east !== undefined &&
      item.rectangle.north !== undefined
        ? Rectangle.fromDegrees(
            item.rectangle.west,
            item.rectangle.south,
            item.rectangle.east,
            item.rectangle.north
          )
        : providerRectangle;
    if (
      rectangle &&
      (Math.abs(rectangle.east - rectangle.west) > CesiumMath.toRadians(20) ||
        Math.abs(rectangle.north - rectangle.south) > CesiumMath.toRadians(20))
    ) {
      rectangle = undefined;
    }
    if (!rectangle) {
      const viewRectangle = cesium.scene.camera.computeViewRectangle(
        cesium.scene.globe.ellipsoid
      );
      if (
        viewRectangle &&
        Math.abs(viewRectangle.east - viewRectangle.west) <
          CesiumMath.toRadians(20) &&
        Math.abs(viewRectangle.north - viewRectangle.south) <
          CesiumMath.toRadians(20)
      ) {
        rectangle = viewRectangle;
      }
    }
    if (!rectangle) {
      const canvas = cesium.scene.canvas;
      const pickedPosition = cesium.scene.camera.pickEllipsoid(
        new Cartesian2(canvas.clientWidth * 0.5, canvas.clientHeight * 0.5),
        cesium.scene.globe.ellipsoid
      );
      const centerPosition =
        pickedPosition ??
        Ellipsoid.WGS84.scaleToGeodeticSurface(
          cesium.scene.camera.positionWC,
          new Cartesian3()
        );
      if (centerPosition) {
        const center = Cartographic.fromCartesian(centerPosition);
        rectangle = Rectangle.fromRadians(
          center.longitude - CesiumMath.toRadians(0.01),
          center.latitude - CesiumMath.toRadians(0.005),
          center.longitude + CesiumMath.toRadians(0.01),
          center.latitude + CesiumMath.toRadians(0.005)
        );
      }
    }
    if (!rectangle) return;

    return new RepositionableImagery(item, cesium, rectangle);
  }
}
