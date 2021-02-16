import ModelTraits from "./ModelTraits";
import primitiveTrait from "./primitiveTrait";

export default class AttributionTraits extends ModelTraits {
  @primitiveTrait({
    name: "Attribution",
    description: "The attribution to display with the data.",
    type: "string"
  })
  attribution?: string;
}
