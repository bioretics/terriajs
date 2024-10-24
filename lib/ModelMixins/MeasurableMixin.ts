import { computed, action } from "mobx";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import StratumOrder from "../Models/Definition/StratumOrder";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";

type MixinModel = Model<MappableTraits>;

function MeasurableMixin<T extends Constructor<MixinModel>>(Base: T) {
  abstract class MeasurableMixin extends Base {
    @computed
    get hasMeasurableMixin() {
      return true;
    }

    abstract get canUseAsPath(): boolean;

    abstract computePath(): void;

    @action
    update(stopPoints: Cartographic[]) {
      this.terria.pathManager.sampleFromCartographics(stopPoints);
    }

    asPath(positions: Cartographic[]) {
      if (!this?.terria?.cesium?.scene) {
        return;
      }
      const terrainProvider: TerrainProvider =
        this.terria?.cesium?.scene.terrainProvider;

      let prom = Promise.resolve(positions);
      if (positions.every((element) => element.height < 1)) {
        prom = prom.then((pos) =>
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
    return model?.hasMeasurableMixin;
  }

  export const stratumName = "measureableStratum";
  StratumOrder.addLoadStratum(stratumName);
}

export default MeasurableMixin;
