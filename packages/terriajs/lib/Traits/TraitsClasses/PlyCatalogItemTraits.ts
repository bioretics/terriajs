import primitiveTrait from "../Decorators/primitiveTrait";
import { traitClass } from "../Trait";
import mixTraits from "../mixTraits";
import GltfTraits from "./GltfTraits";
import OpacityTraits from "./OpacityTraits";
import UrlTraits from "./UrlTraits";

@traitClass({
  description: `Creates a 3D mesh or point cloud from a PLY (Polygon File Format) file. ASCII and binary files are supported.

Without \`crs\` the centre of the model is placed at \`origin\`. With \`crs\` the vertices are treated as projected coordinates and the model is placed automatically.`,
  example: {
    type: "ply",
    name: "ply example",
    url: "https://example.com/survey.ply",
    crs: "EPSG:25832",
    id: "some unique id"
  }
})
export default class PlyCatalogItemTraits extends mixTraits(
  UrlTraits,
  OpacityTraits,
  GltfTraits
) {
  @primitiveTrait({
    type: "string",
    name: "CRS",
    description:
      "Projected coordinate reference system of the vertices, as an EPSG code (eg `EPSG:25832`). When set, the model is positioned from its own coordinates (with a heading correction for grid convergence) and `origin` is ignored. When not set, the centre of the model's bounding box is placed at `origin`."
  })
  crs?: string;

  @primitiveTrait({
    type: "number",
    name: "Height offset",
    description:
      "Metres added to the vertex heights when `crs` is set. Heights are treated as ellipsoidal, so use this to correct orthometric heights (eg the geoid undulation, ~40-50 m in Italy)."
  })
  heightOffset: number = 0;

  @primitiveTrait({
    type: "number",
    name: "Point size",
    description: "Size of point cloud points, in pixels."
  })
  pointSize: number = 2;

  @primitiveTrait({
    type: "number",
    name: "Maximum points",
    description:
      "Point clouds with more points than this are uniformly decimated when loaded. Meshes are never decimated."
  })
  maximumPoints: number = 5000000;

  @primitiveTrait({
    type: "number",
    name: "Maximum file size",
    description: "Files bigger than this (in megabytes) are rejected."
  })
  maximumFileSizeMb: number = 1024;
}
