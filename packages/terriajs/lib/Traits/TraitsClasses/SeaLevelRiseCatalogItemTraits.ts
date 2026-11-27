import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import mixTraits from "../mixTraits";
import WaterSurfaceTraits from "./WaterSurfaceTraits";

@traitClass({
  description: `Simulates a sea level rise over \`rectangle\`: a water surface at mean sea level plus \`waterRise\` metres, hidden by the terrain where the ground is higher.

Mean sea level defaults to the EGM96 geoid height at the centre of the rectangle, since Cesium heights are ellipsoidal. This is a visual simulation: every area below the level is flooded, including those protected by levees.`,
  example: {
    type: "sea-level-rise",
    name: "sea-level-rise example",
    rectangle: { west: 12.15, south: 44.35, east: 12.4, north: 44.75 },
    waterRise: 1,
    id: "some unique id"
  }
})
export default class SeaLevelRiseCatalogItemTraits extends mixTraits(
  WaterSurfaceTraits
) {
  @primitiveTrait({
    type: "number",
    name: "Sea level height",
    description:
      "Ellipsoidal height of mean sea level, in metres. Overrides the EGM96 geoid height, eg when the terrain's heights are already relative to mean sea level (set 0)."
  })
  seaLevelHeight?: number;
}
