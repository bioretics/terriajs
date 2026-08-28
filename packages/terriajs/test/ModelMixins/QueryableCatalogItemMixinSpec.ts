import { runInAction } from "mobx";
import QueryableCatalogItemMixin from "../../lib/ModelMixins/QueryableCatalogItemMixin";
import CreateModel from "../../lib/Models/Definition/CreateModel";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import updateModelFromJson from "../../lib/Models/Definition/updateModelFromJson";
import Terria from "../../lib/Models/Terria";
import QueryableCatalogItemTraits from "../../lib/Traits/TraitsClasses/QueryableCatalogItemTraits";

class QueryableTestItem extends QueryableCatalogItemMixin(
  CreateModel(QueryableCatalogItemTraits)
) {
  /** What the layer would offer for each enum property right now. */
  valuesOnScreen: { [name: string]: string[] } = {};
  filterDataCount = 0;

  filterData(): void {
    this.filterDataCount++;
  }

  getEnumValues(propertyName: string): string[] {
    return [this.ENUM_ALL_VALUE, ...(this.valuesOnScreen[propertyName] ?? [])];
  }

  getFeaturePropertiesByName(): { [key: string]: any }[] {
    return [];
  }
}

describe("QueryableCatalogItemMixin", function () {
  let terria: Terria;
  let item: QueryableTestItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new QueryableTestItem("queryable", terria);
    updateModelFromJson(item, CommonStrata.definition, {
      queryableProperties: [
        {
          propertyName: "comune",
          propertyLabel: "Comune",
          propertyType: "enum"
        },
        {
          propertyName: "quota",
          propertyLabel: "Quota",
          propertyType: "number"
        }
      ]
    }).logError();
    item.valuesOnScreen = { comune: ["Bologna", "Modena"] };
  });

  it("is mixed into the item", function () {
    expect(QueryableCatalogItemMixin.isMixedInto(item)).toBe(true);
  });

  it("reads filter values from the visible features unless told otherwise", function () {
    expect(item.queryableProperties?.[0].loadValuesFromService).toBe(false);
  });

  describe("sanitizeQueryValues", function () {
    beforeEach(function () {
      runInAction(() => item.initQueryValues());
      item.filterDataCount = 0;
    });

    it("does nothing before the filters have been set up", function () {
      const fresh = new QueryableTestItem("fresh", terria);
      expect(() =>
        runInAction(() => fresh.sanitizeQueryValues())
      ).not.toThrow();
      expect(fresh.queryValues).toBeUndefined();
    });

    it("keeps a selection the layer still offers", function () {
      runInAction(() => item.setQuery("comune", ["Bologna"]));
      item.filterDataCount = 0;

      runInAction(() => item.sanitizeQueryValues());

      expect(item.queryValues?.comune).toEqual(["Bologna"]);
      expect(item.filterDataCount).toEqual(0);
    });

    it("clears a selection the layer no longer offers", function () {
      runInAction(() => item.setQuery("comune", ["Bologna"]));
      item.valuesOnScreen = { comune: ["Modena"] };
      runInAction(() => item.updateEnumValues());
      item.filterDataCount = 0;

      runInAction(() => item.sanitizeQueryValues());

      expect(item.queryValues?.comune).toEqual([""]);
    });

    it("re-filters the layer after clearing a stale selection", function () {
      runInAction(() => item.setQuery("comune", ["Bologna"]));
      item.valuesOnScreen = { comune: [] };
      runInAction(() => item.updateEnumValues());
      item.filterDataCount = 0;

      runInAction(() => item.sanitizeQueryValues());

      expect(item.filterDataCount).toEqual(1);
      expect(item.enumValues?.comune).toEqual([item.ENUM_ALL_VALUE]);
    });

    it("leaves an empty selection alone", function () {
      item.valuesOnScreen = { comune: [] };

      runInAction(() => item.sanitizeQueryValues());

      expect(item.queryValues?.comune).toEqual([""]);
      expect(item.filterDataCount).toEqual(0);
    });

    it("leaves the catch-all selection alone", function () {
      runInAction(() => item.setQuery("comune", [item.ENUM_ALL_VALUE]));
      item.valuesOnScreen = { comune: [] };
      runInAction(() => item.updateEnumValues());
      item.filterDataCount = 0;

      runInAction(() => item.sanitizeQueryValues());

      expect(item.queryValues?.comune).toEqual([item.ENUM_ALL_VALUE]);
      expect(item.filterDataCount).toEqual(0);
    });

    it("ignores properties that are not enums", function () {
      runInAction(() => item.setQuery("quota", ["100"]));
      item.filterDataCount = 0;

      runInAction(() => item.sanitizeQueryValues());

      expect(item.queryValues?.quota).toEqual(["100"]);
      expect(item.filterDataCount).toEqual(0);
    });
  });
});
