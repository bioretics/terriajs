import i18next from "i18next";
import { computed, makeObservable, override, runInAction } from "mobx";
import buildModuleUrl from "terriajs-cesium/Source/Core/buildModuleUrl";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Geometry from "terriajs-cesium/Source/Core/Geometry";
import GeometryInstance from "terriajs-cesium/Source/Core/GeometryInstance";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import EllipsoidSurfaceAppearance from "terriajs-cesium/Source/Scene/EllipsoidSurfaceAppearance";
import Material from "terriajs-cesium/Source/Scene/Material";
import Primitive from "terriajs-cesium/Source/Scene/Primitive";
import AbstractConstructor from "../Core/AbstractConstructor";
import Model from "../Models/Definition/Model";
import { SelectableDimension } from "../Models/SelectableDimensions/SelectableDimensions";
import WaterSurfaceTraits from "../Traits/TraitsClasses/WaterSurfaceTraits";
import CatalogMemberMixin from "./CatalogMemberMixin";
import MappableMixin, { MapItem } from "./MappableMixin";

type BaseType = Model<WaterSurfaceTraits>;

const WATER_COLOR = new Color(0.12, 0.3, 0.42, 1);

function WaterSurfaceMixin<T extends AbstractConstructor<BaseType>>(Base: T) {
  abstract class WaterSurfaceMixin extends CatalogMemberMixin(
    MappableMixin(Base)
  ) {
    private readonly material = Material.fromType(Material.WaterType, {
      baseWaterColor: WATER_COLOR.clone(),
      blendColor: new Color(0.2, 0.45, 0.45, 1),
      normalMap: buildModuleUrl("Assets/Textures/waterNormals.jpg"),
      frequency: 200,
      animationSpeed: 0.02,
      amplitude: 4,
      specularIntensity: 0.6
    });

    constructor(...args: any[]) {
      super(...args);
      makeObservable(this);
    }

    get hasWaterSurfaceMixin() {
      return true;
    }

    protected abstract get waterSurfaceGeometry(): Geometry | undefined;

    @computed
    private get waterPrimitive(): Primitive | undefined {
      const geometry = this.waterSurfaceGeometry;
      if (geometry === undefined) return undefined;
      return new Primitive({
        geometryInstances: new GeometryInstance({ geometry }),
        appearance: new EllipsoidSurfaceAppearance({
          material: this.material,
          aboveGround: true
        }),
        asynchronous: false,
        allowPicking: false
      });
    }

    @computed
    get mapItems(): MapItem[] {
      const primitive = this.waterPrimitive;
      const geometry = this.waterSurfaceGeometry;
      if (primitive === undefined || geometry === undefined) return [];

      const center = geometry.boundingSphere!.center;
      const up = Ellipsoid.WGS84.geodeticSurfaceNormal(
        center,
        new Cartesian3()
      );
      primitive.modelMatrix = Matrix4.fromTranslation(
        Cartesian3.multiplyByScalar(up, this.waterRise, up)
      );
      primitive.show = this.show;
      this.material.uniforms.baseWaterColor = WATER_COLOR.withAlpha(
        this.opacity
      );
      return [primitive];
    }

    protected forceLoadMetadata(): Promise<void> {
      return Promise.resolve();
    }

    @override
    get shortReport(): string | undefined {
      if (this.terria.currentViewer.type === "Leaflet") {
        return i18next.t(($) => $.models.commonModelErrors["3dTypeIn2dMode"]);
      }
      if (this.terria.cesium && !this.terria.depthTestAgainstTerrainEnabled) {
        return i18next.t(($) => $.models.waterSurface.enableDepthTest);
      }
      return super.shortReport;
    }

    @override
    get selectableDimensions(): SelectableDimension[] {
      return [
        ...super.selectableDimensions,
        {
          type: "numeric",
          id: "waterRise",
          name: i18next.t(($) => $.models.waterSurface.waterRise),
          value: this.waterRise,
          min: 0,
          max: this.maximumWaterRise,
          setDimensionValue: (stratumId, value) => {
            if (value === undefined || !Number.isFinite(value)) return;
            runInAction(() =>
              this.setTrait(
                stratumId,
                "waterRise",
                Math.min(this.maximumWaterRise, Math.max(0, value))
              )
            );
          }
        }
      ];
    }
  }

  return WaterSurfaceMixin;
}

namespace WaterSurfaceMixin {
  export interface Instance extends InstanceType<
    ReturnType<typeof WaterSurfaceMixin>
  > {}
  export function isMixedInto(model: any): model is Instance {
    return model && model.hasWaterSurfaceMixin;
  }
}

export default WaterSurfaceMixin;
