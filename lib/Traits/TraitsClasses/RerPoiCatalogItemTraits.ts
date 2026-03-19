import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import ArcGisFeatureServerCatalogItemTraits from "./ArcGisFeatureServerCatalogItemTraits";
import {
  RER_POI_CATALOG_ITEM_TYPE,
  RER_POI_DEFAULT_NAME,
  RER_POI_USER_TRAITS
} from "../../ModelMixins/RerPoiHelpers";

@traitClass({
  description:
    "Specialized ArcGIS Feature Server catalog item for Regione Emilia-Romagna RER3D POI dynamic loading.",
  example: {
    url: "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0",
    type: RER_POI_CATALOG_ITEM_TYPE,
    name: RER_POI_DEFAULT_NAME,
    id: "rer3d-poi"
  }
})
export default class RerPoiCatalogItemTraits extends ArcGisFeatureServerCatalogItemTraits {
  tileRequests: boolean = RER_POI_USER_TRAITS.tileRequests;
  forceCesiumPrimitives: boolean = RER_POI_USER_TRAITS.forceCesiumPrimitives;

  @primitiveTrait({
    type: "boolean",
    name: "Dynamic viewport requests",
    description:
      "If true, requests are dynamically constrained to the current map viewport (with optional padding/cache) and are refreshed when the camera/viewport changes."
  })
  dynamicViewportRequests: boolean =
    RER_POI_USER_TRAITS.dynamicViewportRequests;

  @primitiveTrait({
    type: "number",
    name: "Viewport query bbox padding ratio",
    description:
      "Extra padding applied to the viewport bbox before querying (for preloading nearby features). For example 0.25 adds 25% on each side."
  })
  queryBboxPaddingRatio: number = RER_POI_USER_TRAITS.queryBboxPaddingRatio;

  @primitiveTrait({
    type: "number",
    name: "Dynamic cache max entries",
    description:
      "Maximum number of cached viewport query windows kept in memory for dynamic viewport requests."
  })
  dynamicCacheMaxEntries: number = RER_POI_USER_TRAITS.dynamicCacheMaxEntries;

  @primitiveTrait({
    type: "number",
    name: "Dynamic request debounce (ms)",
    description:
      "Debounce in milliseconds applied to camera/viewport movement before re-querying data in dynamic viewport mode."
  })
  dynamicRequestDebounceMs: number =
    RER_POI_USER_TRAITS.dynamicRequestDebounceMs;

  @primitiveTrait({
    type: "string",
    name: "Level id field",
    description:
      "Optional numeric field used for importance filtering (for example LEVEL_ID where lower values are more important)."
  })
  levelIdField: string = RER_POI_USER_TRAITS.levelIdField;

  @primitiveTrait({
    type: "number",
    name: "Minimum level id",
    description:
      "Minimum LEVEL_ID (inclusive) to request when levelIdField is defined."
  })
  minimumLevelId: number = RER_POI_USER_TRAITS.minimumLevelId;

  @primitiveTrait({
    type: "number",
    name: "Maximum level id",
    description:
      "Maximum LEVEL_ID (inclusive) to request when levelIdField is defined."
  })
  maximumLevelId: number = RER_POI_USER_TRAITS.maximumLevelId;

  @primitiveTrait({
    type: "number",
    name: "Overview maximum level id",
    description:
      "Maximum LEVEL_ID (inclusive) used for overview-scale views (for example whole-region)."
  })
  overviewMaximumLevelId: number = RER_POI_USER_TRAITS.overviewMaximumLevelId;

  @primitiveTrait({
    type: "number",
    name: "Overview region coverage threshold",
    description:
      "If the visible camera rectangle covers at least this fraction of the dataset rectangle, overview filtering is applied."
  })
  overviewRegionCoverageThreshold: number =
    RER_POI_USER_TRAITS.overviewRegionCoverageThreshold;

  @primitiveTrait({
    type: "number",
    name: "Overview camera height",
    description:
      "Optional camera height threshold in meters for enabling overview filtering in Cesium 3D."
  })
  overviewCameraHeight: number = RER_POI_USER_TRAITS.overviewCameraHeight;

  @primitiveTrait({
    type: "number",
    name: "Near camera height threshold",
    description:
      "If set, and the Cesium camera height is below this threshold (meters), viewport query bbox will be reduced around the camera view center."
  })
  nearCameraHeightThreshold: number =
    RER_POI_USER_TRAITS.nearCameraHeightThreshold;

  @primitiveTrait({
    type: "number",
    name: "Near camera bbox scale",
    description:
      "Scale factor (0..1] applied to viewport bbox when camera height is below nearCameraHeightThreshold. Smaller values request a tighter area around the camera view."
  })
  nearCameraBboxScale: number = RER_POI_USER_TRAITS.nearCameraBboxScale;

  @primitiveTrait({
    type: "boolean",
    name: "Progressive level loading",
    description:
      "If true, dynamic viewport requests will load only one LEVEL_ID at a time based on camera height, progressively increasing detail while zooming in."
  })
  progressiveLevelLoading: boolean =
    RER_POI_USER_TRAITS.progressiveLevelLoading;

  @primitiveTrait({
    type: "number",
    name: "Progressive far camera height",
    description:
      "Camera height in meters corresponding to the coarsest level (minimumLevelId) for progressive level loading."
  })
  progressiveFarCameraHeight: number =
    RER_POI_USER_TRAITS.progressiveFarCameraHeight;

  @primitiveTrait({
    type: "number",
    name: "Progressive near camera height",
    description:
      "Camera height in meters corresponding to the finest level (maximumLevelId) for progressive level loading."
  })
  progressiveNearCameraHeight: number =
    RER_POI_USER_TRAITS.progressiveNearCameraHeight;

  @primitiveTrait({
    type: "number",
    name: "Progressive level step",
    description:
      "Step size for progressive LEVEL_ID transitions (1 means one level at a time)."
  })
  progressiveLevelStep: number = RER_POI_USER_TRAITS.progressiveLevelStep;
}
