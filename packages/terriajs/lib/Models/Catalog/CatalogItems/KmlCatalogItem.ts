import i18next from "i18next";
import { action, computed, makeObservable, override } from "mobx";
// Fork (rer3d): KML measurable-geometry / clamp-to-ground processing.
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
import CommonStrata from "../../Definition/CommonStrata";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import HasLocalData from "../../HasLocalData";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import CesiumIonMixin from "../../../ModelMixins/CesiumIonMixin";
// Fork (rer3d) mixins: measurable / exportable / searchable KML items.
import MeasurableGeometryMixin from "../../../ModelMixins/MeasurableGeometryMixin";
import ViewerMode from "../../ViewerMode";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import ExportableMixin, {
  ExportData
} from "../../../ModelMixins/ExportableMixin";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import SearchableCatalogItemMixin, {
  SearchableData
} from "../../../ModelMixins/SearchableCatalogItemMixin";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";

const kmzRegex = /\.kmz$/i;

class KmlCatalogItem
  extends SearchableCatalogItemMixin(
    MeasurableGeometryMixin(
      MappableMixin(
        ExportableMixin(
          UrlMixin(
            CesiumIonMixin(
              CatalogMemberMixin(CreateModel(KmlCatalogItemTraits))
            )
          )
        )
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

  // Fork (rer3d): keep the original File for the export-data fallback.
  private _kmlFile?: File;

  @action
  setFileInput(file: File) {
    this._kmlFile = file;
    this.setTrait(
      CommonStrata.user,
      "url",
      URL.createObjectURL(file) + "#" + file.name
    );
  }

  @computed
  get hasLocalData(): boolean {
    return this.url?.startsWith("blob:") ?? false;
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
        // Fork (rer3d): load directly from the original File when available
        // (kmz passes through; kml is parsed as XML).
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
          title: i18next.t(($) => $.models.kml.unableToLoadItemTitle),
          message: i18next.t(($) => $.models.kml.unableToLoadItemMessage)
        });
      }
      this._dataSource = await KmlDataSource.load(kmlLoadInput, {
        clampToGround: this.clampToGround,
        sourceUri: this.dataSourceUri
          ? proxyCatalogItemUrl(this, this.dataSourceUri, "1d")
          : undefined
      } as any);
      // Fork (rer3d): post-process entities for measurable geometry.
      this.doneLoading(this._dataSource);
    } catch (e) {
      throw networkRequestError(
        TerriaError.from(e, {
          sender: this,
          title: i18next.t(($) => $.models.kml.errorLoadingTitle),
          message: i18next.t(($) => $.models.kml.errorLoadingMessage, {
            appName: this.terria.appName
          })
        })
      );
    }
  }

  @computed
  get _canExportData() {
    return isDefined(this._dataSource);
  }

  private async _exportDataFallback() {
    if (isDefined(this._kmlFile)) {
      let name = this._kmlFile.name || this.name || this.uniqueId || "data.kml";
      if (
        !name.toLowerCase().endsWith(".kml") &&
        !name.toLowerCase().endsWith(".kmz")
      ) {
        name = `${name}.kml`;
      }
      return {
        name,
        file: this._kmlFile
      };
    }

    throw new TerriaError({
      sender: this,
      message: "No data available to download."
    });
  }

  protected async _exportData(): Promise<ExportData | undefined> {
    try {
      let action;
      if (this.canUseAsPath) {
        action = Promise.resolve(this.computePath());
      } else {
        action = this.sampleFromKmlData.bind(this)();
      }
      await action;
    } catch (_e) {
      return this._exportDataFallback();
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

  // Fork (rer3d): clamp KML features to terrain + measurable-geometry support.
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
            this.terria.mainViewer.viewerMode === ViewerMode.Cesium2D
              ? HeightReference.NONE
              : HeightReference.CLAMP_TO_GROUND
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

  doSearch(text: string): Promise<SearchableData[]> {
    if (!this.nameOfCatalogItemSearchField || !this._dataSource?.entities)
      return Promise.resolve([]);
    const nameOfCatalogItemSearchField = this.nameOfCatalogItemSearchField;

    const filteredElements = this._dataSource.entities.values.filter(
      (entity) => {
        return (
          (entity.billboard ||
            entity.point ||
            entity.polyline ||
            entity.polygon) &&
          (entity.properties?.[nameOfCatalogItemSearchField]
            .valueOf()
            .toLowerCase()
            .includes(text) ||
            entity.name?.toLowerCase().includes(text))
        );
      }
    );
    const searchableData = filteredElements.map((entity) => {
      let cartoPosition: Cartographic;

      if (entity.polyline) {
        cartoPosition = Rectangle.center(
          Rectangle.fromCartesianArray(
            entity.polyline?.positions?.getValue(JulianDate.now()) ?? []
          )
        );
      } else if (entity.polygon) {
        cartoPosition = Rectangle.center(
          Rectangle.fromCartesianArray(
            (
              entity.polygon?.hierarchy?.getValue(JulianDate.now()) as
                | PolygonHierarchy
                | undefined
            )?.positions ?? []
          )
        );
      } else {
        const cartesianPosition = entity.position!.getValue(JulianDate.now());
        cartoPosition = Cartographic.fromCartesian(cartesianPosition!);
      }

      return {
        searchField:
          entity.name ??
          (entity.properties![
            nameOfCatalogItemSearchField
          ].valueOf() as string),
        latitude: CesiumMath.toDegrees(cartoPosition.latitude),
        longitude: CesiumMath.toDegrees(cartoPosition.longitude)
      };
    });

    return Promise.resolve(searchableData);
  }

  @computed
  get canUseAsPath() {
    const entities = this._dataSource?.entities?.values ?? [];
    const polygons = entities.filter((e) => e?.polygon);
    const polylines = entities.filter((e) => e?.polyline);

    if (polygons.length === 1) {
      return this.isPolygonValid(polygons);
    } else if (polylines.length === 1) {
      return this.arePolylinesValid(polylines);
    } else if (polylines.length > 1) {
      return polylines.every((polyline) => this.arePolylinesValid([polyline]));
    } else if (polygons.length > 1) {
      return polygons.every((polygon) => this.isPolygonValid([polygon]));
    } else {
      return false;
    }
  }

  // Checks if the provided polygons are valid by ensuring only one point is connected exactly twice.
  private isPolygonValid(polygons: Entity[]): boolean {
    const pointOccurrences: { point: Cartesian3; count: number }[] = [];
    polygons.forEach((polygon) => {
      const points = this.getPositions(polygon);
      points.forEach((point) =>
        this.updatePointOccurrences(pointOccurrences, point)
      );
    });

    const validPoints = pointOccurrences.filter(
      ({ count }) => count === 2
    ).length;
    return validPoints >= 1;
  }

  // Checks if the provided polylines are valid by ensuring exactly two points are connected only once.
  private arePolylinesValid(polylines: Entity[]): boolean {
    const pointOccurrences: { point: Cartesian3; count: number }[] = [];

    polylines.forEach((polyline) => {
      const points = this.getPositions(polyline);
      this.updatePointOccurrences(pointOccurrences, points[0]);
      this.updatePointOccurrences(pointOccurrences, points[points.length - 1]);
    });

    const validPoints = pointOccurrences.filter(
      ({ count }) => count === 1
    ).length;

    if (validPoints === 2) return true;

    if (validPoints === 0) {
      return pointOccurrences.every(({ count }) => count === 2);
    }

    return false;
  }

  // Updates the occurrences of a given point in the pointOccurrences array.
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
    const items = entities.filter((e) => e && (e.polygon || e.polyline));
    if (items.length === 0) return;

    items.forEach((element, i) => {
      const description = element.description?.getValue(JulianDate.now());
      let pathNotes = "";
      if (description) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(description, "text/html");
        pathNotes = doc.body.textContent || "";
      }
      const allCoordinates = this.getPositions(element);
      if (allCoordinates.length === 0) return;

      const allCartographics = allCoordinates.map((elem) =>
        Cartographic.fromCartesian(elem)
      );
      const positions = allCartographics;

      const closeLoop =
        !!element.polygon ||
        (allCoordinates.length > 1 &&
          Cartesian3.equals(
            allCoordinates[0],
            allCoordinates[allCoordinates.length - 1]
          ));

      this.asPath(positions, pathNotes, i, closeLoop);
    });
  }

  // Retrieves the positions of an entity, either from a polyline or polygon.
  private getPositions(entity: Entity): Cartesian3[] {
    return (
      entity.polyline?.positions?.getValue(JulianDate.now()) ??
      entity.polygon?.hierarchy?.getValue(JulianDate.now())?.positions ??
      []
    );
  }

  // Orders the given entities based on their positions, ensuring they form a continuous path.
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

  // Filters out duplicate Cartographic coordinates, ensuring only unique coordinates remain.
  private getUniqueCartographics(coordinates: Cartographic[]): Cartographic[] {
    const seen = new Set<string>();
    return coordinates.filter((coord) => {
      const key = `${coord.latitude},${coord.longitude},${coord.height}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  public async sampleFromKmlData(): Promise<void> {
    const entities = this._dataSource?.entities?.values ?? [];
    if (entities.length === 0) return;
    let pathNotes = "";
    const folder = entities[0];
    const descriptionValue = folder.description?.getValue(JulianDate.now());

    if (descriptionValue) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(descriptionValue, "text/html");
      pathNotes = doc.body.textContent || "";
    }

    const pointDescriptions: string[] = (folder as any)._children.map(
      (entity: any) => {
        const descriptionValue = entity.description?.getValue(JulianDate.now());
        if (descriptionValue) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(descriptionValue, "text/html");
          return doc.body.textContent || "";
        }
        return "";
      }
    );

    const cartesianPositions: Cartesian3[] = entities.flatMap(
      (entity) => entity.position?.getValue(JulianDate.now())?.clone() ?? []
    );
    const cartographicPositions = cartesianPositions.map((pos) =>
      Cartographic.fromCartesian(pos)
    );

    if (cartographicPositions.length === 0) return;

    if (!this.terria) return;
    const terrainProvider = this.terria.cesium?.scene?.terrainProvider;

    const resolvedPositions =
      terrainProvider && cartographicPositions.every((pos) => pos.height < 1)
        ? await sampleTerrainMostDetailed(
            terrainProvider,
            cartographicPositions
          )
        : cartographicPositions;

    this.terria.measurableGeometryManager[
      this.terria.measurableGeometryIndex
    ].sampleFromCartographics(
      resolvedPositions,
      false,
      true,
      pointDescriptions,
      pathNotes
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
