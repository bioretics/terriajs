import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import ShapefileCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/ShapefileCatalogItem";
import Terria from "../../../../lib/Models/Terria";
import GeoJsonDataSource from "terriajs-cesium/Source/DataSources/GeoJsonDataSource";

describe("ShapefileCatalogItem", function () {
  let terria: Terria;
  let shapefile: ShapefileCatalogItem;

  beforeEach(function () {
    terria = new Terria({
      baseUrl: "./"
    });
    shapefile = new ShapefileCatalogItem("test-shapefile", terria);
    shapefile.setTrait(CommonStrata.user, "forceCesiumPrimitives", true);
  });

  it("works by URL in EPSG:28356", async function () {
    shapefile.setTrait(
      CommonStrata.user,
      "url",
      "test/Shapefile/bike_racks.zip"
    );
    await shapefile.loadMapItems();
    expect(shapefile.mapItems.length).toEqual(1);
    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values.length
    ).toEqual(315);
    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values[0].position
    ).toBeDefined();
  });

  it("works by URL in CRS:84", async function () {
    shapefile.setTrait(
      CommonStrata.user,
      "url",
      "test/Shapefile/cemeteries.zip"
    );
    await shapefile.loadMapItems();
    expect(shapefile.mapItems.length).toEqual(1);
    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values.length
    ).toEqual(59);
    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values[0].position
    ).toBeDefined();
  });

  it("works with multiple shapefiles in single zip", async () => {
    shapefile.setTrait(
      CommonStrata.user,
      "url",
      "test/Shapefile/multiple_shapefiles.zip"
    );

    await shapefile.loadMapItems();

    expect(shapefile.mapItems.length).toEqual(1);

    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values.length
    ).toEqual(374);
    expect(
      (shapefile.mapItems[0] as GeoJsonDataSource).entities.values[0].position
    ).toBeDefined();
  });

  describe("export", function () {
    it("has nothing to export before a url is set", function () {
      expect(shapefile.canExportData).toBe(false);
    });

    it("offers the zip archive itself once a url is set", async function () {
      shapefile.setTrait(
        CommonStrata.user,
        "url",
        "test/Shapefile/bike_racks.zip"
      );

      expect(shapefile.canExportData).toBe(true);
      // The shapefile is a set of sidecar files, so it is handed back whole
      // rather than converted to GeoJSON.
      expect(await shapefile.exportData()).toEqual(
        "test/Shapefile/bike_racks.zip"
      );
    });

    it("exports the archive rather than the GeoJSON it parsed", async function () {
      shapefile.setTrait(
        CommonStrata.user,
        "url",
        "test/Shapefile/cemeteries.zip"
      );
      await shapefile.loadMapItems();

      expect(await shapefile.exportData()).toEqual(
        "test/Shapefile/cemeteries.zip"
      );
    });

    it("respects an item that has export switched off", function () {
      shapefile.setTrait(
        CommonStrata.user,
        "url",
        "test/Shapefile/bike_racks.zip"
      );
      shapefile.setTrait(CommonStrata.user, "disableExport", true);

      expect(shapefile.canExportData).toBe(false);
    });
  });
});
