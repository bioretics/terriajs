import { featureCollection } from "@turf/helpers";
import { GeoJsonProperties, Geometry, GeometryCollection } from "geojson";
import i18next from "i18next";
import {
  computed,
  makeObservable,
  onBecomeObserved,
  onBecomeUnobserved,
  override,
  runInAction
} from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import WebMercatorTilingScheme from "terriajs-cesium/Source/Core/WebMercatorTilingScheme";
import URI from "urijs";
import { FeatureCollectionWithCrs } from "../../../Core/GeoJson";
import isDefined from "../../../Core/isDefined";
import loadJson from "../../../Core/loadJson";
import Result from "../../../Core/Result";
import { networkRequestError } from "../../../Core/TerriaError";
import ProtomapsImageryProvider from "../../../Map/ImageryProvider/ProtomapsImageryProvider";
import featureDataToGeoJson from "../../../Map/PickedFeatures/featureDataToGeoJson";
import { ProtomapsArcGisPbfSource } from "../../../Map/Vector/Protomaps/ProtomapsArcGisPbfSource";
import { tableStyleToProtomaps } from "../../../Map/Vector/Protomaps/tableStyleToProtomaps";
import GeoJsonMixin from "../../../ModelMixins/GeojsonMixin";
import MinMaxLevelMixin from "../../../ModelMixins/MinMaxLevelMixin";
import ArcGisFeatureServerCatalogItemTraits from "../../../Traits/TraitsClasses/ArcGisFeatureServerCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import CommonStrata from "../../Definition/CommonStrata";
import { ModelConstructorParameters } from "../../Definition/Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import { ArcGisFeatureServerStratum } from "./ArcGisFeatureServerStratum";
import {
  RER_POI_CATALOG_ITEM_TYPE,
  RER_POI_DEFAULT_DYNAMIC_CACHE_MAX_ENTRIES,
  RER_POI_DEFAULT_DYNAMIC_REQUEST_DEBOUNCE_MS,
  RER_POI_DEFAULT_NEAR_CAMERA_BBOX_SCALE,
  RER_POI_DEFAULT_QUERY_BBOX_PADDING_RATIO,
  RER_POI_LEVEL_ID_FIELD,
  RER_POI_MAX_LEVEL_ID,
  RER_POI_MIN_LEVEL_ID,
  RER_POI_NEAR_CAMERA_HEIGHT_THRESHOLD,
  RER_POI_PROGRESSIVE_FAR_CAMERA_HEIGHT,
  RER_POI_PROGRESSIVE_LEVEL_STEP,
  RER_POI_PROGRESSIVE_NEAR_CAMERA_HEIGHT
} from "../../../ModelMixins/RerPoiHelpers";

type FeatureGeoJson = FeatureCollectionWithCrs<
  Geometry | GeometryCollection,
  GeoJsonProperties
>;

interface EsriJsonQueryOptions {
  resultOffset?: number;
  bbox?: Rectangle;
  minLevelId?: number;
  maxLevelId?: number;
}

interface DynamicViewportQuery {
  requestKey: string;
  filterKey: string;
  queryRectangle: Rectangle;
  requestOptions: EsriJsonQueryOptions;
}

interface DynamicViewportCacheEntry {
  requestKey: string;
  filterKey: string;
  queryRectangle: Rectangle;
  geoJson: FeatureGeoJson;
  lastAccess: number;
}

