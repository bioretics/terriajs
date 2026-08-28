import { runInAction } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import MeasurableGeometryMixin from "../../lib/ModelMixins/MeasurableGeometryMixin";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import KmlCatalogItem from "../../lib/Models/Catalog/CatalogItems/KmlCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import Terria from "../../lib/Models/Terria";

function carto(longitude: number, latitude: number, height = 0) {
  return new Cartographic(
    CesiumMath.toRadians(longitude),
    CesiumMath.toRadians(latitude),
    height
  );
}

function featureCollection(features: unknown[]) {
  return {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } },
    features
  };
}

function feature(geometry: unknown) {
  return { type: "Feature", properties: {}, geometry };
}

function flushSampling() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("MeasurableGeometryMixin", function () {
  let terria: Terria;
  let item: GeoJsonCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GeoJsonCatalogItem("test", terria);
  });

  it("is mixed into the item types that can be measured", function () {
    expect(MeasurableGeometryMixin.isMixedInto(item)).toBe(true);
    expect(
      MeasurableGeometryMixin.isMixedInto(new KmlCatalogItem("kml", terria))
    ).toBe(true);
  });

  it("is not mixed into an arbitrary object", function () {
    expect(MeasurableGeometryMixin.isMixedInto({})).toBeFalsy();
    expect(MeasurableGeometryMixin.isMixedInto(undefined)).toBeFalsy();
  });

  it("registers its own stratum", function () {
    expect(MeasurableGeometryMixin.stratumName).toEqual("measureableStratum");
  });

  describe("canUseAsPath", function () {
    async function load(geoJson: unknown) {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "geoJsonData", geoJson as any);
      });
      await item.loadMapItems();
    }

    it("accepts a single LineString", async function () {
      await load(
        featureCollection([
          feature({
            type: "LineString",
            coordinates: [
              [11.34, 44.49],
              [11.35, 44.5]
            ]
          })
        ])
      );
      expect(item.canUseAsPath).toBe(true);
    });

    it("accepts a single Polygon", async function () {
      await load(
        featureCollection([
          feature({
            type: "Polygon",
            coordinates: [
              [
                [11.34, 44.49],
                [11.35, 44.49],
                [11.35, 44.5],
                [11.34, 44.49]
              ]
            ]
          })
        ])
      );
      expect(item.canUseAsPath).toBe(true);
    });

    it("accepts a collection where every feature is a MultiLineString", async function () {
      const multiLine = feature({
        type: "MultiLineString",
        coordinates: [
          [
            [11.34, 44.49],
            [11.35, 44.5]
          ]
        ]
      });
      await load(featureCollection([multiLine, multiLine]));
      expect(item.canUseAsPath).toBe(true);
    });

    it("accepts a collection where every feature is a MultiPolygon", async function () {
      const multiPolygon = feature({
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [11.34, 44.49],
              [11.35, 44.49],
              [11.35, 44.5],
              [11.34, 44.49]
            ]
          ]
        ]
      });
      await load(featureCollection([multiPolygon, multiPolygon]));
      expect(item.canUseAsPath).toBe(true);
    });

    it("rejects a lone point", async function () {
      await load(
        featureCollection([
          feature({ type: "Point", coordinates: [11.34, 44.49] })
        ])
      );
      expect(item.canUseAsPath).toBe(false);
    });

    it("rejects a collection with nothing in it", async function () {
      await load(featureCollection([]));
      expect(item.canUseAsPath).toBe(false);
    });

    it("rejects a collection whose features are of mixed geometry types", async function () {
      await load(
        featureCollection([
          feature({
            type: "MultiLineString",
            coordinates: [
              [
                [11.34, 44.49],
                [11.35, 44.5]
              ]
            ]
          }),
          feature({ type: "Point", coordinates: [11.34, 44.49] })
        ])
      );
      expect(item.canUseAsPath).toBe(false);
    });
  });

  describe("asPath", function () {
    it("samples the given positions into the measurable geometry list", async function () {
      item.asPath([carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)]);
      await flushSampling();

      expect(terria.measurableGeomList.length).toEqual(1);
      expect(terria.measurableGeomList[0].stopPoints.length).toEqual(2);
    });

    it("marks the geometry as coming from a file", async function () {
      item.asPath([carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)]);
      await flushSampling();

      expect(terria.measurableGeomList[0].isFileUploaded).toBe(true);
    });

    it("carries the path notes through", async function () {
      item.asPath(
        [carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)],
        "from a KML file"
      );
      await flushSampling();

      expect(terria.measurableGeomList[0].pathNotes).toEqual("from a KML file");
    });

    it("closes the loop when asked", async function () {
      item.asPath(
        [carto(11.34, 44.49), carto(11.35, 44.49), carto(11.35, 44.5)],
        undefined,
        undefined,
        true
      );
      await flushSampling();

      expect(terria.measurableGeomList[0].isClosed).toBe(true);
      expect(terria.measurableGeomList[0].geodeticArea).toBeGreaterThan(0);
    });

    it("writes into the slot named by indexPath", async function () {
      item.asPath([carto(11.34, 44.49), carto(11.35, 44.5)]);
      await flushSampling();
      item.asPath([carto(11.36, 44.51), carto(11.37, 44.52)], "second", 1);
      await flushSampling();

      expect(terria.measurableGeomList.length).toEqual(2);
      expect(terria.measurableGeomList[1].pathNotes).toEqual("second");
    });

    it("records the circle measurements when given a circle", async function () {
      item.asPath(
        [carto(11.34, 44.49), carto(11.35, 44.49)],
        undefined,
        undefined,
        true,
        true,
        800,
        carto(11.34, 44.49)
      );
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.isCircle).toBe(true);
      expect(geom.circleRadius).toEqual(800);
      expect(geom.circleDiameter).toEqual(1600);
    });

    it("stamps the geometry with the workbench item it came from", async function () {
      item.asPath([carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)]);
      await flushSampling();

      expect(terria.measurableGeomList[0].sourceItemId).toEqual(item.uniqueId);
    });

    it("keeps that stamp even when a sourceItemId is handed in", async function () {
      item.asPath(
        [carto(11.34, 44.49), carto(11.35, 44.5)],
        undefined,
        undefined,
        false,
        false,
        undefined,
        undefined,
        { sourceItemId: "someone-else" }
      );
      await flushSampling();

      expect(terria.measurableGeomList[0].sourceItemId).toEqual(item.uniqueId);
    });

    it("merges any extra geometry properties it is handed", async function () {
      item.asPath(
        [carto(11.34, 44.49), carto(11.35, 44.5)],
        undefined,
        undefined,
        false,
        false,
        undefined,
        undefined,
        { hasArea: true, featureProperties: { source: "upload" } }
      );
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.hasArea).toBe(true);
      expect(geom.featureProperties).toEqual({ source: "upload" });
    });
  });
});
