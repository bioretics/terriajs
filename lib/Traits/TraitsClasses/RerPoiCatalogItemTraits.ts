import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import mixTraits from "../mixTraits";
import ArcGisFeatureServerCatalogItemTraits from "./ArcGisFeatureServerCatalogItemTraits";

@traitClass({
  description: `Creates a single item in the catalog from RER3D POI (Regione Emilia-Romagna 3D Points of Interest) service.

This specialized feature server item provides dynamic viewport-based loading and custom styling for POI layers,
with zoom-level aware filtering and support for domain-based icon/color mapping.`,
  example: {
    url: "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0",
    type: "rer-poi",
    name: "RER POI",
    id: "rer-poi"
  }
})
export default class RerPoiCatalogItemTraits extends mixTraits(
  ArcGisFeatureServerCatalogItemTraits
) {
  @primitiveTrait({
    type: "boolean",
    name: "Show debug bounding box",
    description:
      "Whether to display the camera viewport and padded query bounding boxes on the map."
  })
  showDebugBBox: boolean = false;

  @primitiveTrait({
    type: "string",
    name: "Name field",
    description:
      "The name of the feature attribute field that contains the POI name."
  })
  nameField: string = "NOME";

  @primitiveTrait({
    type: "boolean",
    name: "Show labels",
    description: "Whether to show labels for POI markers."
  })
  showLabels: boolean = false;

  @primitiveTrait({
    type: "number",
    name: "Label visibility threshold",
    description:
      "When the number of visible POIs on screen is below this threshold, labels are shown. Above this threshold, labels are hidden for performance."
  })
  labelVisibilityThreshold: number = 100;

  @primitiveTrait({
    type: "string",
    name: "Label text color",
    description: "The color of the label text for POI markers."
  })
  labelTextColor: string = "#ffffff";

  @primitiveTrait({
    type: "number",
    name: "Label font size",
    description: "The font size in pixels for POI marker labels."
  })
  labelFontSize: number = 12;

  @primitiveTrait({
    type: "number",
    name: "Label outline width",
    description: "The outline width in pixels for POI marker labels."
  })
  labelOutlineWidth: number = 3;

  @primitiveTrait({
    type: "string",
    name: "Label outline color",
    description: "The outline color for POI marker labels."
  })
  labelOutlineColor: string = "rgba(0, 0, 0, 0.65)";

  @primitiveTrait({
    type: "string",
    name: "Level ID field",
    description:
      "The name of the feature attribute field that contains the zoom level ID."
  })
  levelIdField: string = "LEVEL_ID";

  @primitiveTrait({
    type: "number",
    name: "Minimum level ID",
    description:
      "The minimum zoom level ID to request from the service. Lower values represent farther zoom levels. If not specified, it is read from the service on load, by querying the distinct values of the level ID field."
  })
  minLevelId?: number;

  @primitiveTrait({
    type: "number",
    name: "Maximum level ID",
    description:
      "The maximum zoom level ID to request from the service. Higher values represent closer zoom levels. If not specified, it is read from the service on load, by querying the distinct values of the level ID field."
  })
  maxLevelId?: number;

  @primitiveTrait({
    type: "number",
    name: "Level preload buffer",
    description:
      "In Cesium 3D only, how many extra LEVEL_ID steps above the highest currently rendered globe tile level to request from the service. Helps keep the next terrain refine level in cache. Ignored in Cesium 2D and Leaflet."
  })
  levelPreloadBuffer: number = 2;

  @primitiveTrait({
    type: "number",
    name: "Query bbox padding ratio",
    description:
      "The padding ratio to apply to the viewport rectangle when querying features. A value of 0.2 means 20% padding on each side."
  })
  queryBboxPaddingRatio: number = 0.2;

  @primitiveTrait({
    type: "number",
    name: "Dynamic request debounce (ms)",
    description:
      "The debounce time in milliseconds for viewport change requests. Prevents excessive server requests during camera movement."
  })
  dynamicRequestDebounceMs: number = 350;

  @primitiveTrait({
    type: "number",
    name: "Camera tilt limit (degrees)",
    description:
      "The maximum camera tilt angle in degrees. Applied when the RerPoi layer is shown to limit steep viewing angles."
  })
  cameraTiltLimitDegrees: number = 60;

  @primitiveTrait({
    type: "string",
    name: "Default marker color",
    description:
      "The color used for POI markers that no `perPropertyStyles` rule (or `marker-color` feature property) applies to. Accepts CSS color strings."
  })
  defaultMarkerColor: string = "royalblue";

  @primitiveTrait({
    type: "number",
    name: "Marker size (pixels)",
    description: "The size of marker icons in pixels."
  })
  markerSize: number = 48;

  @primitiveTrait({
    type: "number",
    name: "Icon stroke width",
    description: "The width of the stroke around icon symbols in pixels."
  })
  iconStrokeWidth: number = 1;

  @primitiveTrait({
    type: "string",
    name: "Icon stroke color",
    description:
      "The color of the stroke around icon symbols. Accepts CSS color strings."
  })
  iconStrokeColor: string = "#000000";
}

export const defaultRerPoiCatalogItemTraits = new RerPoiCatalogItemTraits();
