import i18next from "i18next";
import { computed, makeObservable, observable, runInAction } from "mobx";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import TerriaError from "../../../Core/TerriaError";
import {
  rectangleSurfaceMesh,
  surfaceGeometry
} from "../../../Core/water/waterSurface";
import EarthGravityModel1996 from "../../../Map/Vector/EarthGravityModel1996";
import WaterSurfaceMixin from "../../../ModelMixins/WaterSurfaceMixin";
import SeaLevelRiseCatalogItemTraits from "../../../Traits/TraitsClasses/SeaLevelRiseCatalogItemTraits";
import CommonStrata from "../../Definition/CommonStrata";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import geoidFile from "../../../../wwwroot/data/WW15MGH.DAC";

const geoid = new EarthGravityModel1996(geoidFile);

export default class SeaLevelRiseCatalogItem extends WaterSurfaceMixin(
  CreateModel(SeaLevelRiseCatalogItemTraits)
) {
  static readonly type = "sea-level-rise";

  @observable
  private geoidHeight: number | undefined;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
    this.setTrait(CommonStrata.defaults, "maximumWaterRise", 5);
  }

  get type() {
    return SeaLevelRiseCatalogItem.type;
  }

  @computed
  private get area() {
    const { west, south, east, north } = this.rectangle;
    return west !== undefined &&
      south !== undefined &&
      east !== undefined &&
      north !== undefined
      ? { west, south, east, north }
      : undefined;
  }

  protected async forceLoadMapItems(): Promise<void> {
    const area = this.area;
    if (area === undefined) {
      throw new TerriaError({
        title: i18next.t(($) => $.models.waterSurface.errorTitle),
        message: i18next.t(($) => $.models.waterSurface.noSeaArea),
        importance: 1
      });
    }
    const height = await geoid.getHeight(
      CesiumMath.toRadians((area.west + area.east) / 2),
      CesiumMath.toRadians((area.south + area.north) / 2)
    );
    runInAction(() => {
      this.geoidHeight = height;
    });
  }

  @computed
  get seaLevel(): number | undefined {
    return this.seaLevelHeight ?? this.geoidHeight;
  }

  @computed
  protected get waterSurfaceGeometry() {
    const area = this.area;
    const seaLevel = this.seaLevel;
    if (area === undefined || seaLevel === undefined) return undefined;
    return surfaceGeometry([rectangleSurfaceMesh(area, seaLevel)]);
  }
}
