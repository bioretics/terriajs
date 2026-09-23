import { JsonObject } from "../../../lib/Core/Json";
import AttributeTableSource from "../../../lib/Models/AttributeTable/AttributeTableSource";
import CsvCatalogItem from "../../../lib/Models/Catalog/CatalogItems/CsvCatalogItem";
import GeoJsonCatalogItem from "../../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../lib/Models/Terria";

const featureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { NOME: "Forli", QUOTA: 34 },
      geometry: { type: "Point", coordinates: [12.04, 44.22] }
    },
    {
      type: "Feature",
      properties: { NOME: "Cesena", QUOTA: 44 },
      geometry: { type: "Point", coordinates: [12.24, 44.14] }
    },
    {
      type: "Feature",
      properties: { NOME: "Senza geometria" },
      geometry: null
    }
  ]
};

describe("AttributeTableSource", function () {
  let terria: Terria;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
  });

  describe("with a GeoJSON item", function () {
    let item: GeoJsonCatalogItem;

    beforeEach(async function () {
      item = new GeoJsonCatalogItem("test-geojson", terria);
      item.setTrait(
        CommonStrata.user,
        "geoJsonData",
        featureCollection as JsonObject
      );
      await item.loadMapItems();
    });

    it("can be opened", function () {
      expect(AttributeTableSource.canOpen(item)).toBe(true);
    });

    it("reads one row per feature, keyed by the Terria feature id", function () {
      const source = new AttributeTableSource(item);
      // GeoJsonMixin drops features without a geometry while loading, so the
      // third feature of the collection never reaches the table.
      expect(source.rows.length).toBe(2);
      expect(source.rows.map((row) => row.featureId)).toEqual(["0", "1"]);
      expect(source.rows[0].properties.NOME).toBe("Forli");
      expect(source.rows[0].properties.QUOTA).toBe(34);
      expect(
        source.rows.some((row) => row.properties.NOME === "Senza geometria")
      ).toBe(false);
    });

    it("hides the internal feature id property from the columns", function () {
      const source = new AttributeTableSource(item);
      expect(source.columns).toEqual(["NOME", "QUOTA"]);
      expect(source.rows[0].properties._id_).toBeUndefined();
    });

    it("gives a point feature a padded rectangle to zoom to", function () {
      const source = new AttributeTableSource(item);
      const rectangle = source.rows[0].rectangle;
      expect(rectangle).toBeDefined();
      expect(rectangle!.width).toBeGreaterThan(0);
      expect(rectangle!.height).toBeGreaterThan(0);
    });

    it("keeps the GeoJSON feature so the map can highlight it", function () {
      const source = new AttributeTableSource(item);
      expect(source.rows[1].geoJsonFeature?.geometry?.type).toBe("Point");
    });
  });

  describe("with a CSV item", function () {
    let item: CsvCatalogItem;

    beforeEach(async function () {
      item = new CsvCatalogItem("test-csv", terria, undefined);
      item.setTrait(
        CommonStrata.user,
        "csvString",
        "lat,lon,nome\n44.22,12.04,Forli\n44.14,12.24,Cesena"
      );
      await item.loadMapItems();
    });

    it("can be opened", function () {
      expect(AttributeTableSource.canOpen(item)).toBe(true);
    });

    it("reads one row per table row, with every column", function () {
      const source = new AttributeTableSource(item);
      expect(source.rows.length).toBe(2);
      expect(source.columns).toEqual(["lat", "lon", "nome"]);
      expect(source.rows[1].properties.nome).toBe("Cesena");
    });

    it("locates a row from its longitude/latitude columns", function () {
      const source = new AttributeTableSource(item);
      expect(source.rows[0].rectangle).toBeDefined();
    });
  });
});
