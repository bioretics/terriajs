import i18next from "i18next";
import { computed, runInAction, toJS } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import BillboardGraphics from "terriajs-cesium/Source/DataSources/BillboardGraphics";
import ColorMaterialProperty from "terriajs-cesium/Source/DataSources/ColorMaterialProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineDashMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineDashMaterialProperty";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import URI from "urijs";
import isDefined from "../../../Core/isDefined";
import loadJson from "../../../Core/loadJson";
import replaceUnderscores from "../../../Core/replaceUnderscores";
import TerriaError, { networkRequestError } from "../../../Core/TerriaError";
import featureDataToGeoJson from "../../../Map/featureDataToGeoJson";
import proj4definitions from "../../../Map/Proj4Definitions";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import ArcGisFeatureServerCatalogItemTraits from "../../../Traits/TraitsClasses/ArcGisFeatureServerCatalogItemTraits";
import { InfoSectionTraits } from "../../../Traits/TraitsClasses/CatalogMemberTraits";
import LegendTraits, {
  LegendItemTraits
} from "../../../Traits/TraitsClasses/LegendTraits";
import { RectangleTraits } from "../../../Traits/TraitsClasses/MappableTraits";
import CommonStrata from "../../Definition/CommonStrata";
import CreateModel from "../../Definition/CreateModel";
import createStratumInstance from "../../Definition/createStratumInstance";
import LoadableStratum from "../../Definition/LoadableStratum";
import { BaseModel } from "../../Definition/Model";
import StratumFromTraits from "../../Definition/StratumFromTraits";
import StratumOrder from "../../Definition/StratumOrder";
import GeoJsonCatalogItem from "../CatalogItems/GeoJsonCatalogItem";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import { getLineStyleCesium } from "./esriLineStyle";
import GeoJsonDataSource from "terriajs-cesium/Source/DataSources/GeoJsonDataSource";
import { RerLabelTraits } from "../../../Traits/TraitsClasses/RerFeatureServerTraits";
import DistanceDisplayCondition from "terriajs-cesium/Source/Core/DistanceDisplayCondition";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import VerticalOrigin from "terriajs-cesium/Source/Scene/VerticalOrigin";
import LabelGraphics from "terriajs-cesium/Source/DataSources/LabelGraphics";
import CesiumEvent from "terriajs-cesium/Source/Core/Event";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import { FeatureCollectionWithCrs } from "../../../ModelMixins/GeojsonMixin";

const proj4 = require("proj4").default;

interface DocumentInfo {
  Author?: string;
}

type esriStyleTypes =
  | "esriPMS" // simple picture style
  | "esriSMS" // simple marker style
  | "esriSLS" // simple line style
  | "esriSFS"; // simple fill style

//as defined https://developers.arcgis.com/web-map-specification/objects/esriSLS_symbol/

type supportedFillStyle =
  | "esriSFSSolid" // fill line with color
  | "esriSFSNull"; // no fill

// as defined https://developers.arcgis.com/web-map-specification/objects/esriSMS_symbol/
type supportedSimpleMarkerStyle =
  | "esriSMSCircle"
  | "esriSMSCross"
  | "esriSMSDiamond"
  | "esriSMSSquare"
  | "esriSMSTriangle"
  | "esriSMSX";

export type supportedLineStyle =
  | "esriSLSSolid" // solid line
  | "esriSLSDash" // dashes (-----)
  | "esriSLSDashDot" // line (-.-.-)
  | "esriSLSDashDotDot" // line (-..-..-)
  | "esriSLSDot" // dotted line (.....)
  | "esriSLSLongDash"
  | "esriSLSLongDashDot"
  | "esriSLSShortDash"
  | "esriSLSShortDashDot"
  | "esriSLSShortDashDotDot"
  | "esriSLSShortDot"
  | "esriSLSNull";

const defaultColor = [255, 255, 255, 255];
const defaultFillColor = [255, 255, 255, 1];
const defaultOutlineColor = [0, 0, 0, 255];

// See actual Symbol at https://developers.arcgis.com/web-map-specification/objects/symbol/
interface Symbol {
  contentType: string;
  color?: number[];
  outline?: Outline;
  imageData?: any;
  xoffset?: number;
  yoffset?: number;
  width?: number;
  height?: number;
  angle?: number;
  size?: number;
  type: esriStyleTypes;
  style?: supportedSimpleMarkerStyle | supportedLineStyle | supportedFillStyle;
}

interface Outline {
  type: esriStyleTypes;
  color: number[];
  width: number;
  style?: supportedLineStyle;
}

interface Renderer {
  type: string;
}

