import { computed } from "mobx";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import { SelectableDimensionSelect } from "../Models/SelectableDimensions";
import StratumOrder from "../Models/Definition/StratumOrder";
import MeasurableTraits from "../Traits/TraitsClasses/MeasurableTraits";

type MixinModel = Model<MeasurableTraits>;

function MeasurableMixin<T extends Constructor<MixinModel>>(Base: T) {
  abstract class MeasurableMixin extends Base {
    //abstract get styleSelectableDimensions():
    //  | SelectableDimensionSelect[]
    //  | undefined;

    get hasMeasurableMixin() {
      return true;
    }

    abstract get canUseAsPath(): boolean;

    abstract get asPath(): object[];

    /*abstract get canDiffImages(): boolean;

    abstract showDiffImage(
      firstDate: JulianDate,
      secondDate: JulianDate,
      diffStyleId: string
    ): void;

    abstract clearDiffImage(): void;

    abstract getLegendUrlForStyle(
      diffStyleId: string,
      firstDate?: JulianDate,
      secondDate?: JulianDate
    ): string;

    @computed
    get canFilterTimeByFeature() {
      // Hides the SatelliteImageryTimeFilterSection for the item if it is
      // currently showing difference image
      return super.canFilterTimeByFeature && !this.isShowingDiff;
    }*/
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
