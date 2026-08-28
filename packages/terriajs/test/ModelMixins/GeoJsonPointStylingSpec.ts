import { runInAction } from "mobx";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import Terria from "../../lib/Models/Terria";

const POI_URL =
  "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0";

function pointCollection(count: number) {
  return {
    type: "FeatureCollection" as const,
    features: Array.from({ length: count }, (_, i) => ({
      type: "Feature" as const,
      properties: { index: i },
      geometry: {
        type: "Point" as const,
        coordinates: [11.34 + i * 0.0001, 44.49 + i * 0.0001]
      }
    }))
  };
}

describe("GeoJSON point styling", function () {
  let terria: Terria;
  let item: GeoJsonCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GeoJsonCatalogItem("test", terria);
  });

  function load(count: number) {
    runInAction(() => {
      item.setTrait(
        CommonStrata.definition,
        "geoJsonData",
        pointCollection(count) as any
      );
    });
    return item.loadMapItems();
  }

  describe("large point layers", function () {
    it("keeps table styling for a layer of 500 points", async function () {
      await load(500);

      expect(item.forceCesiumPrimitives).toBeFalsy();
      expect(item.useTableStylingAndProtomaps).toBe(true);
    });

    it("switches a layer of more than 500 points to Cesium primitives", async function () {
      await load(501);

      expect(item.forceCesiumPrimitives).toBe(true);
      expect(item.useTableStylingAndProtomaps).toBe(false);
    });

    it("still loads every point of a large layer", async function () {
      await load(501);

      expect(item.data?.entities.values.length).toEqual(501);
    });
  });

  describe("the RER POI service", function () {
    it("is drawn with POI markers rather than table styling", function () {
      item.setTrait(CommonStrata.definition, "url", POI_URL);

      expect(item.useTableStylingAndProtomaps).toBe(false);
    });

    it("leaves other geojson urls on table styling", function () {
      item.setTrait(CommonStrata.definition, "url", "test/GeoJSON/api.geojson");

      expect(item.useTableStylingAndProtomaps).toBe(true);
    });
  });
});
