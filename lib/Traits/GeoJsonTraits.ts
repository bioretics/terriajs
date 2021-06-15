import { JsonObject } from "../Core/Json";
import anyTrait from "./anyTrait";
import CatalogMemberTraits from "./CatalogMemberTraits";
import DiscretelyTimeVaryingTraits from "./DiscretelyTimeVaryingTraits";
import FeatureInfoTraits from "./FeatureInfoTraits";
import MappableTraits from "./MappableTraits";
import mixTraits from "./mixTraits";
import ModelTraits from "./ModelTraits";
import objectArrayTrait from "./objectArrayTrait";
import objectTrait from "./objectTrait";
import primitiveTrait from "./primitiveTrait";
import StyleTraits from "./StyleTraits";
import UrlTraits from "./UrlTraits";

export class PerPropertyGeoJsonStyleTraits extends ModelTraits {
  @anyTrait({
    name: "Properties",
    description:
      "If the properties of a feature match these properties, then apply the style to that feature"
  })
  properties?: JsonObject;

  @objectTrait({
    name: "Style",
    type: StyleTraits,
    description:
      "Styling rules to apply, following [simplestyle-spec](https://github.com/mapbox/simplestyle-spec)"
  })
  style?: StyleTraits;

  @primitiveTrait({
    name: "Case sensitive",
    type: "boolean",
    description:
      "True if properties should be matched in a case sensitive fashion"
  })
  caseSensitive?: boolean = false;
}
export class GeoJsonTraits extends mixTraits(
  FeatureInfoTraits,
  UrlTraits,
  MappableTraits,
  CatalogMemberTraits,
  DiscretelyTimeVaryingTraits
) {
  @objectTrait({
    type: StyleTraits,
    name: "Style",
    description:
      "Styling rules that follow [simplestyle-spec](https://github.com/mapbox/simplestyle-spec)"
  })
  style?: StyleTraits;

  @primitiveTrait({
    type: "boolean",
    name: "Clamp to Ground",
    description:
      "Whether the features in this GeoJSON should be clamped to the terrain surface."
  })
  clampToGround: boolean = true;

  @objectArrayTrait({
    name: "Per property styles",
    type: PerPropertyGeoJsonStyleTraits,
    description: "Override feature styles according to their properties.",
    idProperty: "index"
  })
  perPropertyStyles: PerPropertyGeoJsonStyleTraits[] = [];

  @primitiveTrait({
    name: "Time property",
    type: "string",
    description:
      "The property of each GeoJSON feature that specifies which point in time that feature is associated with. If not specified, it is assumed that the dataset is constant throughout time."
  })
  timeProperty?: string;
}
