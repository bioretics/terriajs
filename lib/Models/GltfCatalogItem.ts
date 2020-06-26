import { computed } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import ModelGraphics from "terriajs-cesium/Source/DataSources/ModelGraphics";
import Axis from "terriajs-cesium/Source/Scene/Axis";
import ShadowMode from "terriajs-cesium/Source/Scene/ShadowMode";
import CatalogMemberMixin from "../ModelMixins/CatalogMemberMixin";
import UrlMixin from "../ModelMixins/UrlMixin";
import CreateModel from "./CreateModel";
import Mappable from "./Mappable";
import GltfCatalogItemTraits from "../Traits/GltfCatalogItemTraits";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";

export default class GltfCatalogItem
  extends UrlMixin(CatalogMemberMixin(CreateModel(GltfCatalogItemTraits)))
  implements Mappable {
  static readonly type = "gltf";

  get type() {
    return GltfCatalogItem.type;
  }

  get isMappable() {
    return true;
  }

  get canZoomTo() {
    return true;
  }

  @computed
  private get cesiumUpAxis() {
    if (this.upAxis === undefined) {
      return Axis.Y;
    }
    return Axis.fromName(this.upAxis);
  }

  @computed
  private get cesiumForwardAxis() {
    if (this.forwardAxis === undefined) {
      return Axis.Z;
    }
    return Axis.fromName(this.forwardAxis);
  }

  @computed
  private get cesiumHeightReference() {
    const heightReference: HeightReference =
      // @ts-ignore
      HeightReference[this.heightReference] || HeightReference.NONE;
    return heightReference;
  }

  @computed
  private get cesiumPosition(): Cartesian3 {
    if (
      this.origin !== undefined &&
      this.origin.longitude !== undefined &&
      this.origin.latitude !== undefined &&
      this.origin.height !== undefined
    ) {
      return Cartesian3.fromDegrees(
        this.origin.longitude,
        this.origin.latitude,
        this.origin.height
      );
    } else {
      return Cartesian3.ZERO;
    }
  }

  /**
   * Returns the orientation of the model in the ECEF frame
   */
  @computed
  private get orientation(): Quaternion {
    const { heading, pitch, roll } = this.rotation;
    const hpr = HeadingPitchRoll.fromDegrees(
      heading || 0,
      pitch || 0,
      roll || 0
    );
    const orientation = Transforms.headingPitchRollQuaternion(
      this.cesiumPosition,
      hpr
    );
    return orientation;
  }

  @computed
  private get cesiumShadows() {
    let result;

    switch (this.shadows !== undefined ? this.shadows.toLowerCase() : "none") {
      case "none":
        result = ShadowMode.DISABLED;
        break;
      case "both":
        result = ShadowMode.ENABLED;
        break;
      case "cast":
        result = ShadowMode.CAST_ONLY;
        break;
      case "receive":
        result = ShadowMode.RECEIVE_ONLY;
        break;
      default:
        result = ShadowMode.DISABLED;
        break;
    }
    return result;
  }

  protected forceLoadMetadata(): Promise<void> {
    return Promise.resolve();
  }

  loadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed
  private get model() {
    if (this.url === undefined) {
      return undefined;
    }
    const options = {
      uri: this.url,
      upAxis: this.cesiumUpAxis,
      forwardAxis: this.cesiumForwardAxis,
      scale: this.scale !== undefined ? this.scale : 1,
      shadows: new ConstantProperty(this.cesiumShadows),
      heightReference: new ConstantProperty(this.cesiumHeightReference)
    };
    return new ModelGraphics(options);
  }

  @computed
  get mapItems() {
    if (this.model === undefined) return [];

    this.model.show = this.show;
    const dataSource: CustomDataSource = new CustomDataSource(
      this.name || "glTF model"
    );
    dataSource.entities.add(
      new Entity({
        position: new ConstantPositionProperty(this.cesiumPosition),
        orientation: new ConstantProperty(this.orientation),
        model: this.model
      })
    );
    return [dataSource];
  }
}