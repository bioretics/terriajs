import FeatureInfoTraits from "./FeatureInfoTraits";
import UrlTraits from "./UrlTraits";
import MappableTraits from "./MappableTraits";
import mixTraits from "../mixTraits";
import CatalogMemberTraits from "./CatalogMemberTraits";
import primitiveTrait from "../Decorators/primitiveTrait";
import LegendOwnerTraits from "./LegendOwnerTraits";
import MeasurableTraits from "./MeasurableTraits";

export default class KmlCatalogItemTraits extends mixTraits(
  MeasurableTraits,
  FeatureInfoTraits,
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