export default class RerPoiCatalogItem extends MinMaxLevelMixin(
  GeoJsonMixin(CreateModel(ArcGisFeatureServerCatalogItemTraits))
) {
  static readonly type = RER_POI_CATALOG_ITEM_TYPE;

  private removeCesiumCameraChangedListener: (() => void) | undefined;
  private removeViewerChangedListener: (() => void) | undefined;
  private removeLeafletMoveEndListener: (() => void) | undefined;
  private dynamicReloadTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly dynamicViewportCache = new Map<
    string,
    DynamicViewportCacheEntry
  >();
  private readonly dynamicInFlightRequests = new Map<
    string,
    Promise<FeatureGeoJson>
  >();
  private activeDynamicQuery: DynamicViewportQuery | undefined;
  private dynamicReloadQueued = false;
  private dynamicReloadInProgress = false;

  private readonly onDynamicViewportChanged = () => {
    this.queueDynamicReload();
  };

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
    this.setTrait(CommonStrata.definition, "forceCesiumPrimitives", true);

    onBecomeObserved(this, "mapItems", () => {
      this.startDynamicViewportRequests();
    });

    onBecomeUnobserved(this, "mapItems", () => {
      this.stopDynamicViewportRequests();
    });
  }

  get type(): string {
    return RerPoiCatalogItem.type;
  }

  get typeName(): string {
    return i18next.t("models.arcGisFeatureServerCatalogItem.name");
  }

  private startDynamicViewportRequests() {
    if (!this.removeViewerChangedListener) {
      this.removeViewerChangedListener =
        this.terria.mainViewer.afterViewerChanged.addEventListener(() => {
          this.attachCurrentViewerListener();
          this.queueDynamicReload(true);
        });
    }

    this.attachCurrentViewerListener();
    this.queueDynamicReload(true);
  }

  private stopDynamicViewportRequests() {
    this.detachCurrentViewerListener();

    if (this.removeViewerChangedListener) {
      this.removeViewerChangedListener();
      this.removeViewerChangedListener = undefined;
    }

    if (this.dynamicReloadTimer) {
      clearTimeout(this.dynamicReloadTimer);
      this.dynamicReloadTimer = undefined;
    }

    this.dynamicReloadQueued = false;
    this.dynamicReloadInProgress = false;
  }

  private attachCurrentViewerListener() {
    this.detachCurrentViewerListener();

    const cesium = this.terria.cesium;
    if (cesium) {
      this.removeCesiumCameraChangedListener =
        cesium.scene.camera.changed.addEventListener(
          this.onDynamicViewportChanged
        );
      return;
    }
  }

  private detachCurrentViewerListener() {
    if (this.removeCesiumCameraChangedListener) {
      this.removeCesiumCameraChangedListener();
      this.removeCesiumCameraChangedListener = undefined;
    }

    if (this.removeLeafletMoveEndListener) {
      this.removeLeafletMoveEndListener();
      this.removeLeafletMoveEndListener = undefined;
    }
  }

  private queueDynamicReload(immediate = false) {
    if (this.dynamicReloadTimer) {
      clearTimeout(this.dynamicReloadTimer);
      this.dynamicReloadTimer = undefined;
    }

    const debounceMs = immediate
      ? 0
      : RER_POI_DEFAULT_DYNAMIC_REQUEST_DEBOUNCE_MS;

    this.dynamicReloadTimer = setTimeout(() => {
      this.dynamicReloadTimer = undefined;
      void this.reloadDynamicViewportData();
    }, debounceMs);
  }

  private async reloadDynamicViewportData() {
    if (!this.show) {
      return;
    }

    const nextQuery = this.getDynamicViewportQuery();
    if (!nextQuery) {
      return;
    }

    if (
      this.activeDynamicQuery &&
      this.activeDynamicQuery.filterKey === nextQuery.filterKey &&
      rectangleContains(
        this.activeDynamicQuery.queryRectangle,
        nextQuery.queryRectangle
      )
    ) {
      return;
    }

    if (this.dynamicReloadInProgress || this.isLoadingMapItems) {
      this.dynamicReloadQueued = true;
      return;
    }

    this.dynamicReloadInProgress = true;
    try {
      (await this.loadMapItems(true)).logError(
        "Failed to reload RerPoi dynamic viewport data"
      );
    } finally {
      this.dynamicReloadInProgress = false;
      if (this.dynamicReloadQueued) {
        this.dynamicReloadQueued = false;
        this.queueDynamicReload(true);
      }
    }
  }

  protected async forceLoadMetadata(): Promise<void> {
    if (this.strata.get(ArcGisFeatureServerStratum.stratumName) === undefined) {
      const stratum = await ArcGisFeatureServerStratum.load(this as any);
      runInAction(() => {
        this.strata.set(ArcGisFeatureServerStratum.stratumName, stratum);
      });
    }
  }

  protected async forceLoadGeojsonData(): Promise<FeatureGeoJson> {
    if (this.tileRequests) return featureCollection([]);

    const dynamicQuery = this.getDynamicViewportQuery();

    if (!dynamicQuery) {
      this.activeDynamicQuery = undefined;
      return featureCollection([]);
    }

    if (dynamicQuery) {
      const cachedEntry = this.findCachedDynamicQuery(dynamicQuery);
      if (cachedEntry) {
        this.activeDynamicQuery = {
          ...dynamicQuery,
          requestKey: cachedEntry.requestKey,
          queryRectangle: Rectangle.clone(cachedEntry.queryRectangle)
        };
        return cachedEntry.geoJson;
      }

      const inFlightRequest = this.dynamicInFlightRequests.get(
        dynamicQuery.requestKey
      );
      if (inFlightRequest) {
        const geoJson = await inFlightRequest;
        this.activeDynamicQuery = dynamicQuery;
        return geoJson;
      }
    } else {
      this.activeDynamicQuery = undefined;
    }

    const loadPromise = this.loadGeoJsonFromServer(
      dynamicQuery?.requestOptions
    );

    if (dynamicQuery) {
      this.dynamicInFlightRequests.set(dynamicQuery.requestKey, loadPromise);
    }

    try {
      const geoJson = await loadPromise;

      if (dynamicQuery) {
        this.cacheDynamicQuery(dynamicQuery, geoJson);
        this.activeDynamicQuery = dynamicQuery;
      }

      return geoJson;
    } finally {
      if (dynamicQuery) {
        this.dynamicInFlightRequests.delete(dynamicQuery.requestKey);
      }
    }
  }

  protected async loadGeoJsonFromServer(
    queryOptions?: EsriJsonQueryOptions
  ): Promise<FeatureGeoJson> {
    const getEsriLayerJson = async (resultOffset?: number) => {
      const url = proxyCatalogItemUrl(
        this,
        this.buildEsriJsonUrl({
          ...queryOptions,
          resultOffset
        })
          .throwIfUndefined()
          .toString()
      );
      return await loadJson(url);
    };

    if (!this.supportsPagination) {
      return (
        featureDataToGeoJson(await getEsriLayerJson()) ?? {
          type: "FeatureCollection",
          features: []
        }
      );
    }

    const featuresPerRequest = this.featuresPerRequest;
    const maxFeatures = this.maxFeatures;
    const combinedEsriLayerJson = await getEsriLayerJson(0);
    combinedEsriLayerJson.features = combinedEsriLayerJson.features ?? [];

    const mapObjectIds = (features: any[]) =>
      features
        .map((feature: any) => this.getFeatureObjectId(feature))
        .filter((id): id is string => isDefined(id));

    const seenIDs: Set<string> = new Set(
      mapObjectIds(combinedEsriLayerJson.features)
    );

    let currentOffset = 0;
    let exceededTransferLimit = combinedEsriLayerJson.exceededTransferLimit;
    while (
      combinedEsriLayerJson.features.length <= maxFeatures &&
      exceededTransferLimit === true
    ) {
      currentOffset += featuresPerRequest;
      const newEsriLayerJson = await getEsriLayerJson(currentOffset);
      if (
        newEsriLayerJson.features === undefined ||
        newEsriLayerJson.features.length === 0
      ) {
        break;
      }

      const newIds: string[] = mapObjectIds(newEsriLayerJson.features);

      if (newIds.length > 0 && newIds.every((id) => seenIDs.has(id))) {
        break;
      }

      newIds.forEach((id) => seenIDs.add(id));
      combinedEsriLayerJson.features = combinedEsriLayerJson.features.concat(
        newEsriLayerJson.features
      );
      exceededTransferLimit = newEsriLayerJson.exceededTransferLimit;

      if (exceededTransferLimit) {
        console.log("warning: exceeded transfer limit");
      }
    }

    return (
      featureDataToGeoJson(combinedEsriLayerJson) ?? {
        type: "FeatureCollection",
        features: []
      }
    );
  }

  private getDynamicViewportQuery(): DynamicViewportQuery | undefined {
    if (this.terria.currentViewer.type === "none") {
      return undefined;
    }

    const currentViewRectangle =
      this.terria.currentViewer.getCurrentCameraView().rectangle;

    const currentCameraHeight = this.getCurrentCameraHeight();

    const adaptedViewRectangle =
      isDefined(currentCameraHeight) &&
      currentCameraHeight <= RER_POI_NEAR_CAMERA_HEIGHT_THRESHOLD
        ? scaleRectangleFromCenter(
            currentViewRectangle,
            RER_POI_DEFAULT_NEAR_CAMERA_BBOX_SCALE
          )
        : Rectangle.clone(currentViewRectangle);

    const queryRectangle = rectangleWithPadding(
      adaptedViewRectangle,
      RER_POI_DEFAULT_QUERY_BBOX_PADDING_RATIO
    );

    if (!queryRectangle || rectangleArea(queryRectangle) <= 0) {
      return undefined;
    }

    const levelFilter = this.getLevelFilterForViewport(currentViewRectangle);
    const requestKey = `${levelFilter.filterKey}|${rectangleToBounds(
      queryRectangle
    )}`;

    return {
      requestKey,
      filterKey: levelFilter.filterKey,
      queryRectangle,
      requestOptions: {
        bbox: queryRectangle,
        minLevelId: levelFilter.minLevelId,
        maxLevelId: levelFilter.maxLevelId
      }
    };
  }

  private getLevelFilterForViewport(viewRectangle: Rectangle) {
    const minLevelId = RER_POI_MIN_LEVEL_ID;
    let maxLevelId = RER_POI_MAX_LEVEL_ID;

    const isOverviewByCoverage =
      this.getDatasetCoverageRatio(viewRectangle) >=
      RER_POI_DEFAULT_NEAR_CAMERA_BBOX_SCALE;
    const currentCameraHeight = this.getCurrentCameraHeight();
    const isOverviewByHeight =
      isDefined(currentCameraHeight) &&
      currentCameraHeight >= RER_POI_PROGRESSIVE_FAR_CAMERA_HEIGHT;

    if (isOverviewByCoverage || isOverviewByHeight) {
      maxLevelId = RER_POI_MIN_LEVEL_ID;
    }

    if (
      isDefined(minLevelId) &&
      isDefined(maxLevelId) &&
      maxLevelId < minLevelId
    ) {
      maxLevelId = minLevelId;
    }

    if (
      isDefined(minLevelId) &&
      isDefined(maxLevelId) &&
      maxLevelId > minLevelId &&
      isDefined(currentCameraHeight)
    ) {
      const selectedLevelId = this.getProgressiveLevelIdFromHeight(
        currentCameraHeight,
        minLevelId,
        maxLevelId
      );
      maxLevelId = selectedLevelId;
    }

    return {
      minLevelId,
      maxLevelId,
      filterKey: [
        this.where,
        RER_POI_LEVEL_ID_FIELD,
        minLevelId ?? "",
        maxLevelId ?? ""
      ].join("|")
    };
  }

  private getProgressiveLevelIdFromHeight(
    cameraHeight: number,
    minimumLevelId: number,
    maximumLevelId: number
  ) {
    const clampedHeight = CesiumMath.clamp(
      cameraHeight,
      RER_POI_PROGRESSIVE_NEAR_CAMERA_HEIGHT,
      RER_POI_PROGRESSIVE_FAR_CAMERA_HEIGHT
    );

    const zoomRatio =
      1 -
      (clampedHeight - RER_POI_PROGRESSIVE_NEAR_CAMERA_HEIGHT) /
        (RER_POI_PROGRESSIVE_FAR_CAMERA_HEIGHT -
          RER_POI_PROGRESSIVE_NEAR_CAMERA_HEIGHT);

    const totalLevels = maximumLevelId - minimumLevelId;
    const continuousLevel = minimumLevelId + zoomRatio * totalLevels;
    const step = Math.max(1, Math.floor(RER_POI_PROGRESSIVE_LEVEL_STEP));
    const steppedLevel =
      minimumLevelId +
      Math.floor((continuousLevel - minimumLevelId) / step) * step;

    return CesiumMath.clamp(steppedLevel, minimumLevelId, maximumLevelId);
  }

  private getDatasetCoverageRatio(viewRectangle: Rectangle): number {
    if (!this.cesiumRectangle) {
      return 0;
    }

    const intersection = Rectangle.intersection(
      viewRectangle,
      this.cesiumRectangle,
      new Rectangle()
    );
    if (!intersection) {
      return 0;
    }

    const datasetArea = rectangleArea(this.cesiumRectangle);
    if (datasetArea <= 0) {
      return 0;
    }

    return rectangleArea(intersection) / datasetArea;
  }

  private getCurrentCameraHeight(): number | undefined {
    const currentView = this.terria.currentViewer.getCurrentCameraView();
    if (!currentView.position) {
      return undefined;
    }

    const position = Cartographic.fromCartesian(currentView.position);
    return position?.height;
  }

  private findCachedDynamicQuery(
    query: DynamicViewportQuery
  ): DynamicViewportCacheEntry | undefined {
    let bestMatch: DynamicViewportCacheEntry | undefined;

    this.dynamicViewportCache.forEach((entry) => {
      if (entry.filterKey !== query.filterKey) {
        return;
      }

      if (!rectangleContains(entry.queryRectangle, query.queryRectangle)) {
        return;
      }

      if (
        !bestMatch ||
        rectangleArea(entry.queryRectangle) <
          rectangleArea(bestMatch.queryRectangle)
      ) {
        bestMatch = entry;
      }
    });

    if (bestMatch) {
      bestMatch.lastAccess = Date.now();
    }

    return bestMatch;
  }

  private cacheDynamicQuery(
    query: DynamicViewportQuery,
    geoJson: FeatureGeoJson
  ) {
    this.dynamicViewportCache.set(query.requestKey, {
      requestKey: query.requestKey,
      filterKey: query.filterKey,
      queryRectangle: Rectangle.clone(query.queryRectangle),
      geoJson,
      lastAccess: Date.now()
    });

    this.trimDynamicCache();
  }

  private trimDynamicCache() {
    if (
      this.dynamicViewportCache.size <=
      RER_POI_DEFAULT_DYNAMIC_CACHE_MAX_ENTRIES
    ) {
      return;
    }

    const entriesByAge = Array.from(this.dynamicViewportCache.values()).sort(
      (a, b) => a.lastAccess - b.lastAccess
    );
    const countToDelete =
      this.dynamicViewportCache.size -
      RER_POI_DEFAULT_DYNAMIC_CACHE_MAX_ENTRIES;

    for (let i = 0; i < countToDelete; i++) {
      this.dynamicViewportCache.delete(entriesByAge[i].requestKey);
    }
  }

  @computed get imageryProvider() {
    if (!this.strata.has(ArcGisFeatureServerStratum.stratumName)) {
      return undefined;
    }

    const { paintRules, labelRules } = tableStyleToProtomaps(this, false, true);

    const uri = this.buildEsriJsonUrl().logError(
      "Failed to create valid FeatureServer URL"
    );

    if (!uri) return;

    const url = proxyCatalogItemUrl(this, uri.toString());

    let provider = new ProtomapsImageryProvider({
      maximumZoom: this.getMaximumLevel(false),
      minimumZoom: this.getMinimumLevel(false),
      terria: this.terria,
      data: new ProtomapsArcGisPbfSource({
        url: url,
        outFields: [...this.outFields],
        featuresPerTileRequest: this.featuresPerTileRequest,
        maxRecordCountFactor: this.maxRecordCountFactor,
        maxTiledFeatures: this.maxTiledFeatures,
        tilingScheme: new WebMercatorTilingScheme(),
        enablePickFeatures: this.allowFeaturePicking,
        objectIdField: this.objectIdField,
        supportsQuantization: this.supportsQuantization
      }),
      id: this.uniqueId,
      paintRules,
      labelRules
    });

    provider = this.wrapImageryPickFeatures(provider);
    provider = this.updateRequestImage(provider);

    return provider;
  }

  @override
  get mapItems() {
    if (!this.tileRequests) {
      return super.mapItems;
    }

    if (!this.imageryProvider) return [];

    return [
      {
        imageryProvider: this.imageryProvider,
        show: this.show,
        alpha: this.opacity,
        clippingRectangle: this.clipToRectangle
          ? this.cesiumRectangle
          : undefined
      }
    ];
  }

  @override
  get dataColumnMajor() {
    if (super.dataColumnMajor.length > 0) {
      return super.dataColumnMajor;
    }

    return this.columns.map((column) => [column.name ?? ""]);
  }

  buildEsriJsonUrl(options?: number | EsriJsonQueryOptions) {
    const queryOptions =
      typeof options === "number" ? { resultOffset: options } : options;

    const url = cleanUrl(this.url || "0d");
    const layerId = /^(.*(?:FeatureServer|MapServer))\/(\d+)/.exec(url)?.[2];

    if (!layerId) {
      return Result.error(
        networkRequestError({
          title: {
            key: "models.arcGisFeatureServerCatalogItem.invalidServiceTitle"
          },
          message: {
            key: "models.arcGisFeatureServerCatalogItem.invalidServiceMessage"
          }
        })
      );
    }

    const levelFilter = this.buildLevelFilterClause(
      queryOptions?.minLevelId,
      queryOptions?.maxLevelId
    );

    const combinedWhere = [this.where, levelFilter]
      .filter(
        (clause): clause is string => isDefined(clause) && clause.length > 0
      )
      .map((clause) => `(${clause})`)
      .join(" AND ");

    const uri = new URI(url)
      .segment("query")
      .addQuery("f", "json")
      .addQuery("where", combinedWhere.length > 0 ? combinedWhere : "1=1")
      .addQuery("outFields", "*")
      .addQuery("outSR", "4326");

    if (queryOptions?.bbox) {
      uri
        .addQuery("geometry", rectangleToBounds(queryOptions.bbox))
        .addQuery("geometryType", "esriGeometryEnvelope")
        .addQuery("inSR", "4326")
        .addQuery("spatialRel", "esriSpatialRelIntersects")
        .addQuery("returnGeometry", "true");
    }

    if (this.token) {
      uri.addQuery("token", this.token);
    }

    if (queryOptions?.resultOffset !== undefined) {
      uri
        .addQuery("resultRecordCount", this.featuresPerRequest)
        .addQuery("resultOffset", queryOptions.resultOffset);
    }

    return new Result(uri);
  }

  private getFeatureObjectId(feature: any): string | undefined {
    return (
      feature.attributes?.[this.objectIdField] ??
      feature.attributes?.OBJECTID ??
      feature.attributes?.objectid
    );
  }

  private buildLevelFilterClause(
    minLevelId: number | undefined,
    maxLevelId: number | undefined
  ): string | undefined {
    const levelField = RER_POI_LEVEL_ID_FIELD;
    if (!levelField) {
      return undefined;
    }

    if (isDefined(minLevelId) && isDefined(maxLevelId)) {
      if (minLevelId === maxLevelId) {
        return `${levelField} = ${minLevelId}`;
      }

      return `${levelField} >= ${minLevelId} AND ${levelField} <= ${maxLevelId}`;
    }

    if (isDefined(minLevelId)) {
      return `${levelField} >= ${minLevelId}`;
    }

    if (isDefined(maxLevelId)) {
      return `${levelField} <= ${maxLevelId}`;
    }

    return undefined;
  }
}

