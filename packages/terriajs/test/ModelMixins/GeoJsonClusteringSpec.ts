import { runInAction } from "mobx";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import updateModelFromJson from "../../lib/Models/Definition/updateModelFromJson";
import Terria from "../../lib/Models/Terria";

const points = {
  type: "FeatureCollection" as const,
  features: [
    [11.34, 44.49],
    [11.3401, 44.4901],
    [11.3402, 44.4902],
    [11.36, 44.51]
  ].map((coordinates) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates }
  }))
};

describe("GeoJSON clustering", function () {
  let terria: Terria;
  let item: GeoJsonCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GeoJsonCatalogItem("test", terria);
    runInAction(() => {
      item.setTrait(CommonStrata.definition, "geoJsonData", points);
      item.setTrait(CommonStrata.definition, "forceCesiumPrimitives", true);
    });
  });

  describe("defaults", function () {
    it("is off, so existing maps keep their individual pins", function () {
      expect(item.clustering.enabled).toBe(false);
    });

    it("has the pin and grouping defaults the traits declare", function () {
      expect(item.clustering.pixelRange).toEqual(35);
      expect(item.clustering.minimumClusterSize).toEqual(5);
      expect(item.clustering.pinSize).toEqual(60);
      expect(item.clustering.pinBackgroundColor).toEqual("gray");
    });
  });

  describe("when disabled", function () {
    it("leaves the data source's clustering alone", async function () {
      await item.loadMapItems();
      expect(item.data?.clustering.enabled).toBe(false);
    });
  });

  describe("when enabled", function () {
    beforeEach(function () {
      updateModelFromJson(item, CommonStrata.definition, {
        clustering: { enabled: true }
      });
    });

    it("turns on clustering for the data source", async function () {
      await item.loadMapItems();
      expect(item.data?.clustering.enabled).toBe(true);
    });

    it("passes the default pixel range and cluster size through", async function () {
      await item.loadMapItems();
      expect(item.data?.clustering.pixelRange).toEqual(35);
      expect(item.data?.clustering.minimumClusterSize).toEqual(5);
    });

    it("passes configured values through to the data source", async function () {
      updateModelFromJson(item, CommonStrata.definition, {
        clustering: { enabled: true, pixelRange: 80, minimumClusterSize: 2 }
      });
      await item.loadMapItems();

      expect(item.data?.clustering.pixelRange).toEqual(80);
      expect(item.data?.clustering.minimumClusterSize).toEqual(2);
    });

    it("still loads every point into the data source", async function () {
      await item.loadMapItems();
      expect(item.data?.entities.values.length).toEqual(4);
    });

    it("listens for cluster events so it can draw the count pin", async function () {
      await item.loadMapItems();
      expect(item.data?.clustering.clusterEvent.numberOfListeners).toEqual(1);
    });
  });
});