interface ClassBreakInfo extends SimpleRenderer {
  classMaxValue: number;
  classMinValue?: number;
}

interface ClassBreaksRenderer extends Renderer {
  field: string;
  classBreakInfos: ClassBreakInfo[];
  defaultSymbol: Symbol | null;
}

interface UniqueValueInfo extends SimpleRenderer {
  value: string;
}

interface UniqueValueRenderer extends Renderer {
  field1: string;
  field2?: string;
  field3?: string;
  fieldDelimiter?: string;
  uniqueValueInfos: UniqueValueInfo[];
  defaultSymbol: Symbol | null;
}

interface SimpleRenderer extends Renderer {
  label?: string;
  symbol: Symbol | null;
}

interface DrawingInfo {
  renderer: Renderer;
}

interface FeatureServer {
  documentInfo?: DocumentInfo;
  name?: string;
  description?: string;
  copyrightText?: string;
  drawingInfo?: DrawingInfo;
  extent?: Extent;
  maxScale?: number;
}

interface SpatialReference {
  wkid?: string;
  latestWkid?: string;
}

interface Extent {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference?: SpatialReference;
}

enum CameraPitchState {
  normal = 0,
  tilted = 1,
  landed = 2
}

class FeatureServerStratum extends LoadableStratum(
  ArcGisFeatureServerCatalogItemTraits
) {
  static stratumName = "featureServer";

  constructor(
    private readonly _item: ArcGisFeatureServerCatalogItem,
    private readonly _geoJsonItem: GeoJsonCatalogItem,
    private readonly _featureServer: FeatureServer,
    private _esriJson: any
  ) {
    super();
  }

  duplicateLoadableStratum(newModel: BaseModel): this {
    return new FeatureServerStratum(
      newModel as ArcGisFeatureServerCatalogItem,
      this._geoJsonItem,
      this._featureServer,
      this._esriJson
    ) as this;
  }

  get featureServerData(): FeatureServer {
    return this._featureServer;
  }

  get geoJsonItem(): GeoJsonCatalogItem {
    return this._geoJsonItem;
  }

  mergeData(newData: FeatureCollectionWithCrs) {
    this._geoJsonItem.setTrait(
      CommonStrata.user,
      "geoJsonData",
      newData as any
    );
  }

  static async load(item: ArcGisFeatureServerCatalogItem) {
    if (!isDefined(item.url) || !isDefined(item.uri)) {
      throw new TerriaError({
        title: i18next.t(
          "models.arcGisFeatureServerCatalogItem.missingUrlTitle"
        ),
        message: i18next.t(
          "models.arcGisFeatureServerCatalogItem.missingUrlMessage"
        )
      });
    }

    const geoJsonItem = new GeoJsonCatalogItem(createGuid(), item.terria);
    geoJsonItem.setTrait(
      CommonStrata.definition,
      "clampToGround",
      item.clampToGround
    );
    geoJsonItem.setTrait(
      CommonStrata.definition,
      "attribution",
      item.attribution
    );
    geoJsonItem.setTrait(
      CommonStrata.definition,
      "forceCesiumPrimitives",
      true
    );
    let tempEsriJson: any = null;
    const esriJson = await loadGeoJson(item);

    let isMapServerQuery = false;
    runInAction(() => {
      isMapServerQuery = item.isMapServerQuery;
    });

    const geoJsonData = featureDataToGeoJson(
      isMapServerQuery ? esriJson : esriJson.layers[0]
    );
    if (!geoJsonData) {
      throw TerriaError.from("Failed to convert ESRI json data into GeoJSON");
    }
    geoJsonItem.setTrait(
      CommonStrata.definition,
      "geoJsonData",
      geoJsonData as any
    );

    runInAction(() => {
      // Add appendData
      geoJsonItem.setTrait(
        CommonStrata.definition,
        "appendData",
        item.rerFeatureService.appendData as any
      );

      // Add style
      geoJsonItem.setTrait(
        CommonStrata.definition,
        "style",
        item.rerFeatureService.style as any
      );

      // Add perPropertyStyles
      geoJsonItem.setTrait(
        CommonStrata.definition,
        "perPropertyStyles",
        item.rerFeatureService.perPropertyStyles as any
      );
    });

    (await geoJsonItem.loadMetadata()).throwIfError();
    const featureServer = await loadMetadata(item);

    // Add drawingInfo Renderer
    runInAction(() => {
      if (
        !item.useStyleInformationFromService &&
        item.rerFeatureService.drawingInfo
      ) {
        featureServer.drawingInfo.renderer = toJS(
          item.rerFeatureService.drawingInfo
        );

        item.setTrait(
          CommonStrata.definition,
          "useStyleInformationFromService",
          true
        );
      }
    });

    const stratum = new FeatureServerStratum(
      item,
      geoJsonItem,
      featureServer,
      tempEsriJson
    );
    return stratum;
  }

  @computed
  get shortReport(): string | undefined {
    // Show notice if reached
    if (this._esriJson?.exceededTransferLimit) {
      return i18next.t(
        "models.arcGisFeatureServerCatalogItem.reachedMaxFeatureLimit",
        this
      );
    }
    return undefined;
  }

  @computed get maximumScale(): number | undefined {
    return this._featureServer.maxScale;
  }

  @computed get name(): string | undefined {
    if (this._featureServer.name && this._featureServer.name.length > 0) {
      return replaceUnderscores(this._featureServer.name);
    }
  }

  @computed get dataCustodian(): string | undefined {
    if (
      this._featureServer.documentInfo &&
      this._featureServer.documentInfo.Author &&
      this._featureServer.documentInfo.Author.length > 0
    ) {
      return this._featureServer.documentInfo.Author;
    }
  }

  @computed get rectangle(): StratumFromTraits<RectangleTraits> | undefined {
    const extent = this._featureServer.extent;
    const wkidCode =
      extent?.spatialReference?.latestWkid ?? extent?.spatialReference?.wkid;

    if (isDefined(extent) && isDefined(wkidCode)) {
      const wkid = "EPSG:" + wkidCode;
      if (!isDefined((proj4definitions as any)[wkid])) {
        return undefined;
      }

      const source = new proj4.Proj((proj4definitions as any)[wkid]);
      const dest = new proj4.Proj("EPSG:4326");

      let p = proj4(source, dest, [extent.xmin, extent.ymin]);

      const west = p[0];
      const south = p[1];

      p = proj4(source, dest, [extent.xmax, extent.ymax]);

      const east = p[0];
      const north = p[1];

      const rectangle = { west: west, south: south, east: east, north: north };
      return createStratumInstance(RectangleTraits, rectangle);
    }

    return undefined;
  }

  @computed get info() {
    return [
      createStratumInstance(InfoSectionTraits, {
        name: i18next.t("models.arcGisMapServerCatalogItem.dataDescription"),
        content: this._featureServer.description
      }),
      createStratumInstance(InfoSectionTraits, {
        name: i18next.t("models.arcGisMapServerCatalogItem.copyrightText"),
        content: this._featureServer.copyrightText
      })
    ];
  }

  @computed get legends(): StratumFromTraits<LegendTraits>[] | undefined {
    if (
      !this._item.useStyleInformationFromService ||
      !this._featureServer.drawingInfo
    ) {
      return undefined;
    }
    const renderer = this._featureServer.drawingInfo.renderer;
    const rendererType = renderer.type;
    let infos: SimpleRenderer[] | UniqueValueInfo[] | ClassBreakInfo[];

    if (rendererType === "uniqueValue") {
      infos = (<UniqueValueRenderer>renderer).uniqueValueInfos;
    } else if (rendererType === "classBreaks") {
      infos = (<ClassBreaksRenderer>renderer).classBreakInfos;
    } else if (rendererType === "simple") {
      infos = [<SimpleRenderer>renderer];
    } else {
      return undefined;
    }

    const items: StratumFromTraits<LegendItemTraits>[] = [];

    infos.forEach(info => {
      const label = replaceUnderscores(info.label);
      const symbol = info.symbol;
      if (!symbol || symbol.style === "esriSLSNull") {
        return;
      }
      const color = symbol.color;
      const imageUrl = symbol.imageData
        ? proxyCatalogItemUrl(
            this._item,
            `data:${symbol.contentType};base64,${symbol.imageData}`
          )
        : undefined;
      const outlineColor = symbol.outline?.color;
      items.push(
        createStratumInstance(LegendItemTraits, {
          title: label,
          imageUrl,
          color: color
            ? convertEsriColorToCesiumColor(color).toCssColorString()
            : undefined,
          outlineColor: outlineColor
            ? convertEsriColorToCesiumColor(outlineColor).toCssColorString()
            : undefined
        })
      );
    });
    return [createStratumInstance(LegendTraits, { items })];
  }
}

