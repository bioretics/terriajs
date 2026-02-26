import primitiveTrait from "../Decorators/primitiveTrait";
import ModelTraits from "../ModelTraits";

export default class AutoComputeClippingPlanes extends ModelTraits {
  @primitiveTrait({
    type: "boolean",
    name: "autoComputeFromContent",
    description:
      "If true, automatically compute the clipping planes from layer content."
  })
  autoComputeFromContent: boolean = false;
}
