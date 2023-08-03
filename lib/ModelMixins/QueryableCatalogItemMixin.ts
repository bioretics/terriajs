import { computed, observable, action } from "mobx";
import Constructor from "../Core/Constructor";
import Model from "../Models/Definition/Model";
import StratumOrder from "../Models/Definition/StratumOrder";
import QueryableCatalogItemTraits from "../Traits/TraitsClasses/QueryableCatalogItemTraits";

type MixinModel = Model<QueryableCatalogItemTraits>;

export interface QueryableProperties {
  [name: string]: {
    label: string;
    type: string;
    measureUnit?: string;
    decimalPlaces: number;
    canAggregate: boolean;
    sumOnAggregation: boolean;
  };
}

function QueryableCatalogItemMixin<T extends Constructor<MixinModel>>(Base: T) {
  abstract class QueryableCatalogItemMixin extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    get ENUM_ALL_VALUE(): string {
      return "--all";
    }

    @observable
    queryValues?: { [name: string]: string[] };

    @observable
    enumValues?: { [name: string]: string[] };

    @observable
    numberOfTotalElements?: number;

    @observable
    numberOfVisibleElements?: number;

    @computed
    get queryProperties(): QueryableProperties | undefined {
      return Object.assign(
        {},
        ...this.queryableProperties.map((property) => {
          return {
            [property.propertyName]: {
              type: property.propertyType,
              label: property.propertyLabel,
              measureUnit: property.propertyMeasureUnit,
              decimalPlaces: property.propertyDecimalPlaces,
              canAggregate: property.canAggregate,
              sumOnAggregation: property.sumOnAggregation
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

    abstract getEnumValues(propertyName: string): string[] | undefined;

    abstract getFeaturePropertiesByName(
      propertyNames: string[]
    ): { [key: string]: any }[] | undefined;

    @action
    updateEnumValues() {
      if (!this.queryProperties) return;

      const enums = Object.entries(this.queryProperties)
        .filter(([_, property]) => property.type === "enum")
        .map(([name, _]) => {
          return { [name]: this.getEnumValues(name) };
        });

      this.enumValues = Object.assign(
        {},
        ...enums.filter((elem) => elem !== undefined)
      );
    }

    @action
    initQueryValues() {
      if (!this.queryProperties) return;

      this.updateEnumValues();

      const initialValues = Object.entries(this.queryProperties).map(
        ([name, property]) => {
          if (property.type === "date") {
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
        this.updateEnumValues();
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