StratumOrder.addLoadStratum(FeatureServerStratum.stratumName);

export default class ArcGisFeatureServerCatalogItem extends MappableMixin(
  UrlMixin(
    CatalogMemberMixin(CreateModel(ArcGisFeatureServerCatalogItemTraits))
  )
) {
  static readonly type = "esri-featureServer";

  get type(): string {
    return ArcGisFeatureServerCatalogItem.type;
  }

  get typeName(): string {
    return i18next.t("models.arcGisFeatureServerCatalogItem.name");
  }

  protected removeCesiumMoveEndEventListener:
    | CesiumEvent.RemoveCallback
    | undefined;
  protected removeLeafletMoveEndEventListener: boolean = false;
  public level = 0;
  public bbox = new Rectangle();
  protected _oldLevel = 0;
  protected _cameraPitch: number = CameraPitchState.normal;
  protected _cameraPitchIsChanged = true;
  protected _displayConditions: { [key: number]: ConstantProperty } = {};

  protected checkReload() {
    let changed = false;

    if (this.terria.cesium?.scene) {
      let level = this.terria.cesium.getZoomLevel();
      if (!level) return;
      if (level > this.rerFeatureService.levelMax)
        level = this.rerFeatureService.levelMax;
      if (this.level !== level) {
        this.level = level;
        changed = true;
      }

      const pitch = this.terria.cesium.scene.camera.pitch;
      if (
        pitch >=
        -CesiumMath.toRadians(
          this.rerFeatureService.displayFilter.cameraLandedAngle
        )
      ) {
        if (this._cameraPitch !== CameraPitchState.landed) {
          this._cameraPitch = CameraPitchState.landed;
          this._cameraPitchIsChanged = true;
        }
      } else if (
        pitch >=
        -CesiumMath.toRadians(
          this.rerFeatureService.displayFilter.cameraTiltedAngle
        )
      ) {
        if (this._cameraPitch !== CameraPitchState.tilted) {
          this._cameraPitch = CameraPitchState.tilted;
          this._cameraPitchIsChanged = true;
        }
      } else if (this._cameraPitch !== CameraPitchState.normal) {
        this._cameraPitch = CameraPitchState.normal;
        this._cameraPitchIsChanged = true;
      }

      const newRect = this.terria.cesium.getCurrentCameraView().rectangle;
      if (newRect && !this.bbox.equalsEpsilon(newRect, newRect.width * 0.03)) {
        this.bbox = newRect;
        changed = true;
      }
    } else if (this.terria.leaflet) {
      let level = this.terria.leaflet.getZoomLevel();
      if (!level) return;
      if (level > this.rerFeatureService.levelMax)
        level = this.rerFeatureService.levelMax;
      if (this.level !== level) {
        this.level = level;
        changed = true;
      }

      const newRect = this.terria.leaflet.getCurrentCameraView().rectangle;
      if (newRect && !this.bbox.equalsEpsilon(newRect, newRect.width * 0.03)) {
        this.bbox = newRect;
        changed = true;
      }
    }

    if (changed && this.strata.has(FeatureServerStratum.stratumName)) {
      console.log(
        `rerFeatureService = zoom level: ${this.level} - cameraPitchState: ${this._cameraPitch}`
      );

      this.forceLoadMetadata().then(() => {
        this.forceLoadMapItems();
      });
    }
  }

  protected forceLoadMetadata(): Promise<void> {
    if (!this.removeCesiumMoveEndEventListener && this.terria.cesium) {
      const that = this;
      this.removeCesiumMoveEndEventListener = this.terria.cesium.scene.camera.moveEnd.addEventListener(
        function() {
          runInAction(() => {
            that.checkReload();
          });
        }
      );
    }
    if (!this.removeLeafletMoveEndEventListener && this.terria.leaflet) {
      const that = this;
      this.terria.leaflet.map.on("zoomlevelschange", function() {
        runInAction(() => {
          that.checkReload();
        });
      });
      this.terria.leaflet.map.on("moveend", function() {
        runInAction(() => {
          that.checkReload();
        });
      });
      this.removeLeafletMoveEndEventListener = true;
    }
    runInAction(() => {
      this.checkReload();
    });
    if (this.strata.has(FeatureServerStratum.stratumName)) {
      return loadGeoJson(this).then(esriJson => {
        const geoJsonData = featureDataToGeoJson(esriJson);
        const oldStratum = <FeatureServerStratum>(
          this.strata.get(FeatureServerStratum.stratumName)
        );
        if (oldStratum && geoJsonData) {
          oldStratum.mergeData(geoJsonData);
        }
      });
    } else {
      return FeatureServerStratum.load(this).then(stratum => {
        runInAction(() => {
          this.strata.set(FeatureServerStratum.stratumName, stratum);
        });
      });
    }
  }

  protected async forceLoadMapItems() {
    const that = this;
    if (isDefined(that.geoJsonItem)) {
      const itemsToSuspend = that.mapItems.filter(
        item => item instanceof GeoJsonDataSource
      );
      if (itemsToSuspend && itemsToSuspend.length > 0) {
        (<GeoJsonDataSource>itemsToSuspend[0]).entities.suspendEvents();
      }

      (await that.geoJsonItem.loadMapItems()).throwIfError();
      const featureServerData = that.featureServerData;
      if (
        that.useStyleInformationFromService &&
        featureServerData &&
        featureServerData.drawingInfo
      ) {
        const renderer = featureServerData.drawingInfo.renderer;
        const rendererType = renderer.type;
        that.mapItems.forEach(mapItem => {
          if (!(mapItem instanceof GeoJsonDataSource)) return;
          const entities = mapItem.entities;
          //entities.suspendEvents();

          // A 'simple' renderer only applies a single style to all features
          if (rendererType === "simple") {
            const simpleRenderer = <SimpleRenderer>renderer;
            const symbol = simpleRenderer.symbol;
            if (symbol) {
              entities.values.forEach(function(entity) {
                updateEntityWithEsriStyle(entity, symbol, that);
              });
            }

            // For a 'uniqueValue' renderer symbology gets applied via feature properties.
          } else if (renderer.type === "uniqueValue") {
            const uniqueValueRenderer = <UniqueValueRenderer>renderer;
            const rendererObj = setupUniqueValueRenderer(uniqueValueRenderer);
            entities.values.forEach(function(entity) {
              const symbol = getUniqueValueSymbol(
                entity,
                uniqueValueRenderer,
                rendererObj
              );
              if (symbol) {
                updateEntityWithEsriStyle(entity, symbol, that);
              }
            });

            // For a 'classBreaks' renderer symbology gets applied via classes or ranges of data.
          } else if (renderer.type === "classBreaks") {
            const classBreaksRenderer = <ClassBreaksRenderer>renderer;
            entities.values.forEach(function(entity) {
              const symbol = getClassBreaksSymbol(entity, classBreaksRenderer);
              if (symbol) {
                updateEntityWithEsriStyle(entity, symbol, that);
              }
            });
          }

          //entities.resumeEvents();
        });
      }

      if (that.rerFeatureService) {
        runInAction(() => {
          if (that._displayConditions) {
            that.rerFeatureService.displayFilter.tiltedDisplayDistanceCondition.forEach(
              element => {
                that._displayConditions[element.level] = new ConstantProperty(
                  new DistanceDisplayCondition(0, element.distance)
                );
              }
            );
          }

          const isCameraLanded = that._cameraPitch === CameraPitchState.landed;
          const showLabels =
            that.rerFeatureService.labels &&
            that.rerFeatureService.labels.length > 0;
          const levelField = that.rerFeatureService.levelField;
          that.mapItems.forEach(mapItem => {
            if (!(mapItem instanceof GeoJsonDataSource)) return;
            const entities = mapItem.entities;
            entities.values.forEach(function(entity) {
              if (entity.billboard) {
                if (
                  !isCameraLanded &&
                  entity.properties &&
                  entity.properties[levelField].getValue() <= that.level
                ) {
                  if (showLabels) {
                    // Labels
                    const labelClass:
                      | RerLabelTraits
                      | undefined = that.rerFeatureService.labels.find(
                      (elem: RerLabelTraits) =>
                        entity?.properties &&
                        entity.properties[levelField] &&
                        entity.properties[levelField] >= elem.levelMin &&
                        entity.properties[levelField] < elem.levelMax
                    );

                    if (labelClass?.show && !entity.label) {
                      entity.label = new LabelGraphics({
                        text: entity.properties[labelClass.labelField],
                        font: labelClass.font,
                        fillColor: Color.fromCssColorString(
                          labelClass.fillColor
                        ),
                        backgroundColor: Color.fromCssColorString(
                          labelClass.backgroundColor
                        ),
                        showBackground:
                          typeof labelClass.backgroundColor !== "undefined" &&
                          labelClass.backgroundColor !== "transparent"
                            ? true
                            : false,
                        verticalOrigin: VerticalOrigin.TOP,
                        show: true,
                        heightReference: HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                      });
                    }
                  }

                  entity.show = true;
                  entity.billboard.verticalOrigin = new ConstantProperty(
                    VerticalOrigin.BOTTOM
                  );
                  entity.billboard.disableDepthTestDistance = new ConstantProperty(
                    Number.POSITIVE_INFINITY
                  );

                  if (that.terria.cesium && that._cameraPitchIsChanged) {
                    const lvl = entity.properties[levelField].getValue();
                    entity.billboard.distanceDisplayCondition =
                      that._cameraPitch === CameraPitchState.normal
                        ? undefined
                        : that._displayConditions[lvl];
                    if (entity.label) {
                      entity.label.distanceDisplayCondition =
                        entity.billboard.distanceDisplayCondition;
                    }
                  }
                } else {
                  entity.show = false;
                }
              }
            });

            if (that._cameraPitchIsChanged) {
              that._cameraPitchIsChanged = false;
            }
          });
        });
      }

      const itemsToResume = that.mapItems.filter(
        item => item instanceof GeoJsonDataSource
      );
      if (itemsToResume && itemsToResume.length > 0) {
        (<GeoJsonDataSource>itemsToResume[0]).entities.resumeEvents();
      }
    }
  }

  @computed get cacheDuration(): string {
    if (isDefined(super.cacheDuration)) {
      return super.cacheDuration;
    }
    return "1d";
  }

  @computed get geoJsonItem(): GeoJsonCatalogItem | undefined {
    const stratum = <FeatureServerStratum>(
      this.strata.get(FeatureServerStratum.stratumName)
    );
    return isDefined(stratum) ? stratum.geoJsonItem : undefined;
  }

  @computed get featureServerData(): FeatureServer | undefined {
    const stratum = <FeatureServerStratum>(
      this.strata.get(FeatureServerStratum.stratumName)
    );
    return isDefined(stratum) ? stratum.featureServerData : undefined;
  }

  @computed get mapItems() {
    if (isDefined(this.geoJsonItem)) {
      return this.geoJsonItem.mapItems.map(mapItem => {
        mapItem.show = this.show;
        return mapItem;
      });
    }
    return [];
  }

  @computed get isMapServerQuery(): boolean {
    const url = cleanUrl(this.url || "0d");
    const regex = /^(.*MapServer)\/(\d+)/;
    const matches = url.match(regex);
    return !!matches;
  }
}

