import ModelTraits from "../ModelTraits";
import primitiveTrait from "../Decorators/primitiveTrait";
import objectArrayTrait from "../Decorators/objectArrayTrait";

export class QueryablePropertyTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "propertyName",
    description: ""
  })
  propertyName: string =
    "The name of the property of the layer to use to query the data (case insensitive)";

  @primitiveTrait({
    type: "string",
    name: "propertyLabel",
    description: ""
  })
  propertyLabel: string = "The label to show in the interface";

  @primitiveTrait({
    type: "string",
    name: "propertyType",
    description:
      "The type of the property, one of string, number, enum (use all property values from the layer), date (use a range of two dates)"
  })
  propertyType: "string" | "number" | "enum" | "date" = "string";

  @primitiveTrait({
    type: "boolean",
    name: "canAggregate",
    description: "If true, user can aggregate the data by this property"
  })
  canAggregate: boolean = false;
}

export default class QueryableCatalogItemTraits extends ModelTraits {
  @objectArrayTrait({
    type: QueryablePropertyTraits,
    name: "queryableProperties",
    description: "The properties to use to query the layer data",
    idProperty: "propertyName"
  })
  queryableProperties?: QueryablePropertyTraits[];
}
