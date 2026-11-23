import AbstractConstructor from "../Core/AbstractConstructor";
import { BaseModel } from "../Models/Definition/Model";

type BaseType = BaseModel;

function RepositionableMixin<T extends AbstractConstructor<BaseType>>(Base: T) {
  abstract class RepositionableMixin extends Base {
    get hasRepositionableMixin() {
      return true;
    }
  }

  return RepositionableMixin;
}

namespace RepositionableMixin {
  export interface Instance extends InstanceType<
    ReturnType<typeof RepositionableMixin>
  > {
    readonly hasRepositionableMixin: true;
    readonly isLoadingMapItems: boolean;
    readonly mapItems: unknown[];
    readonly isRepositionable: boolean;
    readonly repositionMode?: "2d" | "3d";
  }

  export function isMixedInto(model: any): model is Instance {
    return model?.hasRepositionableMixin === true;
  }
}

export default RepositionableMixin;