function rectangleWithPadding(rectangle: Rectangle, paddingRatio: number) {
  const width = Rectangle.computeWidth(rectangle);
  const height = Rectangle.computeHeight(rectangle);

  const safePaddingRatio = Math.max(0, paddingRatio);
  const lonPadding = width * safePaddingRatio;
  const latPadding = height * safePaddingRatio;

  const west = CesiumMath.clamp(rectangle.west - lonPadding, -Math.PI, Math.PI);
  const east = CesiumMath.clamp(rectangle.east + lonPadding, -Math.PI, Math.PI);
  const south = CesiumMath.clamp(
    rectangle.south - latPadding,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO
  );
  const north = CesiumMath.clamp(
    rectangle.north + latPadding,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO
  );

  return new Rectangle(west, south, east, north);
}

function rectangleArea(rectangle: Rectangle) {
  return Rectangle.computeWidth(rectangle) * Rectangle.computeHeight(rectangle);
}

function rectangleContains(container: Rectangle, value: Rectangle) {
  return (
    container.west <= value.west &&
    container.south <= value.south &&
    container.east >= value.east &&
    container.north >= value.north
  );
}

function rectangleToBounds(rectangle: Rectangle) {
  return [
    CesiumMath.toDegrees(rectangle.west),
    CesiumMath.toDegrees(rectangle.south),
    CesiumMath.toDegrees(rectangle.east),
    CesiumMath.toDegrees(rectangle.north)
  ].join(",");
}

function scaleRectangleFromCenter(rectangle: Rectangle, scale: number) {
  const safeScale = CesiumMath.clamp(scale, 0.01, 1);
  if (safeScale >= 1) {
    return Rectangle.clone(rectangle);
  }

  const center = Rectangle.center(rectangle, new Cartographic());
  const halfWidth = (Rectangle.computeWidth(rectangle) * safeScale) / 2;
  const halfHeight = (Rectangle.computeHeight(rectangle) * safeScale) / 2;

  const west = CesiumMath.clamp(
    center.longitude - halfWidth,
    -Math.PI,
    Math.PI
  );
  const east = CesiumMath.clamp(
    center.longitude + halfWidth,
    -Math.PI,
    Math.PI
  );
  const south = CesiumMath.clamp(
    center.latitude - halfHeight,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO
  );
  const north = CesiumMath.clamp(
    center.latitude + halfHeight,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO
  );

  return new Rectangle(west, south, east, north);
}

function cleanUrl(url: string): string {
  const uri = new URI(url);
  uri.search("");
  return uri.toString();
}
