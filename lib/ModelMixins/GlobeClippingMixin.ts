import { action, autorun, makeObservable, observable, override } from "mobx";
import AbstractConstructor from "../Core/AbstractConstructor";
import Model from "../Models/Definition/Model";
import SelectableDimensions, {
  SelectableDimensionCheckbox
} from "../Models/SelectableDimensions/SelectableDimensions";
import GlobeClippingTraits from "../Traits/TraitsClasses/GlobeClippingTraits";
import i18next from "i18next";
import filterOutUndefined from "../Core/filterOutUndefined";
import DataSource from "terriajs-cesium/Source/DataSources/DataSource";
import ClippingPlane from "terriajs-cesium/Source/Scene/ClippingPlane";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import ClippingPlaneCollection from "terriajs-cesium/Source/Scene/ClippingPlaneCollection";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import CesiumColor from "terriajs-cesium/Source/Core/Color";

type BaseType = Model<GlobeClippingTraits> & SelectableDimensions;

function GlobeClippingMixin<T extends AbstractConstructor<BaseType>>(Base: T) {
  abstract class GlobeClippingMixinBase extends Base {
    @observable.ref
    private _measuredBoundingSphere: BoundingSphere | undefined = undefined;
    private _globeClippingApplied = false;
    private readonly _globeClippingDisposer: () => void;

    constructor(...args: any[]) {
      super(...args);
      makeObservable(this);

      this._globeClippingDisposer = autorun(() => {
        const boundingSphere = this.globeClippingEnabled
          ? this.globeClippingBoundingSphere
          : undefined;

        if (
          (boundingSphere?.radius ?? 0) > 0 &&
          this.terria.cesium !== undefined
        ) {
          this.autoComputeClippingPlanes(boundingSphere);
          this._globeClippingApplied = true;
        } else if (this._globeClippingApplied) {
          this.autoComputeClippingPlanes(undefined);
          this._globeClippingApplied = false;
        }
      });
    }

    get hasGlobeClippingMixin() {
      return true;
    }

    dispose() {
      super.dispose();
      this._globeClippingDisposer();
    }

    @override
    get selectableDimensions() {
      const globeClippingCheckbox: SelectableDimensionCheckbox | undefined =
        this.globeClippingControlShowed
          ? {
              type: "checkbox",
              id: "globe-clipping-box",
              selectedId: this.globeClippingEnabled ? "true" : "false",
              options: [
                {
                  id: "true",
                  name: `${i18next.t("models.globeClipping.enableMessage")}`
                },
                {
                  id: "false",
                  name: i18next.t("models.globeClipping.enableMessage")
                }
              ],
              setDimensionValue: action((stratumId, value) => {
                this.setTrait(
                  stratumId,
                  "globeClippingEnabled",
                  value === "true"
                );
              })
            }
          : undefined;

      return filterOutUndefined([
        ...super.selectableDimensions,
        globeClippingCheckbox
      ]);
    }

    get data(): DataSource | undefined {
      return undefined;
    }

    get globeClippingBoundingSphere(): BoundingSphere | undefined {
      const points: Cartesian3[] = filterOutUndefined(
        this.data?.entities.values.map((elem) =>
          elem.position?.getValue(JulianDate.now())
        ) ?? []
      );
      if (points.length === 0) {
        return undefined;
      }
      return BoundingSphere.fromPoints(points);
    }

    protected get measuredGlobeClippingBoundingSphere():
      | BoundingSphere
      | undefined {
      return this._measuredBoundingSphere;
    }

    @action
    protected setMeasuredGlobeClippingBoundingSphere(
      boundingSphere: BoundingSphere | undefined
    ) {
      this._measuredBoundingSphere = boundingSphere;
    }

    autoComputeClippingPlanes(boundingSphere: BoundingSphere | undefined) {
      if (!this.terria.cesium) {
        return;
      }

      const globe = this.terria.cesium.scene.globe;

      if (boundingSphere === undefined) {
        globe.backFaceCulling = true;
        globe.showSkirts = true;
        if (globe.clippingPlanes) {
          globe.clippingPlanes.enabled = false;
        }
        return;
      }

      const position = boundingSphere.center;
      const distance = boundingSphere.radius;
      if (!(distance > 0)) {
        return;
      }

      globe.clippingPlanes = new ClippingPlaneCollection({
        modelMatrix: Transforms.eastNorthUpToFixedFrame(position),
        planes: [
          new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), distance),
          new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), distance),
          new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), distance),
          new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), distance)
        ],
        unionClippingRegions: true,
        edgeWidth: 1.0,
        edgeColor: CesiumColor.WHITE,
        enabled: true
      });
      globe.backFaceCulling = false;
      globe.showSkirts = false;
    }
  }

  return GlobeClippingMixinBase;
}

namespace GlobeClippingMixin {
  export interface Instance
    extends InstanceType<ReturnType<typeof GlobeClippingMixin>> {}

  export function isMixedInto(model: any): model is Instance {
    return model?.hasGlobeClippingMixin === true;
  }
}

export default GlobeClippingMixin;