function setupUniqueValueRenderer(renderer: UniqueValueRenderer) {
  const out: any = {};
  for (var i = 0; i < renderer.uniqueValueInfos.length; i++) {
    const val = renderer.uniqueValueInfos[i].value;
    out[val] = renderer.uniqueValueInfos[i];
  }
  return out;
}

function getUniqueValueSymbol(
  entity: Entity,
  uniqueValueRenderer: UniqueValueRenderer,
  rendererObj: any
): Symbol | null {
  if (!entity.properties) {
    return uniqueValueRenderer.defaultSymbol;
  }

  let entityUniqueValue = entity.properties[
    uniqueValueRenderer.field1
  ].getValue();

  // accumulate values if there is more than one field defined
  if (uniqueValueRenderer.fieldDelimiter && uniqueValueRenderer.field2) {
    const val2 = entity.properties[uniqueValueRenderer.field2].getValue();

    if (val2) {
      entityUniqueValue += uniqueValueRenderer.fieldDelimiter + val2;

      if (uniqueValueRenderer.field3) {
        const val3 = entity.properties[uniqueValueRenderer.field3].getValue();

        if (val3) {
          entityUniqueValue += uniqueValueRenderer.fieldDelimiter + val3;
        }
      }
    }
  }

  const uniqueValueInfo = rendererObj[entityUniqueValue];

  if (uniqueValueInfo && uniqueValueInfo.symbol) {
    return uniqueValueInfo.symbol;
  } else {
    return uniqueValueRenderer.defaultSymbol;
  }
}

