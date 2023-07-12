import ModelTraits from "../ModelTraits";
import primitiveTrait from "../Decorators/primitiveTrait";
import objectArrayTrait from "../Decorators/objectArrayTrait";

export class QueryablePropertyTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "propertyName",
    description:
      "The name of the property of the layer to use to query the data (case insensitive)"
  })
  propertyName: string = "";

  @primitiveTrait({
    type: "string",
    name: "propertyLabel",
    description: "The label to show in the interface"
  })
  propertyLabel: string = "";

  @primitiveTrait({
    type: "string",
    name: "propertyMeasureUnit",
    description:
      "The unit of measurement of the property (only if type is 'number')"
  })
  propertyMeasureUnit?: string;

  @primitiveTrait({
    type: "number",
    name: "propertyDecimalPlaces",
    description:
      "The number of decimal places to show (only if type is 'number')"
  })
  propertyDecimalPlaces: number = 0;

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

  @primitiveTrait({
    type: "boolean",
    name: "sumOnAggregation",
    description:
      "If true, on aggregation show also se sum of this value (only if type is 'number')"
  })
  sumOnAggregation: boolean = false;
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
