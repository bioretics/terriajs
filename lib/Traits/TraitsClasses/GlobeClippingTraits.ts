import primitiveTrait from "../Decorators/primitiveTrait";
import ModelTraits from "../ModelTraits";

export default class GlobeClippingTraits extends ModelTraits {
  @primitiveTrait({
    type: "boolean",
    name: "globeClippingControlShowed",
    description:
      "If true, shows item control to enable automatically calculation of globe clipping planes using items data."
  })
  globeClippingControlShowed: boolean = false;

  @primitiveTrait({
    type: "boolean",
    name: "globeClippingEnabled",
    description: "Enable/disable globe auto clipping planes."
  })
  globeClippingEnabled: boolean = true;

  @primitiveTrait({
    type: "number",
    name: "globeClippingRadius",
    description:
      "Half width, in metres, of the region of globe to clip out. If omitted it is worked out from the extent of the item's data, which is not possible for an item that sits at a single point, such as a glTF model."
  })
  globeClippingRadius?: number;
}
