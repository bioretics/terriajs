import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import MappableTraits from "./MappableTraits";
import OpacityTraits from "./OpacityTraits";

export default class WaterSurfaceTraits extends mixTraits(
  OpacityTraits,
  MappableTraits,
  CatalogMemberTraits
) {
  @primitiveTrait({
    type: "number",
    name: "Water rise",
    description: "How much the water level is raised, in metres."
  })
  waterRise: number = 0;

  @primitiveTrait({
    type: "number",
    name: "Maximum water rise",
    description: "Upper limit of the water rise control, in metres."
  })
  maximumWaterRise: number = 10;
}
