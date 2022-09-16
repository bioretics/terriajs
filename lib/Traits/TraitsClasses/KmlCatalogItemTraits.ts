import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import LegendOwnerTraits from "./LegendOwnerTraits";
import MappableTraits from "./MappableTraits";
import UrlTraits from "./UrlTraits";
import MeasurableTraits from "./MeasurableTraits";

export default class KmlCatalogItemTraits extends mixTraits(
  MeasurableTraits,
  UrlTraits,
  MappableTraits,
  CatalogMemberTraits,
  LegendOwnerTraits
) {
  @primitiveTrait({
    type: "string",
    name: "kmlString",
    description: "A kml string"
  })
  kmlString?: string;
}