function getClassBreaksSymbol(
  entity: Entity,
  classBreaksRenderer: ClassBreaksRenderer
): Symbol | null {
  if (!entity.properties) {
    return classBreaksRenderer.defaultSymbol;
  }

  let entityValue = entity.properties[classBreaksRenderer.field].getValue();
  for (var i = 0; i < classBreaksRenderer.classBreakInfos.length; i++) {
    if (entityValue <= classBreaksRenderer.classBreakInfos[i].classMaxValue) {
      return classBreaksRenderer.classBreakInfos[i].symbol;
    }
  }

  return classBreaksRenderer.defaultSymbol;
}

export function convertEsriColorToCesiumColor(esriColor: number[]): Color {
  return Color.fromBytes(
    esriColor[0],
    esriColor[1],
    esriColor[2],
    esriColor[3]
  );
}

function updateEntityWithEsriStyle(
  entity: Entity,
  symbol: Symbol,
  catalogItem: ArcGisFeatureServerCatalogItem
): void {
  // type of geometry is point and the applied style is image
  // TODO: tweek the svg support
  if (symbol.type === "esriPMS") {
    // Replace a general Cesium Point with a billboard
    if (entity.point && symbol.imageData) {
      entity.billboard = new BillboardGraphics({
        image: new ConstantProperty(
          proxyCatalogItemUrl(
            catalogItem,
            `data:${symbol.contentType};base64,${symbol.imageData}`
          )
        ),
        heightReference: new ConstantProperty(
          catalogItem.clampToGround
            ? HeightReference.RELATIVE_TO_GROUND
            : undefined
        ),
        width: new ConstantProperty(
          convertEsriPointSizeToPixels(symbol.width!)
        ),
        height: new ConstantProperty(
          convertEsriPointSizeToPixels(symbol.height!)
        ),
        rotation: new ConstantProperty(symbol.angle)
      });

      if (symbol.xoffset || symbol.yoffset) {
        const x = isDefined(symbol.xoffset) ? symbol.xoffset : 0;
        const y = isDefined(symbol.yoffset) ? symbol.yoffset : 0;
        entity.billboard.pixelOffset = new ConstantProperty(
          new Cartesian3(x, y)
        );
      }

      entity.point.show = new ConstantProperty(false);
    }
  } else if (symbol.type === "esriSMS") {
    // Update the styling of the Cesium Point
    // TODO extend support for cross, diamond, square, x, triangle
    if (entity.point && symbol.color) {
      entity.point.color = new ConstantProperty(
        convertEsriColorToCesiumColor(symbol.color)
      );
      entity.point.pixelSize = new ConstantProperty(
        convertEsriPointSizeToPixels(symbol.size!)
      );

      if (symbol.outline) {
        entity.point.outlineColor = new ConstantProperty(
          convertEsriColorToCesiumColor(symbol.outline.color)
        );
        entity.point.outlineWidth = new ConstantProperty(
          convertEsriPointSizeToPixels(symbol.outline.width)
        );
      }
    }
  } else if (symbol.type === "esriSLS") {
    /* Update the styling of the Cesium Polyline */
    if (entity.polyline) {
      if (isDefined(symbol.width)) {
        entity.polyline.width = new ConstantProperty(
          convertEsriPointSizeToPixels(symbol.width)
        );
      }
      const color = symbol.color ? symbol.color : defaultColor;
      /*
        For line containing dashes PolylineDashMaterialProperty is used.
        Definition is done using the line patterns converted from hex to decimal dashPattern.
        Source for some of the line patterns is https://www.opengl.org.ru/docs/pg/0204.html, others are created manually
      */
      esriPolylineStyle(entity, color, <supportedLineStyle>symbol.style);
    }
  } else if (symbol.type === "esriSFS") {
    // Update the styling of the Cesium Polygon
    if (entity.polygon) {
      const color = symbol.color ? symbol.color : defaultFillColor;

      // feature picking doesn't work when the polygon interior is transparent, so
      // use an almost-transparent color instead
      if (color[3] === 0) {
        color[3] = 1;
      }
      entity.polygon.material = new ColorMaterialProperty(
        new ConstantProperty(convertEsriColorToCesiumColor(color))
      );

      if (
        symbol.style === "esriSFSNull" &&
        symbol.outline &&
        symbol.outline.style === "esriSLSNull"
      ) {
        entity.polygon.show = new ConstantProperty(false);
      } else {
        entity.polygon.material = new ColorMaterialProperty(
          new ConstantProperty(convertEsriColorToCesiumColor(color))
        );
      }
      if (symbol.outline) {
        const outlineColor = symbol.outline.color
          ? symbol.outline.color
          : defaultOutlineColor;
        /* It can actually happen that entity has both polygon and polyline defined at same time,
            check the implementation of GeoJsonCatalogItem for details. */
        entity.polygon.outlineColor = new ColorMaterialProperty(
          new ConstantProperty(convertEsriColorToCesiumColor(outlineColor))
        );
        entity.polygon.outlineWidth = new ConstantProperty(
          convertEsriPointSizeToPixels(symbol.outline.width)
        );
        if (entity.polyline) {
          esriPolylineStyle(entity, outlineColor, symbol.outline.style);
          entity.polyline.width = new ConstantProperty(
            convertEsriPointSizeToPixels(symbol.outline.width)
          );
          entity.polygon.outline = entity.polyline.material;
        }
      }
    }
  }
}

