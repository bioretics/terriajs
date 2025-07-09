import ModelTraits from "../ModelTraits";
import primitiveTrait from "../Decorators/primitiveTrait";

export default class SearchableCatalogItemTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "nameOfCatalogItemSearchField",
    description: "The field in which to search"
  })
  nameOfCatalogItemSearchField: string = "";
}
