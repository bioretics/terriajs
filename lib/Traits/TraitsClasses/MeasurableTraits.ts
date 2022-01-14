import ModelTraits from "../ModelTraits";
import primitiveTrait from "../Decorators/primitiveTrait";
// import primitiveArrayTrait from "../Decorators/primitiveArrayTrait";

export default class MeasurableTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "measure",
    description: ""
  })
  measure?: string;
}
