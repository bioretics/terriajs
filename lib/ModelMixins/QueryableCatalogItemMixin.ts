import { computed, observable, action } from "mobx";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import StratumOrder from "../Models/Definition/StratumOrder";
import QueryableCatalogItemTraits from "../Traits/TraitsClasses/QueryableCatalogItemTraits";

type MixinModel = Model<QueryableCatalogItemTraits>;

interface QueryableProperties {
  [name: string]: {
    label: string;
    type: string;
    canAggregate: boolean;
    enumValues: string[];
  };
}

function QueryableCatalogItemMixin<T extends Constructor<MixinModel>>(Base: T) {
  abstract class QueryableCatalogItemMixin extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    @observable
    queryValues?: { [name: string]: string[] };

    @computed
    get queryProperties(): QueryableProperties | undefined {
      return Object.assign(
        {},
        ...this.queryableProperties.map((property) => {
          return {
            [property.propertyName]: {
              type: property.propertyType,
              label: property.propertyLabel,
              canAggregate: property.canAggregate,
              enumValues:
                property.propertyType === "enum"
                  ? this.getEnumValues(property.propertyName)
                  : []
            }
          };
        })
      );
    }

    @computed
    get hasQueryableCatalogItemMixin() {
      return true;
    }

    abstract filterData(): void;

    abstract getEnumValues(keys: string): string[] | undefined;

    @action
    initQueryValues() {
      if (!this.queryProperties) return;

      const initialValues = Object.entries(this.queryProperties).map(
        ([name, property]) => {
          if (property.type === "enum" /*&& this.urca*/) {
            return property.enumValues;
          } else if (property.type === "date") {
            return { [name]: ["", ""] };
          } else {
            return { [name]: [""] };
          }
        }
      );

      this.queryValues = Object.assign({}, ...initialValues);
    }

    @action
    resetQueryValues() {
      this.queryValues = undefined;
    }

    @action
    setQuery(propertyName: string, value: string[]): void {
      if (this.queryValues) {
        this.queryValues[propertyName] = value;
        this.filterData();
      }
    }
  }
  return QueryableCatalogItemMixin;
}

namespace QueryableCatalogItemMixin {
  export interface Instance
    extends InstanceType<ReturnType<typeof QueryableCatalogItemMixin>> {}

  export function isMixedInto(model: any): model is Instance {
    return model?.hasQueryableCatalogItemMixin;
  }

  export const stratumName = "queryableCatalogItemStratum";
  StratumOrder.addLoadStratum(stratumName);
}

export default QueryableCatalogItemMixin;
