import {
  downstreamProfile,
  LineSample,
  linesFromGeoJson,
  rectangleSurfaceMesh,
  resampleLine,
  riverSurfaceMesh,
  surfaceGeometry,
  SurfacePoint
} from "../../../lib/Core/water/waterSurface";

const METRES_PER_DEGREE = (6371008.8 * Math.PI) / 180;

function isNonIncreasing(values: number[]) {
  return values.every((value, i) => i === 0 || value <= values[i - 1]);
}

describe("waterSurface", function () {
  describe("linesFromGeoJson", function () {
    it("collects LineStrings and MultiLineStrings and ignores other geometries", function () {
      const lines = linesFromGeoJson({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1]
              ]
            }
          },
          {
            type: "Feature",
            geometry: {
              type: "MultiLineString",
              coordinates: [
                [
                  [2, 2],
                  [3, 3]
                ],
                [
                  [4, 4],
                  [5, 5]
                ]
              ]
            }
          },
          { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] } }
        ]
      });
      expect(lines.length).toBe(3);
      expect(lines[2]).toEqual([
        [4, 4],
        [5, 5]
      ]);
    });

    it("returns no lines for anything that isn't GeoJSON", function () {
      expect(linesFromGeoJson(undefined)).toEqual([]);
      expect(linesFromGeoJson("river")).toEqual([]);
      expect(linesFromGeoJson({ type: "Topology" })).toEqual([]);
    });
  });

  describe("resampleLine", function () {
    const line: [number, number][] = [
      [11, 44],
      [11.005, 44],
      [11.01, 44]
    ];
    const length = 0.01 * METRES_PER_DEGREE * Math.cos((44 * Math.PI) / 180);

    it("places samples at a fixed spacing and keeps the last point", function () {
      const samples = resampleLine(line, 100);
      expect(samples.length).toBe(Math.floor(length / 100) + 2);
      expect(samples[0]).toEqual({ longitude: 11, latitude: 44, distance: 0 });
      expect(samples[1].distance).toBe(100);
      const last = samples[samples.length - 1];
      expect(last.longitude).toBe(11.01);
      expect(last.distance).toBeCloseTo(length, 6);
    });

    it("handles a single point", function () {
      expect(resampleLine([[11, 44]], 100)).toEqual([
        { longitude: 11, latitude: 44, distance: 0 }
      ]);
    });
  });

  describe("downstreamProfile", function () {
    it("removes spikes and never rises downstream", function () {
      const profile = downstreamProfile([10, 10, 25, 9, 9, 8, 8, 30, 7, 7], 3);
      expect(isNonIncreasing(profile)).toBeTrue();
      expect(profile[0]).toBe(10);
      expect(Math.max(...profile)).toBeLessThan(25);
      expect(profile[profile.length - 1]).toBe(7);
    });

    it("works out the flow direction from the heights", function () {
      const profile = downstreamProfile([7, 7, 8, 9, 30, 9, 10, 10], 3);
      expect(isNonIncreasing([...profile].reverse())).toBeTrue();
      expect(profile[profile.length - 1]).toBe(10);
    });

    it("fills in failed terrain samples", function () {
      const profile = downstreamProfile(
        [10, NaN, 9, undefined as unknown as number, 8],
        3
      );
      expect(profile.every(Number.isFinite)).toBeTrue();
      expect(isNonIncreasing(profile)).toBeTrue();
    });

    it("returns zero heights when there is no terrain at all", function () {
      expect(downstreamProfile([NaN, NaN])).toEqual([0, 0]);
    });
  });

  describe("riverSurfaceMesh", function () {
    const samples: LineSample[] = [0, 1, 2, 3, 4].map((i) => ({
      longitude: 11 + i * 0.001,
      latitude: 44,
      distance: i * 80
    }));

    it("covers the area within the half width of the river", function () {
      const mesh = riverSurfaceMesh(samples, [5, 4, 3, 2, 1], 100, 20);
      expect(mesh.points.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0);
      const metres = (p: SurfacePoint) =>
        Math.abs(p.latitude - 44) * METRES_PER_DEGREE;
      expect(Math.max(...mesh.points.map(metres))).toBeLessThanOrEqual(100.001);
      expect(Math.max(...mesh.points.map(metres))).toBeGreaterThan(80);
    });

    it("takes its heights from the river profile, falling downstream", function () {
      const mesh = riverSurfaceMesh(samples, [5, 4, 3, 2, 1], 100, 20);
      expect(
        mesh.points.every((p) => [5, 4, 3, 2, 1].includes(p.height))
      ).toBeTrue();
      const byLongitude = [...mesh.points].sort(
        (a, b) => a.longitude - b.longitude
      );
      expect(isNonIncreasing(byLongitude.map((p) => p.height))).toBeTrue();
      expect(byLongitude[0].height).toBe(5);
      expect(byLongitude[byLongitude.length - 1].height).toBe(1);
    });

    it("doesn't overlap itself where the river bends back", function () {
      const hairpin: LineSample[] = [
        [11, 44],
        [11.002, 44],
        [11.002, 44.0005],
        [11, 44.0005]
      ].map(([longitude, latitude], i) => ({
        longitude,
        latitude,
        distance: i * 80
      }));
      const mesh = riverSurfaceMesh(hairpin, [4, 3, 2, 1], 150, 10);
      const keys = mesh.points.map(
        (p) => `${p.longitude.toFixed(7)},${p.latitude.toFixed(7)}`
      );
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("returns an empty mesh without samples", function () {
      expect(riverSurfaceMesh([], [], 100, 20)).toEqual({
        points: [],
        indices: []
      });
    });
  });

  describe("rectangleSurfaceMesh", function () {
    it("covers the rectangle at a constant height", function () {
      const mesh = rectangleSurfaceMesh(
        { west: 12, south: 44, east: 12.2, north: 44.4 },
        45,
        2
      );
      expect(mesh.points.length).toBe(9);
      expect(mesh.indices.length).toBe(4 * 6);
      expect(mesh.points[0]).toEqual(
        jasmine.objectContaining({
          longitude: 12,
          latitude: 44,
          height: 45,
          s: 0,
          t: 0
        })
      );
      expect(mesh.points[8].longitude).toBeCloseTo(12.2, 12);
      expect(mesh.points[8].latitude).toBeCloseTo(44.4, 12);
      expect(mesh.points.every((p) => p.height === 45)).toBeTrue();
    });
  });

  describe("surfaceGeometry", function () {
    it("merges every mesh into one geometry", function () {
      const mesh = rectangleSurfaceMesh(
        { west: 12, south: 44, east: 12.2, north: 44.4 },
        0,
        2
      );
      const geometry = surfaceGeometry([mesh, mesh])!;
      expect(geometry.attributes.position!.values.length).toBe(2 * 9 * 3);
      expect(geometry.attributes.st!.values.length).toBe(2 * 9 * 2);
      expect(geometry.indices!.length).toBe(2 * 4 * 6);
      expect(Math.max(...Array.from(geometry.indices!))).toBe(17);
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it("returns nothing for meshes without triangles", function () {
      expect(surfaceGeometry([])).toBeUndefined();
      expect(
        surfaceGeometry([
          {
            points: [{ longitude: 0, latitude: 0, height: 0, s: 0, t: 0 }],
            indices: []
          }
        ])
      ).toBeUndefined();
    });
  });
});
