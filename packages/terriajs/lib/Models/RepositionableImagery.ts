import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import IonImageryCatalogItem from "./Catalog/CatalogItems/IonImageryCatalogItem";
import { ImageryParts } from "../ModelMixins/MappableMixin";
import BoxDrawing from "./BoxDrawing";
import Cesium from "./Cesium";
import CommonStrata from "./Definition/CommonStrata";
import updateModelFromJson from "./Definition/updateModelFromJson";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "./RepositionableLayer";

interface RectangleSnapshot {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
}

interface ImagerySnapshot {
  rectangle: RectangleSnapshot;
  clipToRectangle: boolean;
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
    const centerCartographic = Rectangle.center(rectangle, new Cartographic());
    const center = Cartesian3.fromRadians(
      centerCartographic.longitude,
      centerCartographic.latitude,
      0
    );
    const width = Math.abs(rectangle.east - rectangle.west);
    const height = Math.abs(rectangle.north - rectangle.south);
    const radius = Math.max(
      100,
      Ellipsoid.WGS84.maximumRadius * Math.max(width, height)
    );
    const initialEditorCenter = Cartesian3.clone(center);
    const initialRectangle = {
      west: rectangle.west,
      south: rectangle.south,
      east: rectangle.east,
      north: rectangle.north
    };

    const editorTransform = Matrix4.fromTranslation(center);
    Matrix4.multiplyByUniformScale(editorTransform, radius, editorTransform);
    const boxDrawing = BoxDrawing.fromTransform(cesium, editorTransform, {
      keepBoxAboveGround: true,
      disableVerticalMovement: true,
      allowedTranslationAxes: ["x", "y"],
      allowedRotationAxes: undefined,
      drawNonUniformScaleGrips: false
    });
    boxDrawing.enableScaling = false;
    boxDrawing.enableRotation = false;

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
      preview: (modelMatrix) => {
        const position = Matrix4.getTranslation(modelMatrix, new Cartesian3());
        const cartographic = Cartographic.fromCartesian(position);
        const initialCartographic =
          Cartographic.fromCartesian(initialEditorCenter);
        const longitudeDelta =
          cartographic.longitude - initialCartographic.longitude;
        const latitudeDelta =
          cartographic.latitude - initialCartographic.latitude;

        item.setTrait(CommonStrata.user, "rectangle", {
          west: initialRectangle.west + longitudeDelta,
          south: initialRectangle.south + latitudeDelta,
          east: initialRectangle.east + longitudeDelta,
          north: initialRectangle.north + latitudeDelta
        });
        item.setTrait(CommonStrata.user, "clipToRectangle", true);
      },
      restore: (snapshot) => {
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
    const rectangle =
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
    if (!rectangle) return;

    return new RepositionableImagery(item, cesium, rectangle);
  }
}
