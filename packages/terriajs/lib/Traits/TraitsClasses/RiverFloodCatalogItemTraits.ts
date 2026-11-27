import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import mixTraits from "../mixTraits";
import UrlTraits from "./UrlTraits";
import WaterSurfaceTraits from "./WaterSurfaceTraits";

@traitClass({
  description: `Simulates a river rising: a water surface follows the river's terrain profile, raised by \`waterRise\` metres, and the terrain hides it where the ground is higher.

This is a visual simulation, not a hydraulic model: it floods every low area within \`halfWidth\` of the river, connected to it or not.`,
  example: {
    type: "river-flood",
    name: "river-flood example",
    url: "https://example.com/river.geojson",
    halfWidth: 400,
    waterRise: 2,
    id: "some unique id"
  }
})
export default class RiverFloodCatalogItemTraits extends mixTraits(
  UrlTraits,
  WaterSurfaceTraits
) {
  @primitiveTrait({
    type: "number",
    name: "Half width",
    description:
      "Distance from the river line, in metres, that the water surface extends to on each side."
  })
  halfWidth: number = 400;

  @primitiveTrait({
    type: "number",
    name: "Sample spacing",
    description:
      "Distance between terrain height samples along the river, in metres."
  })
  sampleSpacing: number = 25;
}
