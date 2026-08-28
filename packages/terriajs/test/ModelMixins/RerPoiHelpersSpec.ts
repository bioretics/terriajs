import {
  isRerPoiUrl,
  normalizeRerPoiUrl,
  RER_POI_CATALOG_ITEM_TYPE
} from "../../lib/ModelMixins/RerPoiHelpers";

const POI_URL =
  "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0";

describe("RerPoiHelpers", function () {
  it("names the catalog item type", function () {
    expect(RER_POI_CATALOG_ITEM_TYPE).toEqual("rer-poi");
  });

  describe("normalizeRerPoiUrl", function () {
    it("returns an empty string when there is no url", function () {
      expect(normalizeRerPoiUrl(undefined)).toEqual("");
    });

    it("trims surrounding whitespace", function () {
      expect(normalizeRerPoiUrl(`  ${POI_URL}  `)).toEqual(POI_URL);
    });

    it("drops the query string and the fragment", function () {
      expect(normalizeRerPoiUrl(`${POI_URL}?f=json`)).toEqual(POI_URL);
      expect(normalizeRerPoiUrl(`${POI_URL}#layer`)).toEqual(POI_URL);
    });

    it("drops the query endpoint", function () {
      expect(normalizeRerPoiUrl(`${POI_URL}/query`)).toEqual(POI_URL);
      expect(normalizeRerPoiUrl(`${POI_URL}/query/`)).toEqual(POI_URL);
    });

    it("drops trailing slashes", function () {
      expect(normalizeRerPoiUrl(`${POI_URL}///`)).toEqual(POI_URL);
    });
  });

  describe("isRerPoiUrl", function () {
    it("recognises the POI layer", function () {
      expect(isRerPoiUrl(POI_URL)).toBe(true);
    });

    it("recognises it however it was written down", function () {
      expect(isRerPoiUrl(`${POI_URL}/`)).toBe(true);
      expect(isRerPoiUrl(`${POI_URL}/query?f=json`)).toBe(true);
      expect(isRerPoiUrl(POI_URL.replace("https", "http"))).toBe(true);
      expect(isRerPoiUrl(POI_URL.toUpperCase())).toBe(true);
    });

    it("does not recognise another layer of the same service", function () {
      expect(isRerPoiUrl(POI_URL.replace("MapServer/0", "MapServer/1"))).toBe(
        false
      );
      expect(isRerPoiUrl(POI_URL.replace("MapServer/0", "MapServer"))).toBe(
        false
      );
    });

    it("does not recognise another service", function () {
      expect(
        isRerPoiUrl(
          "https://example.com/geoags/rest/services/portale/rer3d_poi/MapServer/0"
        )
      ).toBe(false);
      expect(
        isRerPoiUrl(
          "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_edifici/MapServer/0"
        )
      ).toBe(false);
    });

    it("does not recognise a missing url", function () {
      expect(isRerPoiUrl(undefined)).toBe(false);
      expect(isRerPoiUrl("")).toBe(false);
    });
  });
});
