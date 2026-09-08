import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import {
  generatePathSummaryTxtData,
  getSummaryKind
} from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometrySummary";
import { MeasurableGeometry } from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryManager";

function makeGeometry(
  overrides: Partial<MeasurableGeometry> = {}
): MeasurableGeometry {
  return {
    isClosed: false,
    hasArea: false,
    stopPoints: [],
    stopGeodeticDistances: [],
    ...overrides
  };
}

function carto(longitude: number, latitude: number, height: number) {
  return new Cartographic(
    CesiumMath.toRadians(longitude),
    CesiumMath.toRadians(latitude),
    height
  );
}

function parseSummary(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const separator = line.indexOf(": ");
    if (separator === -1) continue;
    result[line.slice(0, separator)] = line.slice(separator + 2);
  }
  return result;
}

describe("MeasurableGeometrySummary", function () {
  describe("getSummaryKind", function () {
    it("reports a polygon when the polygon tool is active", function () {
      const geom = makeGeometry({ onlyPoints: true });
      expect(getSummaryKind({ geom, activeToolIsPolygon: true })).toEqual(
        "polygon"
      );
    });

    it("reports a polygon when the geometry has an area", function () {
      const geom = makeGeometry({ hasArea: true });
      expect(getSummaryKind({ geom, activeToolIsPolygon: false })).toEqual(
        "polygon"
      );
    });

    it("reports a polygon when the geometry is a closed loop", function () {
      const geom = makeGeometry({ isClosed: true });
      expect(getSummaryKind({ geom, activeToolIsPolygon: false })).toEqual(
        "polygon"
      );
    });

    it("reports points when the geometry only holds points", function () {
      const geom = makeGeometry({ onlyPoints: true });
      expect(getSummaryKind({ geom, activeToolIsPolygon: false })).toEqual(
        "points"
      );
    });

    it("reports a line otherwise", function () {
      const geom = makeGeometry();
      expect(getSummaryKind({ geom, activeToolIsPolygon: false })).toEqual(
        "line"
      );
    });
  });

  describe("generatePathSummaryTxtData", function () {
    it("names the file after the path", function () {
      const { filename } = generatePathSummaryTxtData({
        geom: makeGeometry(),
        name: "my path",
        kind: "line"
      });
      expect(filename).toEqual("my path_summary.txt");
    });

    it("always writes the name first", function () {
      const { text } = generatePathSummaryTxtData({
        geom: makeGeometry(),
        name: "my path",
        kind: "line"
      });
      expect(text.split("\n")[0]).toEqual("name: my path");
    });

    it("includes trimmed path notes when present", function () {
      const { text } = generatePathSummaryTxtData({
        geom: makeGeometry({ pathNotes: "  some notes  " }),
        name: "my path",
        kind: "line"
      });
      expect(parseSummary(text).path_notes).toEqual("some notes");
    });

    it("omits path notes that are blank or whitespace only", function () {
      const { text } = generatePathSummaryTxtData({
        geom: makeGeometry({ pathNotes: "   " }),
        name: "my path",
        kind: "line"
      });
      expect(text).not.toContain("path_notes");
    });

    describe("for a polygon", function () {
      const geom = makeGeometry({
        hasArea: true,
        isClosed: true,
        geodeticArea: 1500000,
        airArea: 1600000,
        geodeticDistance: 4321.5,
        airDistance: 4400.25,
        groundDistance: 4500.75
      });

      it("reports both square kilometres and hectares for each area", function () {
        const { text } = generatePathSummaryTxtData({
          geom,
          name: "area",
          kind: "polygon"
        });
        expect(text).toContain("geodetic_area: 1.500000 km2");
        expect(text).toContain("geodetic_area: 150.0000 ha");
        expect(text).toContain("air_area: 1.600000 km2");
        expect(text).toContain("air_area: 160.0000 ha");
      });

      it("reports perimeters rather than distances", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({ geom, name: "area", kind: "polygon" })
            .text
        );
        expect(summary.geodetic_perimeter).toEqual("4321.50 m");
        expect(summary.air_perimeter).toEqual("4400.25 m");
        expect(summary.ground_perimeter).toEqual("4500.75 m");
        expect(summary.geodetic_distance).toBeUndefined();
      });

      it("does not report altitudes or bearing", function () {
        const { text } = generatePathSummaryTxtData({
          geom,
          name: "area",
          kind: "polygon"
        });
        expect(text).not.toContain("alt_min");
        expect(text).not.toContain("alt_max");
        expect(text).not.toContain("bearing");
      });

      it("writes zeroed areas when the geometry has none", function () {
        const { text } = generatePathSummaryTxtData({
          geom: makeGeometry({ hasArea: true }),
          name: "area",
          kind: "polygon"
        });
        expect(text).toContain("geodetic_area: 0.000000 km2");
        expect(text).toContain("air_area: 0.000000 km2");
      });
    });

    describe("for a line", function () {
      const stopPoints = [
        carto(144.424868, -37.951033, 100),
        carto(144.0, -37.8, 250),
        carto(143.926496, -37.652821, 75)
      ];
      const geom = makeGeometry({
        stopPoints,
        geodeticDistance: 54972.271,
        airDistance: 54980.5,
        groundDistance: 55100.125
      });

      it("reports the min and max altitude across all stop points", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({ geom, name: "path", kind: "line" }).text
        );
        expect(summary.alt_min).toEqual("75.00 m");
        expect(summary.alt_max).toEqual("250.00 m");
      });

      it("reports the altitude difference between first and last point", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({ geom, name: "path", kind: "line" }).text
        );
        expect(summary.alt_diff).toEqual("-25.00 m");
      });

      it("reports all three distances", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({ geom, name: "path", kind: "line" }).text
        );
        expect(summary.geodetic_distance).toEqual("54972.27 m");
        expect(summary.air_distance).toEqual("54980.50 m");
        expect(summary.ground_distance).toEqual("55100.13 m");
      });

      it("reports the bearing as a normalised degree value when given an ellipsoid", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({
            geom,
            name: "path",
            kind: "line",
            ellipsoid: Ellipsoid.WGS84
          }).text
        );
        const bearing = parseFloat(summary.bearing);
        expect(bearing).toBeGreaterThanOrEqual(0);
        expect(bearing).toBeLessThan(360);
        expect(bearing).toBeGreaterThan(270);
        expect(bearing).toBeLessThan(360);
      });

      it("omits the bearing when no ellipsoid is supplied", function () {
        const { text } = generatePathSummaryTxtData({
          geom,
          name: "path",
          kind: "line"
        });
        expect(text).not.toContain("bearing");
      });

      it("omits the bearing when there are fewer than two points", function () {
        const { text } = generatePathSummaryTxtData({
          geom: makeGeometry({ stopPoints: [carto(144, -37, 0)] }),
          name: "path",
          kind: "line",
          ellipsoid: Ellipsoid.WGS84
        });
        expect(text).not.toContain("bearing");
      });

      it("omits altitude lines when no point has a finite height", function () {
        const { text } = generatePathSummaryTxtData({
          geom: makeGeometry({
            stopPoints: [
              carto(144, -37, NaN),
              carto(144.1, -37.1, Number.POSITIVE_INFINITY)
            ]
          }),
          name: "path",
          kind: "line"
        });
        expect(text).not.toContain("alt_min");
        expect(text).not.toContain("alt_max");
        expect(text).not.toContain("alt_diff");
      });
    });

    describe("for points", function () {
      const geom = makeGeometry({
        onlyPoints: true,
        stopPoints: [carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)],
        geodeticDistance: 1234.5,
        airDistance: 1240,
        groundDistance: 1250
      });

      it("reports altitudes", function () {
        const summary = parseSummary(
          generatePathSummaryTxtData({ geom, name: "points", kind: "points" })
            .text
        );
        expect(summary.alt_min).toEqual("30.00 m");
        expect(summary.alt_max).toEqual("80.00 m");
        expect(summary.alt_diff).toEqual("50.00 m");
      });

      it("does not report distances, which are meaningless for loose points", function () {
        const { text } = generatePathSummaryTxtData({
          geom,
          name: "points",
          kind: "points"
        });
        expect(text).not.toContain("geodetic_distance");
        expect(text).not.toContain("air_distance");
        expect(text).not.toContain("ground_distance");
      });
    });
  });
});
