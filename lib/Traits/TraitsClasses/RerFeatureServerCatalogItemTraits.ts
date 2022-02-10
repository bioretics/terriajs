import primitiveTrait from "../Decorators/primitiveTrait";
import primitiveArrayTrait from "../Decorators/primitiveArrayTrait";
import objectTrait from "../Decorators/objectTrait";
import objectArrayTrait from "../Decorators/objectArrayTrait";
import anyTrait from "../Decorators/anyTrait";
import ModelTraits from "../ModelTraits";
import mixTraits from "../mixTraits";
import { PerPropertyGeoJsonStyleTraits } from "./GeoJsonTraits";
import StyleTraits from "./StyleTraits";

export class RerLabelTraits extends ModelTraits {
  @primitiveTrait({
    type: "number",
    name: "levelMin",
    description: ""
  })
  levelMin: number = 7;

  @primitiveTrait({
    type: "number",
    name: "levelMax",
    description: ""
  })
  levelMax: number = 16;

  @primitiveTrait({
    type: "string",
    name: "labelField",
    description: ""
  })
  labelField: string = "";

  @primitiveTrait({
    type: "boolean",
    name: "show",
    description: ""
  })
  show: boolean = true;

  @primitiveTrait({
    type: "string",
    name: "font",
    description: ""
  })
  font: string = "";

  @primitiveTrait({
    type: "string",
    name: "fillColor",
    description: ""
  })
  fillColor: string = "red";

  @primitiveTrait({
    type: "string",
    name: "backgroundColor",
    description: ""
  })
  backgroundColor: string = "transparent";
}

export class RerDistanceShowFilterTraits extends ModelTraits {
  @primitiveTrait({
    type: "number",
    name: "level",
    description: ""
  })
  level: number = 0;

  @primitiveTrait({
    type: "number",
    name: "distance",
    description: ""
  })
  distance: number = 0;

  /*@primitiveTrait({
    type: "number",
    name: "distanceWhenIsPitch",
    description:
      ""
  })
  distanceWhenIsPitch: number = 0;*/
}

export class RerFeatureShowFilterTraits extends ModelTraits {
  /*@primitiveTrait({
    type: "string",
    name: "filter",
    description:
      ""
  })
  filter: "DISABLED" | "BY_NEARNESS" | "BY_DISTANCE" = "DISABLED";*/

  @primitiveTrait({
    type: "number",
    name: "cameraTiltedAngle",
    description: ""
  })
  cameraTiltedAngle: number = 45;

  @primitiveTrait({
    type: "number",
    name: "cameraLandedAngle",
    description: ""
  })
  cameraLandedAngle: number = 25;

  @primitiveTrait({
    type: "boolean",
    name: "hideFeaturesIfLanded",
    description: ""
  })
  hideFeaturesIfLanded: boolean = true;

  /*@primitiveArrayTrait({
    type: "number",
    name: "nearestPerLevel",
    description:
      ""
  })
  nearestPerLevel: number[] = [];*/

  @objectArrayTrait({
    type: RerDistanceShowFilterTraits,
    name: "tiltedDisplayDistanceCondition",
    description: "",
    idProperty: "level"
  })
  tiltedDisplayDistanceCondition: RerDistanceShowFilterTraits[] = [];
}

export default class RerFeatureServerCatalogItemTraits extends ModelTraits {
  @primitiveTrait({
    type: "boolean",
    name: "Append data",
    description:
      "If 'true' append new data to old, if 'false' instead of replace them"
  })
  appendData: boolean = false;

  @primitiveTrait({
    type: "string",
    name: "levelField",
    description: ""
  })
  levelField: string = "";

  @primitiveTrait({
    type: "number",
    name: "levelMax",
    description: ""
  })
  levelMax: number = 16;

  @primitiveTrait({
    type: "number",
    name: "levelMin",
    description: ""
  })
  levelMin: number = 7;

  @objectTrait({
    type: RerFeatureShowFilterTraits,
    name: "displayFilter",
    description: ""
  })
  displayFilter?: RerFeatureShowFilterTraits;

  @objectArrayTrait({
    type: RerLabelTraits,
    name: "labels",
    description: "",
    idProperty: "levelMin"
  })
  labels: RerLabelTraits[] = [];

  @objectTrait({
    type: StyleTraits,
    name: "Style",
    description:
      "Styling rules that follow [simplestyle-spec](https://github.com/mapbox/simplestyle-spec). If using geojson-vt/TableStyleTraits, then this style will be used as the default style (which will be overriden by TableStyleTraits). To disable TableStyleTraits, see `disableTableStyle`."
  })
  style?: StyleTraits;

  @objectArrayTrait({
    name: "Per property styles",
    type: PerPropertyGeoJsonStyleTraits,
    description:
      "Override feature styles according to their properties. This is only supported for cesium primitives (see `forceCesiumPrimitives`)",
    idProperty: "index"
  })
  perPropertyStyles: PerPropertyGeoJsonStyleTraits[] = [];

  @anyTrait({
    name: "drawingInfo",
    description: ""
  })
  drawingInfo: any;
}
