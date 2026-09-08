import { isJson, isZip } from "../../lib/Core/loadBlob";

describe("loadBlob", function () {
  describe("isZip", function () {
    it("recognises a zip by its extension", function () {
      expect(isZip("bike_racks.zip")).toBe(true);
      expect(isZip("http://example.com/data/cemeteries.zip")).toBe(true);
    });

    it("ignores the case of the extension", function () {
      expect(isZip("BIKE_RACKS.ZIP")).toBe(true);
      expect(isZip("bike_racks.Zip")).toBe(true);
    });

    it("looks past a query string or a fragment", function () {
      expect(isZip("http://example.com/data.zip?token=abc")).toBe(true);
      expect(isZip("http://example.com/data.zip#section")).toBe(true);
      expect(isZip("blob:http://localhost/uuid.zip?v=2")).toBe(true);
    });

    it("does not mistake a name that merely contains .zip for a zip", function () {
      // A FeatureInfo download off a shapefile item is named after the item,
      // so the archive extension ends up in the middle of the file name.
      expect(isZip("bike_racks.zip.csv")).toBe(false);
      expect(isZip("bike_racks.zip.json")).toBe(false);
      expect(isZip("bike_racks.zip_features.geojson")).toBe(false);
    });

    it("is not fooled by a directory called zip", function () {
      expect(isZip("http://example.com/.zip/data.geojson")).toBe(false);
    });

    it("rejects anything without the extension at all", function () {
      expect(isZip("")).toBe(false);
      expect(isZip("bike_racks")).toBe(false);
      expect(isZip("zipped.tar.gz")).toBe(false);
    });
  });

  describe("isJson", function () {
    it("recognises json and geojson", function () {
      expect(isJson("data.json")).toBe(true);
      expect(isJson("data.geojson")).toBe(true);
      expect(isJson("DATA.JSON")).toBe(true);
    });

    it("rejects other extensions", function () {
      expect(isJson("data.csv")).toBe(false);
      expect(isJson("data.zip")).toBe(false);
    });
  });
});