function esriPolylineStyle(
  entity: Entity,
  color: number[],
  style?: supportedLineStyle
): void {
  if (entity.polyline) {
    if (style) {
      const patternValue = getLineStyleCesium(style);
      if (patternValue) {
        entity.polyline.material = new PolylineDashMaterialProperty({
          color: convertEsriColorToCesiumColor(color),
          dashPattern: new ConstantProperty(patternValue)
        });
      } else if (style === "esriSLSSolid") {
        // it is simple line just define color
        entity.polyline.material = new ColorMaterialProperty(
          convertEsriColorToCesiumColor(color)
        );
      } else if (style === "esriSLSDash") {
        // default PolylineDashMaterialProperty is dashed line ` -` (0x00FF)
        entity.polyline.material = new PolylineDashMaterialProperty({
          color: convertEsriColorToCesiumColor(color)
        });
      }
    } else {
      // we don't know how to handle style make it default
      entity.polyline.material = new ColorMaterialProperty(
        convertEsriColorToCesiumColor(color)
      );
    }

    if (style === "esriSLSNull") {
      entity.polyline.show = new ConstantProperty(false);
    }
  }
}

// ESRI uses points for styling while cesium uses pixels
export function convertEsriPointSizeToPixels(pointSize: number) {
  // 1 px = 0.75 point
  // 1 point = 4/3 point
  return (pointSize * 4) / 3;
}

