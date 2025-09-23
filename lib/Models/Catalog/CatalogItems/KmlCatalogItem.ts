import i18next from "i18next";
import { computed, makeObservable, override } from "mobx";
import Resource from "terriajs-cesium/Source/Core/Resource";
import KmlDataSource from "terriajs-cesium/Source/DataSources/KmlDataSource";
import TerriaError, { networkRequestError } from "../../../Core/TerriaError";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import Property from "terriajs-cesium/Source/DataSources/Property";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import isDefined from "../../../Core/isDefined";
import readXml from "../../../Core/readXml";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import KmlCatalogItemTraits from "../../../Traits/TraitsClasses/KmlCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import HasLocalData from "../../HasLocalData";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import CesiumIonMixin from "../../../ModelMixins/CesiumIonMixin";
import MeasurableGeometryMixin from "../../../ModelMixins/MeasurableGeometryMixin";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";

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

  protected async forceLoadMapItems(): Promise<void> {
    try {
      let kmlLoadInput: undefined | string | Resource | Document | Blob =
        undefined;

      if (isDefined(this.kmlString)) {
        const parser = new DOMParser();
        kmlLoadInput = parser.parseFromString(this.kmlString, "text/xml");
      } else if (isDefined(this._kmlFile)) {
        if (this._kmlFile.name && this._kmlFile.name.match(kmzRegex)) {
          kmlLoadInput = this._kmlFile;
        } else {
          kmlLoadInput = await readXml(this._kmlFile);
        }
      } else if (isDefined(this.ionResource)) {
        kmlLoadInput = this.ionResource;
      } else if (isDefined(this.url)) {
        kmlLoadInput = proxyCatalogItemUrl(this, this.url);
      }

      if (!kmlLoadInput) {
        throw networkRequestError({
          sender: this,
          title: i18next.t("models.kml.unableToLoadItemTitle"),
          message: i18next.t("models.kml.unableToLoadItemMessage")
        });
      }
      this._dataSource = await KmlDataSource.load(kmlLoadInput, {
        clampToGround: this.clampToGround,
        sourceUri: this.dataSourceUri
          ? proxyCatalogItemUrl(this, this.dataSourceUri, "1d")
          : undefined
      } as any);
    } catch (e) {
      throw networkRequestError(
        TerriaError.from(e, {
          sender: this,
          title: i18next.t("models.kml.errorLoadingTitle"),
          message: i18next.t("models.kml.errorLoadingMessage", {
            appName: this.terria.appName
          })
        })
      );
    }
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
    if (
      this._dataSource &&
      this._dataSource.entities &&
      this._dataSource.entities.values &&
      this._dataSource.entities.values.length > 0
    ) {
      const items = this._dataSource.entities.values.filter(
        (elem) => elem && typeof elem.polyline !== "undefined"
      );
      if (
        items.length === 1 &&
        items[0]?.polyline?.positions?.getValue(JulianDate.now()).length > 1
      ) {
        return true;
      }
    }
    return false;
  }

  computePath() {
    const items: Entity[] =
      this?._dataSource?.entities?.values.filter(
        (elem) => elem && typeof elem.polyline !== "undefined"
      ) ?? [];
    const coordinates: Cartesian3[] = items[0]?.polyline?.positions?.getValue(
      JulianDate.now()
    );
    if (coordinates && coordinates.length > 0) {
      const positions: Cartographic[] = coordinates.map((elem) =>
        Cartographic.fromCartesian(elem)
      );
      this.asPath(positions);
    }
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