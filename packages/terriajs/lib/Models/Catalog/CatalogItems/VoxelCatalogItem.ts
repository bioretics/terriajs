import * as d3Scale from "d3-scale-chromatic";
import i18next from "i18next";
import {
  computed,
  makeObservable,
  observable,
  override,
  runInAction
} from "mobx";
import Color from "terriajs-cesium/Source/Core/Color";
import Cesium3DTilesVoxelProvider from "terriajs-cesium/Source/Scene/Cesium3DTilesVoxelProvider";
import CustomShader from "terriajs-cesium/Source/Scene/Model/CustomShader";
import TextureUniform from "terriajs-cesium/Source/Scene/Model/TextureUniform";
import UniformType from "terriajs-cesium/Source/Scene/Model/UniformType";
import VoxelPrimitive from "terriajs-cesium/Source/Scene/VoxelPrimitive";
import runLater from "../../../Core/runLater";
import TerriaError from "../../../Core/TerriaError";
import CatalogMemberMixin from "../../../ModelMixins/CatalogMemberMixin";
import MappableMixin, { MapItem } from "../../../ModelMixins/MappableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import VoxelCatalogItemTraits from "../../../Traits/TraitsClasses/VoxelCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";

export function paletteTexels(name: string): Uint8Array {
  const interpolate: (t: number) => string =
    (d3Scale as any)[`interpolate${name}`] ?? d3Scale.interpolateViridis;
  const texels = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    texels.set(Color.fromCssColorString(interpolate(i / 255)).toBytes(), i * 4);
  }
  return texels;
}

export default class VoxelCatalogItem extends MappableMixin(
  UrlMixin(CatalogMemberMixin(CreateModel(VoxelCatalogItemTraits)))
) {
  static readonly type = "3d-tiles-voxel";

  @observable.ref private voxelPrimitive: VoxelPrimitive | undefined =
    undefined;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  get type() {
    return VoxelCatalogItem.type;
  }

  protected async forceLoadMapItems(): Promise<void> {
    runInAction(() => (this.voxelPrimitive = undefined));
    if (this.url === undefined) return;
    try {
      const provider = await Cesium3DTilesVoxelProvider.fromUrl(
        proxyCatalogItemUrl(this, this.url)
      );
      runInAction(() => (this.voxelPrimitive = this.createPrimitive(provider)));
    } catch (e) {
      throw TerriaError.from(e, "Failed to load voxel tileset");
    }
  }

  private createPrimitive(provider: Cesium3DTilesVoxelProvider) {
    const primitive = new VoxelPrimitive({ provider });
    const destroy = primitive.destroy.bind(primitive);
    primitive.destroy = () => {
      destroy();
      runLater(() =>
        runInAction(() => {
          if (this.voxelPrimitive === primitive) {
            this.voxelPrimitive = this.createPrimitive(provider);
          }
        })
      );
    };
    return primitive;
  }

  @computed({ keepAlive: true })
  private get customShader(): CustomShader | undefined {
    const name = this.voxelPrimitive?.provider.names[0];
    if (name === undefined) return undefined;
    const noData =
      this.noDataValue === undefined
        ? ""
        : "if (value == u_noData) { material.alpha = 0.0; return; }";
    return new CustomShader({
      uniforms: {
        u_palette: {
          type: UniformType.SAMPLER_2D,
          value: new TextureUniform({
            typedArray: paletteTexels(this.colorPalette),
            width: 256,
            height: 1,
            repeat: false
          })
        },
        u_min: { type: UniformType.FLOAT, value: 0 },
        u_max: { type: UniformType.FLOAT, value: 1 },
        u_opacity: { type: UniformType.FLOAT, value: 1 },
        u_noData: { type: UniformType.FLOAT, value: 0 }
      },
      fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  float value = fsInput.metadata.${name};
  ${noData}
  float t = clamp((value - u_min) / (u_max - u_min), 0.0, 1.0);
  material.diffuse = texture(u_palette, vec2(t, 0.5)).rgb;
  material.alpha = u_opacity;
}`
    });
  }

  @computed
  get mapItems(): MapItem[] {
    const primitive = this.voxelPrimitive;
    const shader = this.customShader;
    if (primitive === undefined || shader === undefined) return [];
    primitive.show = this.show;
    primitive.nearestSampling = this.nearestSampling;
    primitive.customShader = shader;
    shader.setUniform("u_min", this.minimumValue);
    shader.setUniform(
      "u_max",
      this.maximumValue === this.minimumValue
        ? this.minimumValue + 1
        : this.maximumValue
    );
    shader.setUniform("u_opacity", this.opacity);
    if (this.noDataValue !== undefined) {
      shader.setUniform("u_noData", this.noDataValue);
    }
    return [primitive];
  }

  @override
  get shortReport(): string | undefined {
    if (this.terria.currentViewer.type === "Leaflet") {
      return i18next.t(($) => $.models.commonModelErrors["3dTypeIn2dMode"]);
    }
    return super.shortReport;
  }
}
