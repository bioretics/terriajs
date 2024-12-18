import i18next from "i18next";
import { computed, makeObservable, override } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import Resource from "terriajs-cesium/Source/Core/Resource";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import KmlDataSource from "terriajs-cesium/Source/DataSources/KmlDataSource";
import Property from "terriajs-cesium/Source/DataSources/Property";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import isDefined from "../../../Core/isDefined";
import readXml from "../../../Core/readXml";
import TerriaError, { networkRequestError } from "../../../Core/TerriaError";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import KmlCatalogItemTraits from "../../../Traits/TraitsClasses/KmlCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import HasLocalData from "../../HasLocalData";
import { ModelConstructorParameters } from "../../Definition/Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import CesiumIonMixin from "../../../ModelMixins/CesiumIonMixin";
import MeasurableGeometryMixin from "../../../ModelMixins/MeasurableGeometryMixin";
import Entity from "terriajs-cesium/Source/DataSources/Entity";

const kmzRegex = /\.kmz$/i;

class KmlCatalogItem
  extends MeasurableGeometryMixin(
    MappableMixin(
      UrlMixin(
        CesiumIonMixin(CatalogMemberMixin(CreateModel(KmlCatalogItemTraits)))
      )
    )
  )
  implements HasLocalData
{
  static readonly type = "kml";

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  get type() {
    return KmlCatalogItem.type;
  }

  private _dataSource: KmlDataSource | undefined;

  private _kmlFile?: File;

  setFileInput(file: File) {
    this._kmlFile = file;
  }

  @computed
  get hasLocalData(): boolean {
    return isDefined(this._kmlFile);
  }

  @override
  get cacheDuration(): string {
    if (isDefined(super.cacheDuration)) {
      return super.cacheDuration;
    }
    return "1d";
  }

  protected forceLoadMapItems(): Promise<void> {
    return new Promise<string | Resource | Document | Blob | undefined>(
      (resolve) => {
        if (isDefined(this.kmlString)) {
          const parser = new DOMParser();
          resolve(parser.parseFromString(this.kmlString, "text/xml"));
        } else if (isDefined(this._kmlFile)) {
          if (this._kmlFile.name && this._kmlFile.name.match(kmzRegex)) {
            resolve(this._kmlFile);
          } else {
            resolve(readXml(this._kmlFile));
          }
        } else if (isDefined(this.ionResource)) {
          resolve(this.ionResource);
        } else if (isDefined(this.url)) {
          resolve(proxyCatalogItemUrl(this, this.url));
        } else {
          throw networkRequestError({
            sender: this,
            title: i18next.t("models.kml.unableToLoadItemTitle"),
            message: i18next.t("models.kml.unableToLoadItemMessage")
          });
        }
      }
    )
      .then((kmlLoadInput) => {
        return KmlDataSource.load(kmlLoadInput!);
      })
      .then((dataSource) => {
        this._dataSource = dataSource;
        this.doneLoading(dataSource); // Unsure if this is necessary
      })
      .catch((e) => {
        throw networkRequestError(
          TerriaError.from(e, {
            sender: this,
            title: i18next.t("models.kml.errorLoadingTitle"),
            message: i18next.t("models.kml.errorLoadingMessage", {
              appName: this.terria.appName
            })
          })
        );
      });
  }

  @computed
  get mapItems() {
    if (this.isLoadingMapItems || this._dataSource === undefined) {
      return [];
    }
    this._dataSource.show = this.show;
    return [this._dataSource];
  }

  protected forceLoadMetadata(): Promise<void> {
    return this.loadIonResource();
  }

  private doneLoading(kmlDataSource: KmlDataSource) {
    // Clamp features to terrain.
    if (isDefined(this.terria.cesium)) {
      const positionsToSample: Cartographic[] = [];
      const correspondingCartesians: Cartesian3[] = [];

      const entities = kmlDataSource.entities.values;
      for (let i = 0; i < entities.length; ++i) {
        const entity = entities[i];

        const polygon = entity.polygon;
        if (isDefined(polygon)) {
          polygon.perPositionHeight = true as unknown as Property;
          const polygonHierarchy = getPropertyValue<PolygonHierarchy>(
            polygon.hierarchy
          );
          if (polygonHierarchy) {
            samplePolygonHierarchyPositions(
              polygonHierarchy,
              positionsToSample,
              correspondingCartesians
            );
          }
        }

        // Clamp to ground
        if (isDefined(entity.polyline)) {
          entity.polyline.width = new ConstantProperty(
            this.terria.configParameters.polylineWidth ?? 2
          );
          entity.polyline.clampToGround = new ConstantProperty(true);
          entity.polyline.arcType = new ConstantProperty(ArcType.GEODESIC);
        } else if (isDefined(entity.billboard)) {
          entity.billboard.heightReference = new ConstantProperty(
            HeightReference.CLAMP_TO_GROUND
          );
        }
      }
      const terrainProvider = this.terria.cesium.scene.globe.terrainProvider;
      sampleTerrainMostDetailed(terrainProvider, positionsToSample).then(
        function () {
          for (let i = 0; i < positionsToSample.length; ++i) {
            const position = positionsToSample[i];
            if (!isDefined(position.height)) {
              continue;
            }

            Ellipsoid.WGS84.cartographicToCartesian(
              position,
              correspondingCartesians[i]
            );
          }

          // Force the polygons to be rebuilt.
          for (let i = 0; i < entities.length; ++i) {
            const polygon = entities[i].polygon;
            if (!isDefined(polygon)) {
              continue;
            }

            const existingHierarchy = getPropertyValue<PolygonHierarchy>(
              polygon.hierarchy
            );
            if (existingHierarchy) {
              polygon.hierarchy = new ConstantProperty(
                new PolygonHierarchy(
                  existingHierarchy.positions,
                  existingHierarchy.holes
                )
              );
            }
          }
        }
      );
    }
  }

  @computed
  get canUseAsPath() {
    const entities = this._dataSource?.entities?.values ?? [];
    const polygons = entities.filter((e) => e?.polygon);
    const polylines = entities.filter((e) => e?.polyline);

    if (polygons.length > 0 && !this.arePolygonsValid(polygons)) {
      return false;
    }

    if (polylines.length > 0 && !this.arePolylinesValid(polylines)) {
      return false;
    }

    return polygons.length > 0 || polylines.length > 0;
  }

  private arePolygonsValid(polygons: Entity[]): boolean {
    const pointOccurrences: { point: Cartesian3; count: number }[] = [];

    polygons.forEach((polygon) => {
      const points = this.getPositions(polygon);
      points.forEach((point) =>
        this.updatePointOccurrences(pointOccurrences, point)
      );
    });

    const singleConnectionCount = pointOccurrences.filter(
      ({ count }) => count === 2
    ).length;
    return singleConnectionCount === 1;
  }

  private arePolylinesValid(polylines: Entity[]): boolean {
    const pointOccurrences: { point: Cartesian3; count: number }[] = [];

    polylines.forEach((polyline) => {
      const points = this.getPositions(polyline);
      this.updatePointOccurrences(pointOccurrences, points[0]);
      this.updatePointOccurrences(pointOccurrences, points[points.length - 1]);
    });

    const singleConnectionCount = pointOccurrences.filter(
      ({ count }) => count === 1
    ).length;
    return singleConnectionCount === 2;
  }

  private updatePointOccurrences(
    pointOccurrences: { point: Cartesian3; count: number }[],
    point: Cartesian3
  ) {
    const occurrence = pointOccurrences.find((item) =>
      Cartesian3.equals(item.point, point)
    );
    if (occurrence) {
      occurrence.count++;
    } else {
      pointOccurrences.push({ point, count: 1 });
    }
  }

  computePath() {
    const entities = this._dataSource?.entities?.values ?? [];
    const items = entities.filter((e) => e && (e.polyline || e.polygon));

    if (items.length === 0) return;

    const allCoordinates =
      items.length === 1
        ? this.getPositions(items[0])
        : this.orderEntities(items).flatMap(this.getPositions);

    const positions = this.getUniqueCartographics(allCoordinates);

    this.asPath(positions);
  }

  private getPositions(entity: Entity): Cartesian3[] {
    return (
      entity.polyline?.positions?.getValue(JulianDate.now()) ??
      entity.polygon?.hierarchy?.getValue(JulianDate.now())?.positions ??
      []
    );
  }

  private orderEntities(entities: Entity[]): Entity[] {
    const ordered: Entity[] = [entities.shift()!];

    while (entities.length > 0) {
      const lastPoint = this.getPositions(ordered[ordered.length - 1]).slice(
        -1
      )[0];
      const index = entities.findIndex((e) =>
        Cartesian3.equals(this.getPositions(e)[0], lastPoint)
      );
      ordered.push(
        index !== -1 ? entities.splice(index, 1)[0] : entities.splice(0, 1)[0]
      );
    }

    return ordered;
  }

  private getUniqueCartographics(coordinates: Cartesian3[]): Cartographic[] {
    return coordinates
      .map((elem) => Cartographic.fromCartesian(elem))
      .filter(
        (item, index, self) =>
          index ===
          self.findIndex((coord) => {
            return (
              coord.latitude === item.latitude &&
              coord.longitude === item.longitude &&
              coord.height === item.height
            );
          })
      );
  }
}

export default KmlCatalogItem;

function getPropertyValue<T>(property: Property | undefined): T | undefined {
  if (property === undefined) {
    return undefined;
  }
  return property.getValue(JulianDate.now());
}

function samplePolygonHierarchyPositions(
  polygonHierarchy: PolygonHierarchy,
  positionsToSample: Cartographic[],
  correspondingCartesians: Cartesian3[]
) {
  const positions = polygonHierarchy.positions;

  for (let i = 0; i < positions.length; ++i) {
    const position = positions[i];
    correspondingCartesians.push(position);
    positionsToSample.push(Ellipsoid.WGS84.cartesianToCartographic(position));
  }

  const holes = polygonHierarchy.holes;
  for (let i = 0; i < holes.length; ++i) {
    samplePolygonHierarchyPositions(
      holes[i],
      positionsToSample,
      correspondingCartesians
    );
  }
}
