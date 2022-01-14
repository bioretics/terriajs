import { computed, action } from "mobx";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import StratumOrder from "../Models/Definition/StratumOrder";
import MeasurableTraits from "../Traits/TraitsClasses/MeasurableTraits";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";

type MixinModel = Model<MeasurableTraits>;

function MeasurableMixin<T extends Constructor<MixinModel>>(Base: T) {
  abstract class MeasurableMixin extends Base {
    //abstract get styleSelectableDimensions():
    //  | SelectableDimensionSelect[]
    //  | undefined;

    @computed
    get hasMeasurableMixin() {
      return true;
    }

    abstract get canUseAsPath(): boolean;

    abstract computePath(): void;

    @action
    update(newPositions: Cartographic[]) {
      let dist = 0.0;
      const stepDistanceMeters: number[] = [0.0];

      newPositions.forEach((elem, index) => {
        elem.height = Math.round(elem.height);
        if (index > 0) {
          const geodesic = new EllipsoidGeodesic(elem, newPositions[index - 1]);
          dist += geodesic.surfaceDistance;
          stepDistanceMeters.push(dist);
        }
      });
      if (newPositions.length > 1) {
        this.terria.pathPoints = newPositions;
        this.terria.pathDistances = stepDistanceMeters;
      }
    }

    asPath(positions: Cartographic[]) {
      if (!this?.terria?.cesium?.scene) {
        return;
      }
      const terrainProvider: TerrainProvider = this.terria?.cesium?.scene
        .terrainProvider;

      let prom = Promise.resolve(positions);
      if (positions.every(element => element.height < 1)) {
        prom = prom.then(pos =>
          sampleTerrainMostDetailed(terrainProvider, pos)
        );
      }

      prom.then((newPositions: Cartographic[]) => {
        this.update(newPositions);
      });
    }
  }

  return MeasurableMixin;
}

namespace MeasurableMixin {
  export interface Instance
    extends InstanceType<ReturnType<typeof MeasurableMixin>> {}

  export function isMixedInto(model: any): model is Instance {
    return model?.hasDiffableMixin;
  }

  export const stratumName = "measureableStratum";
  StratumOrder.addLoadStratum(stratumName);
}

export default MeasurableMixin;
