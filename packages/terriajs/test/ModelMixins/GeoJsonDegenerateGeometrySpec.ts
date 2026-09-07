import { runInAction } from "mobx";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import Terria from "../../lib/Models/Terria";

function featureCollection(features: unknown[]) {
  return { type: "FeatureCollection", features };
}

function feature(geometry: unknown) {
  return { type: "Feature", properties: {}, geometry };
}

describe("GeoJSON degenerate geometries", function () {
  let terria: Terria;
  let item: GeoJsonCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GeoJsonCatalogItem("test", terria);
  });

  async function load(geoJson: unknown) {
    runInAction(() => {
      item.setTrait(CommonStrata.definition, "geoJsonData", geoJson as any);
    });
    await item.loadMapItems();
  }

  describe("what it keeps", function () {
    it("keeps a point with a coordinate pair", async function () {
      await load(
        featureCollection([
          feature({ type: "Point", coordinates: [11.34, 44.49] })
        ])
      );

      expect(item.featureCounts.point).toEqual(1);
      expect(item.featureCounts.total).toEqual(1);
    });

    it("keeps a two point line", async function () {
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

      expect(item.featureCounts.line).toEqual(1);
    });

    it("keeps a closed polygon ring", async function () {
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

      expect(item.featureCounts.polygon).toEqual(1);
    });
  });

  describe("what it drops", function () {
    // Cesium can never work out a bounding sphere for these, and zoomTo then
    // hangs until it times out, so they are dropped at load time.

    it("drops a point with only one ordinate", async function () {
      await load(
        featureCollection([feature({ type: "Point", coordinates: [11.34] })])
      );

      expect(item.featureCounts.total).toEqual(0);
    });

    it("drops a line with a single vertex", async function () {
      await load(
        featureCollection([
          feature({ type: "LineString", coordinates: [[11.34, 44.49]] })
        ])
      );

      expect(item.featureCounts.total).toEqual(0);
    });

    it("drops a polygon ring with too few points to enclose anything", async function () {
      await load(
        featureCollection([
          feature({
            type: "Polygon",
            coordinates: [
              [
                [11.34, 44.49],
                [11.35, 44.5],
                [11.34, 44.49]
              ]
            ]
          })
        ])
      );

      expect(item.featureCounts.total).toEqual(0);
    });

    it("drops a multi line whose parts are single vertices", async function () {
      await load(
        featureCollection([
          feature({
            type: "MultiLineString",
            coordinates: [
              [
                [11.34, 44.49],
                [11.35, 44.5]
              ],
              [[11.36, 44.51]]
            ]
          })
        ])
      );

      expect(item.featureCounts.total).toEqual(0);
    });

    it("keeps the sound features alongside the degenerate ones", async function () {
      await load(
        featureCollection([
          feature({ type: "Point", coordinates: [11.34, 44.49] }),
          feature({ type: "LineString", coordinates: [[11.34, 44.49]] }),
          feature({ type: "Point", coordinates: [11.35, 44.5] })
        ])
      );

      expect(item.featureCounts.total).toEqual(2);
      expect(item.featureCounts.point).toEqual(2);
    });

    it("leaves a geometry type it does not know alone", async function () {
      await load(
        featureCollection([
          feature({
            type: "GeometryCollection",
            coordinates: [[11.34, 44.49]]
          })
        ])
      );

      // Nothing is dropped on a guess: the check only rules on the types it
      // knows the vertex count for.
      expect(item.featureCounts.total).toEqual(1);
    });
  });
});
