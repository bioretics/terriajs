import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import { traitClass } from "../Trait";
import CatalogMemberTraits from "./CatalogMemberTraits";
import MappableTraits from "./MappableTraits";
import OpacityTraits from "./OpacityTraits";
import UrlTraits from "./UrlTraits";

@traitClass({
  description: `Creates one catalog item from url that points to a 3D Tiles voxel tileset (3DTILES_content_voxels). The first metadata property is coloured with a continuous palette.`,
  example: {
    name: "Gulf of Mexico water temperature (HYCOM)",
    type: "3d-tiles-voxel",
    url: "test/voxels/gulf-of-mexico/tileset.json",
    colorPalette: "Spectral",
    minimumValue: 32,
    maximumValue: 4,
    noDataValue: -999,
    nearestSampling: true,
    opacity: 1,
    id: "some unique id"
  }
})
export default class VoxelCatalogItemTraits extends mixTraits(
  UrlTraits,
  MappableTraits,
  CatalogMemberTraits,
  OpacityTraits
) {
  @primitiveTrait({
    type: "string",
    name: "Color palette",
    description:
      "Name of a d3-scale-chromatic continuous color scheme, without `interpolate` (for example `Viridis`, `Spectral`, `Turbo`). Unknown names fall back to `Viridis`."
  })
  colorPalette: string = "Viridis";

  @primitiveTrait({
    type: "number",
    name: "Minimum value",
    description: "Value mapped to the start of the color palette."
  })
  minimumValue: number = 0;

  @primitiveTrait({
    type: "number",
    name: "Maximum value",
    description:
      "Value mapped to the end of the color palette. A maximum lower than the minimum reverses the palette."
  })
  maximumValue: number = 1;

  @primitiveTrait({
    type: "number",
    name: "No data value",
    description:
      "Voxels exactly equal to this value are transparent. Use together with `nearestSampling` so values are not interpolated."
  })
  noDataValue?: number;

  @primitiveTrait({
    type: "boolean",
    name: "Nearest sampling",
    description:
      "Sample the nearest voxel instead of interpolating between neighbouring voxels."
  })
  nearestSampling: boolean = false;
}
