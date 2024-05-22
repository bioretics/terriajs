import i18next from "i18next";
import {
  computed,
  makeObservable,
  observable,
  override,
  runInAction,
  toJS
} from "mobx";
import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import isDefined from "../../../Core/isDefined";
import I3SCatalogItemTraits from "../../../Traits/TraitsClasses/I3SCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import I3SDataProvider from "terriajs-cesium/Source/Scene/I3SDataProvider";
import CatalogMemberMixin, {
  getName
} from "../../../ModelMixins/CatalogMemberMixin";
import ArcGISTiledElevationTerrainProvider from "terriajs-cesium/Source/Core/ArcGISTiledElevationTerrainProvider";
import { createCesium3DTileStyle } from "../../../ModelMixins/Cesium3dTilesMixin";

export default class I3SCatalogItem extends MappableMixin(
  UrlMixin(CatalogMemberMixin(CreateModel(I3SCatalogItemTraits)))
) {
  static readonly type = "I3S";
  readonly type = I3SCatalogItem.type;

  @observable
  private dataProvider?: I3SDataProvider;
  public boundingSphere: BoundingSphere | undefined;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  async forceLoadMapItems() {
    if (!isDefined(this.url)) {
      throw `\`url\` is not defined for ${getName(this)}`;
    }
    this.dataProvider = await I3SDataProvider.fromUrl(this.url, {
      geoidTiledTerrainProvider: this.terrainURL
        ? await ArcGISTiledElevationTerrainProvider.fromUrl(this.terrainURL)
        : undefined
    });
    this.boundingSphere = BoundingSphere.fromBoundingSpheres(
      this.dataProvider.layers
        .map((layer) => layer.tileset?.boundingSphere)
        .filter(isDefined)
    );
    runInAction(() => {
      this.dataProvider?.layers.forEach(({ tileset }) => {
        if (!tileset) {
          return;
        }
        /* Control "lightness" of textures */
        if (this.lightingFactor) {
          tileset.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(
            ...this.lightingFactor
          );
        }
        tileset.style = this.cesiumTileStyle;
      });
    });
  }

  @computed get cesiumTileStyle() {
    return createCesium3DTileStyle(this);
  }

  @computed
  get mapItems() {
    if (this.isLoadingMapItems || !isDefined(this.dataProvider)) {
      return [];
    }
    this.dataProvider.layers.forEach((layer) => {
      layer.tileset!.style = toJS(this.cesiumTileStyle);
      if (this.lightingFactor && layer.tileset?.imageBasedLighting) {
        layer.tileset.imageBasedLighting.imageBasedLightingFactor =
          new Cartesian2(...this.lightingFactor);
      }
    });
    return [this.dataProvider];
  }

  @override
  get shortReport(): string | undefined {
    if (this.terria.currentViewer.type === "Leaflet") {
      return i18next.t("models.commonModelErrors.3dTypeIn2dMode", this);
    }
    return super.shortReport;
  }

  get typeName() {
    return i18next.t("core.dataType.i3s");
  }
}