function loadGeoJson(catalogItem: ArcGisFeatureServerCatalogItem) {
  return loadJson(buildGeoJsonUrl(catalogItem)).then(function(json) {
    return json;
  });
}

function loadMetadata(catalogItem: ArcGisFeatureServerCatalogItem) {
  const metaUrl = buildMetadataUrl(catalogItem);
  return loadJson(metaUrl).then(function(json) {
    return json;
  });
}

function buildMetadataUrl(catalogItem: ArcGisFeatureServerCatalogItem) {
  return proxyCatalogItemUrl(
    catalogItem,
    new URI(catalogItem.url).addQuery("f", "json").toString()
  );
}

function buildGeoJsonUrl(catalogItem: ArcGisFeatureServerCatalogItem) {
  if (catalogItem.isMapServerQuery) {
    return buildMapServerQueryUrl(catalogItem);
  } else {
    const url = cleanUrl(catalogItem.url || "0d");
    const urlComponents = splitLayerIdFromPath(url);
    const layerId = urlComponents.layerId;

    if (!isDefined(layerId)) {
      throw networkRequestError({
        title: i18next.t(
          "models.arcGisFeatureServerCatalogItem.invalidServiceTitle"
        ),
        message: i18next.t(
          "models.arcGisFeatureServerCatalogItem.invalidServiceMessage"
        )
      });
    }

    return proxyCatalogItemUrl(
      catalogItem,
      new URI(urlComponents.urlWithoutLayerId)
        .segment("query")
        .addQuery("f", "json")
        .addQuery(
          "layerDefs",
          "{" + layerId + ':"' + catalogItem.layerDef + '"}'
        )
        .addQuery("outSR", "4326")
        .toString()
    );
  }
}

