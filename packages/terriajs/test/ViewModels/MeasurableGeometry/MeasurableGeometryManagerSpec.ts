import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Terria from "../../../lib/Models/Terria";
import MeasurableGeometryManager from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryManager";

function carto(longitude: number, latitude: number, height = 0) {
  return new Cartographic(
    CesiumMath.toRadians(longitude),
    CesiumMath.toRadians(latitude),
    height
  );
}

function cartesian(longitude: number, latitude: number, height = 0) {
  return Cartographic.toCartesian(
    carto(longitude, latitude, height),
    Ellipsoid.WGS84
  );
}

function flushSampling() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("MeasurableGeometryManager", function () {
  let terria: Terria;
  let manager: MeasurableGeometryManager;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    manager = new MeasurableGeometryManager(terria);
  });

  describe("getGeodesicDistance", function () {
    const flindersPeak = cartesian(144.424868, -37.951033);
    const buninyong = cartesian(143.926496, -37.652821);

    it("measures the surface distance between two points", function () {
      expect(manager.getGeodesicDistance(flindersPeak, buninyong)).toBeCloseTo(
        54972.271,
        1
      );
    });

    it("is symmetric", function () {
      expect(manager.getGeodesicDistance(flindersPeak, buninyong)).toBeCloseTo(
        manager.getGeodesicDistance(buninyong, flindersPeak),
        6
      );
    });

    it("measures zero between a point and itself", function () {
      expect(manager.getGeodesicDistance(flindersPeak, flindersPeak)).toEqual(
        0
      );
    });
  });

  describe("buildCircleRingRadians", function () {
    const centerLat = CesiumMath.toRadians(44.49);
    const centerLon = CesiumMath.toRadians(11.34);
    const radius = 1000;

    it("closes the ring by repeating the first point", function () {
      const ring = manager.buildCircleRingRadians(
        centerLat,
        centerLon,
        radius,
        8
      );
      expect(ring.length).toEqual(9);
      expect(ring[8]).toEqual(ring[0]);
    });

    it("leaves the ring open when asked", function () {
      const ring = manager.buildCircleRingRadians(
        centerLat,
        centerLon,
        radius,
        8,
        false
      );
      expect(ring.length).toEqual(8);
    });

    it("places every vertex at the requested radius from the centre", function () {
      const center = new Cartographic(centerLon, centerLat, 0);
      const ring = manager.buildCircleRingRadians(
        centerLat,
        centerLon,
        radius,
        12,
        false
      );

      for (const point of ring) {
        const geodesic = new EllipsoidGeodesic(
          center,
          new Cartographic(point.lon, point.lat, 0),
          Ellipsoid.WGS84
        );
        expect(geodesic.surfaceDistance).toBeCloseTo(radius, -1);
      }
    });

    it("starts due north of the centre and turns clockwise", function () {
      const ring = manager.buildCircleRingRadians(
        centerLat,
        centerLon,
        radius,
        4,
        false
      );
      expect(ring[0].lon).toBeCloseTo(centerLon, 10);
      expect(ring[0].lat).toBeGreaterThan(centerLat);
      expect(ring[1].lon).toBeGreaterThan(centerLon);
      expect(ring[2].lat).toBeLessThan(centerLat);
      expect(ring[3].lon).toBeLessThan(centerLon);
    });
  });

  describe("calculateGeodeticArea", function () {
    it("measures zero for fewer than three points", function () {
      expect(manager.calculateGeodeticArea([])).toEqual(0);
      expect(manager.calculateGeodeticArea([carto(11.34, 44.49)])).toEqual(0);
      expect(
        manager.calculateGeodeticArea([carto(11.34, 44.49), carto(11.35, 44.5)])
      ).toEqual(0);
    });

    it("measures the area of a triangle", function () {
      const area = manager.calculateGeodeticArea([
        carto(11.34, 44.49),
        carto(11.35, 44.49),
        carto(11.34, 44.5)
      ]);
      expect(area).toBeGreaterThan(400000);
      expect(area).toBeLessThan(460000);
    });

    it("sums the triangle fan it decomposes a polygon into", function () {
      const corners = [
        carto(11.34, 44.49),
        carto(11.35, 44.49),
        carto(11.35, 44.5),
        carto(11.34, 44.5)
      ];
      const square = manager.calculateGeodeticArea(corners);
      const fan =
        manager.calculateGeodeticArea([corners[0], corners[1], corners[2]]) +
        manager.calculateGeodeticArea([corners[0], corners[2], corners[3]]);
      expect(square).toBeCloseTo(fan, 6);
    });

    it("measures a roughly 800 by 1100 metre square", function () {
      const square = manager.calculateGeodeticArea([
        carto(11.34, 44.49),
        carto(11.35, 44.49),
        carto(11.35, 44.5),
        carto(11.34, 44.5)
      ]);
      expect(square).toBeCloseTo(1113 * 794, -4);
    });
  });

  describe("sampleFromCartographics", function () {
    const stopPoints = [
      carto(144.424868, -37.951033, 100),
      carto(143.926496, -37.652821, 75)
    ];

    it("records the sampled path on terria", async function () {
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      expect(terria.measurableGeomList.length).toEqual(1);
      expect(terria.measurableGeomList[0].stopPoints.length).toEqual(2);
    });

    it("totals the geodetic distance across the stops", async function () {
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      expect(terria.measurableGeomList[0].geodeticDistance).toBeCloseTo(
        54972.271,
        1
      );
    });

    it("interpolates extra points every samplingStep metres", async function () {
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      const sampled = terria.measurableGeomList[0].sampledPoints ?? [];
      expect(sampled.length).toBeGreaterThan(100);
      expect(sampled.length).toBeLessThan(120);
    });

    it("honours a changed sampling step", async function () {
      terria.measurableGeomSamplingStep = 5000;
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      const sampled = terria.measurableGeomList[0].sampledPoints ?? [];
      expect(sampled.length).toBeGreaterThan(9);
      expect(sampled.length).toBeLessThan(14);
    });

    it("leaves the area at zero for an open path", async function () {
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      expect(terria.measurableGeomList[0].isClosed).toBe(false);
      expect(terria.measurableGeomList[0].geodeticArea).toEqual(0);
    });

    it("measures an area once the path is closed", async function () {
      manager.sampleFromCartographics(
        [carto(11.34, 44.49), carto(11.35, 44.49), carto(11.35, 44.5)],
        true
      );
      await flushSampling();

      expect(terria.measurableGeomList[0].isClosed).toBe(true);
      expect(terria.measurableGeomList[0].geodeticArea).toBeGreaterThan(0);
      expect(terria.measurableGeomList[0].airArea).toBeGreaterThan(0);
    });

    it("keeps point descriptions when the geometry is only points", async function () {
      manager.sampleFromCartographics(stopPoints, false, true, [
        "start",
        "end"
      ]);
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.onlyPoints).toBe(true);
      expect(geom.pointDescriptions).toEqual(["start", "end"]);
    });

    it("records the path notes and the uploaded flag", async function () {
      manager.sampleFromCartographics(
        stopPoints,
        false,
        false,
        [],
        "survey line",
        true
      );
      await flushSampling();

      expect(terria.measurableGeomList[0].pathNotes).toEqual("survey line");
      expect(terria.measurableGeomList[0].isFileUploaded).toBe(true);
    });

    it("writes into the slot named by indexPath", async function () {
      manager.sampleFromCartographics(stopPoints);
      await flushSampling();

      manager.sampleFromCartographics(
        [carto(11.34, 44.49, 0), carto(11.35, 44.5, 0)],
        false,
        false,
        [],
        "second path",
        false,
        1
      );
      await flushSampling();

      expect(terria.measurableGeomList.length).toEqual(2);
      expect(terria.measurableGeomList[1].pathNotes).toEqual("second path");
      expect(terria.measurableGeomList[1].indexPath).toEqual(1);
    });

    it("records a single point with no distance to travel", async function () {
      manager.sampleFromCartographics([carto(11.34, 44.49, 30)]);
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.stopPoints.length).toEqual(1);
      expect(geom.geodeticDistance).toEqual(0);
      expect(geom.airDistance).toEqual(0);
      expect(geom.groundDistance).toEqual(0);
    });
  });

  describe("updateCircleGeometry", function () {
    beforeEach(async function () {
      manager.sampleFromCartographics([
        carto(11.34, 44.49),
        carto(11.35, 44.5)
      ]);
      await flushSampling();
    });

    it("derives the radius from the centre and edge points", function () {
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      const geom = terria.measurableGeomList[0];
      expect(geom.isCircle).toBe(true);
      expect(geom.circleRadius).toBeGreaterThan(700);
      expect(geom.circleRadius).toBeLessThan(900);
    });

    it("derives diameter, perimeter and area from the radius", function () {
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      const geom = terria.measurableGeomList[0];
      const radius = geom.circleRadius!;
      expect(geom.circleDiameter).toBeCloseTo(radius * 2, 6);
      expect(geom.circlePerimeter).toBeCloseTo(2 * Math.PI * radius, 6);
      expect(geom.circleArea).toBeCloseTo(Math.PI * radius * radius, 6);
    });

    it("reports the circle as a closed geometry with an area", function () {
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      const geom = terria.measurableGeomList[0];
      expect(geom.isClosed).toBe(true);
      expect(geom.hasArea).toBe(true);
      expect(geom.onlyPoints).toBe(false);
    });

    it("uses the circle measurements as the geometry's distance and area", function () {
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      const geom = terria.measurableGeomList[0];
      expect(geom.geodeticDistance).toBeCloseTo(geom.circlePerimeter!, 6);
      expect(geom.geodeticArea).toBeCloseTo(geom.circleArea!, 6);
    });

    it("stores the centre and edge as the two stop points", function () {
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      const geom = terria.measurableGeomList[0];
      expect(geom.stopPoints.length).toEqual(2);
      expect(CesiumMath.toDegrees(geom.stopPoints[0].longitude)).toBeCloseTo(
        11.34,
        6
      );
      expect(geom.circleCenter).toBeDefined();
    });
  });

  describe("resample", function () {
    it("re-derives the geometry currently being measured", async function () {
      manager.sampleFromCartographics([
        carto(144.424868, -37.951033, 100),
        carto(143.926496, -37.652821, 75)
      ]);
      await flushSampling();
      const before = terria.measurableGeomList[0].sampledPoints?.length;

      terria.measurableGeomSamplingStep = 5000;
      manager.resample(0);
      await flushSampling();

      const after = terria.measurableGeomList[0].sampledPoints?.length;
      expect(after).toBeLessThan(before!);
    });

    it("preserves the circle measurements when resampling a circle", async function () {
      manager.sampleFromCartographics([
        carto(11.34, 44.49),
        carto(11.35, 44.5)
      ]);
      await flushSampling();
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );
      const radius = terria.measurableGeomList[0].circleRadius;

      manager.resample(0);
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.isCircle).toBe(true);
      expect(geom.circleRadius).toBeCloseTo(radius!, 6);
      expect(geom.hasArea).toBe(true);
    });

    it("keeps the workbench item the geometry was measured on", async function () {
      manager.sampleFromCartographics(
        [carto(11.34, 44.49), carto(11.35, 44.5)],
        false,
        false,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { sourceItemId: "layer-a" }
      );
      await flushSampling();
      expect(terria.measurableGeomList[0].sourceItemId).toEqual("layer-a");

      manager.resample(0);
      await flushSampling();

      expect(terria.measurableGeomList[0].sourceItemId).toEqual("layer-a");
    });

    it("keeps that item alongside the circle measurements", async function () {
      manager.sampleFromCartographics(
        [carto(11.34, 44.49), carto(11.35, 44.5)],
        false,
        false,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { sourceItemId: "layer-a" }
      );
      await flushSampling();
      manager.updateCircleGeometry(
        cartesian(11.34, 44.49),
        cartesian(11.35, 44.49),
        0
      );

      manager.resample(0);
      await flushSampling();

      const geom = terria.measurableGeomList[0];
      expect(geom.sourceItemId).toEqual("layer-a");
      expect(geom.isCircle).toBe(true);
    });

    it("does nothing for a slot that holds no geometry", function () {
      expect(() => manager.resample(5)).not.toThrow();
      expect(terria.measurableGeomList.length).toEqual(0);
    });
  });
});
