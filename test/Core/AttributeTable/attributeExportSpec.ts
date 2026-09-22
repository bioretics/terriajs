import {
  attributeRowsToCsv,
  attributeRowsToGeoJson,
  formatAttributeValue,
  sanitizeExportFileName
} from "../../../lib/Core/AttributeTable/attributeExport";
import { AttributeTableRow } from "../../../lib/Models/AttributeTable/AttributeTableSource";

const rows: AttributeTableRow[] = [
  {
    featureId: "0",
    properties: { NOME: "Forli", QUOTA: 34 },
    geoJsonFeature: {
      type: "Feature",
      properties: { NOME: "Forli" },
      geometry: { type: "Point", coordinates: [12.04, 44.22] }
    }
  },
  {
    featureId: "1",
    properties: { NOME: "Senza, virgola", QUOTA: null }
  }
];

describe("attributeExport", function () {
  describe("formatAttributeValue", function () {
    it("renders primitives as themselves and nullish as empty", function () {
      expect(formatAttributeValue("x")).toBe("x");
      expect(formatAttributeValue(3.5)).toBe("3.5");
      expect(formatAttributeValue(false)).toBe("false");
      expect(formatAttributeValue(null)).toBe("");
      expect(formatAttributeValue(undefined)).toBe("");
    });

    it("stringifies objects and arrays", function () {
      expect(formatAttributeValue({ a: 1 })).toBe('{"a":1}');
      expect(formatAttributeValue([1, 2])).toBe("[1,2]");
    });
  });

  describe("attributeRowsToCsv", function () {
    it("writes a header, the feature id and one column per field", function () {
      const csv = attributeRowsToCsv(rows, ["NOME", "QUOTA"]);
      const lines = csv.split(/\r?\n/);
      expect(lines[0]).toBe("id,NOME,QUOTA");
      expect(lines[1]).toBe("0,Forli,34");
      // A value holding the delimiter must come back quoted.
      expect(lines[2]).toBe('1,"Senza, virgola",');
    });
  });

  describe("attributeRowsToGeoJson", function () {
    it("keeps the geometry when there is one and a null geometry otherwise", function () {
      const geojson = attributeRowsToGeoJson(rows) as any;
      expect(geojson.type).toBe("FeatureCollection");
      expect(geojson.features.length).toBe(2);
      expect(geojson.features[0].geometry.type).toBe("Point");
      expect(geojson.features[1].geometry).toBeNull();
      expect(geojson.features[1].properties.NOME).toBe("Senza, virgola");
    });

    it("returns undefined with no rows", function () {
      expect(attributeRowsToGeoJson([])).toBeUndefined();
    });
  });

  describe("sanitizeExportFileName", function () {
    it("replaces the characters a file name cannot hold", function () {
      expect(sanitizeExportFileName("RER/POI: 2024")).toBe("RER-POI- 2024");
    });

    it("falls back when nothing is left", function () {
      expect(sanitizeExportFileName("   ")).toBe("layer");
    });
  });
});
