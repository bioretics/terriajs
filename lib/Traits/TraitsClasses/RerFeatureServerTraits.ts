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
    description:
      "Valore minimo del range di zoom in cui usare questa classe di etichette"
  })
  levelMin: number = 7;

  @primitiveTrait({
    type: "number",
    name: "levelMax",
    description:
      "Valore massimo del range di zoom in cui usare questa classe di etichette"
  })
  levelMax: number = 16;

  @primitiveTrait({
    type: "string",
    name: "labelField",
    description: ""
  })
  labelField: string =
    "Nome del campo della proprietà da usare come testo dell'etichetta";

  @primitiveTrait({
    type: "boolean",
    name: "show",
    description:
      "Indica se le etichette di questa classe devono essere mostrate o nascoste"
  })
  show: boolean = true;

  @primitiveTrait({
    type: "string",
    name: "font",
    description: "Il font delle etichette di questa classe"
  })
  font: string = "";

  @primitiveTrait({
    type: "string",
    name: "fillColor",
    description: "Il colore del testo delle etichette di questa classe"
  })
  fillColor: string = "red";

  @primitiveTrait({
    type: "string",
    name: "backgroundColor",
    description: "Il colore dello sfondo delle etichette di questa classe"
  })
  backgroundColor: string = "transparent";
}

export class RerDistanceShowFilterTraits extends ModelTraits {
  @primitiveTrait({
    type: "number",
    name: "level",
    description:
      "Valore della proprietà definita dal campo <levelField> a cui si applica questa regola"
  })
  level: number = 0;

  @primitiveTrait({
    type: "number",
    name: "distance",
    description:
      "La distanza massima fra feature e camera (in metri) oltre la quale la feature viene nascosta"
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
    description:
      "Angolo (in gradi) sotto il quale la camera è considerata 'tilted', deve essere maggiore di <cameraLandedAngle>"
  })
  cameraTiltedAngle: number = 45;

  @primitiveTrait({
    type: "number",
    name: "cameraLandedAngle",
    description:
      "Angolo (in gradi) sotto il quale la camera è considerata 'landed', deve essere inferiore a <cameraTiltedAngle>"
  })
  cameraLandedAngle: number = 25;

  @primitiveTrait({
    type: "boolean",
    name: "hideFeaturesIfLanded",
    description:
      "Se 'true', le feature di questo dataset vanno nascoste quando la camera è 'landed'"
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
    description:
      "Array che permette di indicare per ogni livello la distanza massima di visualizzazione",
    idProperty: "level"
  })
  tiltedDisplayDistanceCondition: RerDistanceShowFilterTraits[] = [];
}

export default class RerFeatureServerTraits extends ModelTraits {
  @primitiveTrait({
    type: "boolean",
    name: "Append data",
    description:
      "Se 'true', i nuovi dati vengono aggiunti al dataset invece di sostituire quelli precedenti"
  })
  appendData: boolean = false;

  @primitiveTrait({
    type: "string",
    name: "levelField",
    description: "Il campo della feature da cui leggere il suo livello"
  })
  levelField: string = "";

  @primitiveTrait({
    type: "number",
    name: "levelMax",
    description: "Il livello massimo atteso delle features del dataset"
  })
  levelMax: number = 16;

  @primitiveTrait({
    type: "number",
    name: "levelMin",
    description: "Il livello minimo atteso delle features del dataset"
  })
  levelMin: number = 7;

  @objectTrait({
    type: RerFeatureShowFilterTraits,
    name: "displayFilter",
    description:
      "Definisce le regole di visualizzazione delle features del dataset"
  })
  displayFilter?: RerFeatureShowFilterTraits;

  @objectArrayTrait({
    type: RerLabelTraits,
    name: "labels",
    description:
      "Definisce la visualizzazione e lo stile delle etichette delle features del dataset",
    idProperty: "levelMin"
  })
  labels: RerLabelTraits[] = [];

  @objectTrait({
    type: StyleTraits,
    name: "Style",
    description:
      "Stilizzazione usando le regole di [simplestyle-spec](https://github.com/mapbox/simplestyle-spec)"
  })
  style?: StyleTraits;

  @objectArrayTrait({
    name: "Per property styles",
    type: PerPropertyGeoJsonStyleTraits,
    description:
      "Sovrascrive lo stile delle singole feature in base alle proprietà",
    idProperty: "index"
  })
  perPropertyStyles: PerPropertyGeoJsonStyleTraits[] = [];

  @anyTrait({
    name: "drawingInfo",
    description:
      "Stilizzazione usando le regole di [ESRI ArcGis drawingInfo](https://developers.arcgis.com/web-map-specification/objects/drawingInfo/)"
  })
  drawingInfo: any;
}
