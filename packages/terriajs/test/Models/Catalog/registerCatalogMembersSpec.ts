import { RER_POI_CATALOG_ITEM_TYPE } from "../../../lib/ModelMixins/RerPoiHelpers";
import { UrlToCatalogMemberMapping } from "../../../lib/Models/Catalog/CatalogReferences/UrlReference";
import ArcGisFeatureServerCatalogItem from "../../../lib/Models/Catalog/Esri/ArcGisFeatureServerCatalogItem";
import CatalogMemberFactory from "../../../lib/Models/Catalog/CatalogMemberFactory";
import RerPoiCatalogItem from "../../../lib/Models/Catalog/Esri/RerPoiCatalogItem";

const POI_URL =
  "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0";

/** The type a dropped or pasted url would be turned into. */
function firstMatchFor(url: string) {
  return UrlToCatalogMemberMapping.mapping.find((entry) => entry.matcher(url))
    ?.type;
}

describe("registerCatalogMembers", function () {
  it("registers the RER POI catalog item", function () {
    expect(CatalogMemberFactory.find(RER_POI_CATALOG_ITEM_TYPE)).toBe(
      RerPoiCatalogItem
    );
  });

  describe("url matching", function () {
    it("sends the RER POI service to the POI catalog item", function () {
      expect(firstMatchFor(POI_URL)).toEqual(RER_POI_CATALOG_ITEM_TYPE);
    });

    it("prefers the POI item over the generic MapServer layer rule", function () {
      // The POI url is also an ArcGIS MapServer layer url, so order matters.
      expect(firstMatchFor(`${POI_URL}/query`)).toEqual(
        RER_POI_CATALOG_ITEM_TYPE
      );
    });

    it("sends an ArcGIS MapServer layer to a feature server item", function () {
      expect(
        firstMatchFor("https://example.com/arcgis/rest/services/x/MapServer/3")
      ).toEqual(ArcGisFeatureServerCatalogItem.type);
    });

    it("sends a MapServer layer served without the /arcgis prefix too", function () {
      expect(
        firstMatchFor("https://example.com/rest/services/x/MapServer/12")
      ).toEqual(ArcGisFeatureServerCatalogItem.type);
    });

    it("leaves a whole MapServer alone", function () {
      expect(
        firstMatchFor("https://example.com/arcgis/rest/services/x/MapServer")
      ).not.toEqual(ArcGisFeatureServerCatalogItem.type);
    });
  });
});