function buildMapServerQueryUrl(catalogItem: ArcGisFeatureServerCatalogItem) {
  var url = new URI(cleanUrl(catalogItem.url || "0d"))
    .segment("query")
    .addQuery(
      "where",
      `${
        catalogItem.rerFeatureService.levelField
      }<=${catalogItem.level.toString()}`
    )
    .addQuery(
      "geometry",
      CesiumMath.toDegrees(catalogItem.bbox.west) +
        "," +
        CesiumMath.toDegrees(catalogItem.bbox.south) +
        "," +
        CesiumMath.toDegrees(catalogItem.bbox.east) +
        "," +
        CesiumMath.toDegrees(catalogItem.bbox.north)
    )
    .addQuery("geometryType", "esriGeometryEnvelope")
    .addQuery("spatialRel", "esriSpatialRelIndexIntersects")
    .addQuery("outFields", "*")
    .addQuery("returnGeometry", "true")
    .addQuery("outSR", "4326")
    .addQuery("f", "geojson")
    .toString();
  return url;
}

function splitLayerIdFromPath(url: string) {
  const regex = /^(.*FeatureServer)\/(\d+)/;
  const matches = url.match(regex);
  if (isDefined(matches) && matches !== null && matches.length > 2) {
    return {
      layerId: matches[2],
      urlWithoutLayerId: matches[1]
    };
  }
  return {
    urlWithoutLayerId: url
  };
}

function cleanUrl(url: string): string {
  // Strip off the search portion of the URL
  const uri = new URI(url);
  uri.search("");
  return uri.toString();
}

function getRayPosition(coord: Cartesian2, scene: Scene) {
  const ray = scene.camera.getPickRay(coord);
  return scene.globe.pick(ray, scene);
}
