import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import MeasurableGeometryExporter, {
  SUFFIX_LINES,
  SUFFIX_MULTIPATH,
  SUFFIX_POINTS,
  SUFFIX_POLYGON
} from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryExporter";
import { DownloadLink } from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryDownload";
import { MeasurableGeometry } from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryManager";

function carto(longitude: number, latitude: number, height: number) {
  return new Cartographic(
    CesiumMath.toRadians(longitude),
    CesiumMath.toRadians(latitude),
    height
  );
}

function makeGeometry(
  overrides: Partial<MeasurableGeometry> = {}
): MeasurableGeometry {
  return {
    isClosed: false,
    hasArea: false,
    stopPoints: [carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)],
    stopGeodeticDistances: [0, 1300],
    stopAirDistances: [0, 1301],
    stopGroundDistances: [0, 1302],
    geodeticDistance: 1300,
    airDistance: 1301,
    groundDistance: 1302,
    ...overrides
  };
}

function decode(link: DownloadLink | undefined): string {
  if (!link || typeof link.href !== "string") {
    throw new Error(`Expected link ${link?.key} to carry data`);
  }
  return decodeURIComponent(link.href.slice(link.href.indexOf(",") + 1));
}

function byKey(links: DownloadLink[], key: string) {
  return links.find((link) => link.key === key);
}

function generate(
  geom: MeasurableGeometry,
  name = "path",
  isMultiPath = false,
  geomList?: MeasurableGeometry[]
) {
  return MeasurableGeometryExporter.generateAllDownloadLinks(
    geom,
    name,
    isMultiPath,
    Ellipsoid.WGS84,
    geomList
  );
}

describe("MeasurableGeometryExporter", function () {
  describe("generateAllDownloadLinks", function () {
    it("offers KML, CSV, GPX and GeoJSON for an open path", async function () {
      const keys = (await generate(makeGeometry())).map((link) => link.key);
      expect(keys).toContain("kmlLines");
      expect(keys).toContain("kmlPoints");
      expect(keys).toContain("csv");
      expect(keys).toContain("gpxTracks");
      expect(keys).toContain("gpxWaypoints");
      expect(keys).toContain("jsonLines");
      expect(keys).toContain("jsonPoints");
    });

    it("suppresses polygon exports for an open path", async function () {
      const links = await generate(makeGeometry());
      expect(
        links.every((link) => !link.download?.includes(SUFFIX_POLYGON))
      ).toBe(true);
      expect(byKey(links, "jsonPolygon")).toBeUndefined();
      expect(byKey(links, "kmlPolygon")).toBeUndefined();
    });

    it("offers polygon exports once the path is closed", async function () {
      const links = await generate(makeGeometry({ isClosed: true }));
      expect(byKey(links, "jsonPolygon")).toBeDefined();
      expect(byKey(links, "kmlPolygon")).toBeDefined();
      expect(byKey(links, "jsonLines")).toBeDefined();
    });

    it("offers only point exports when the geometry holds loose points", async function () {
      const links = await generate(makeGeometry({ onlyPoints: true }));
      const keys = links.map((link) => link.key);
      expect(keys).toContain("csv");
      expect(keys).toContain("kmlPoints");
      expect(keys).toContain("gpxWaypoints");
      expect(keys).toContain("jsonPoints");
      expect(keys).not.toContain("jsonLines");
      expect(keys).not.toContain("kmlLines");
      expect(keys).not.toContain("jsonPolygon");
    });

    it("names every download after the path plus its geometry suffix", async function () {
      const links = await generate(makeGeometry({ isClosed: true }), "my path");
      expect(byKey(links, "csv")?.download).toEqual(
        `my path${SUFFIX_POINTS}.csv`
      );
      expect(byKey(links, "jsonLines")?.download).toEqual(
        `my path${SUFFIX_LINES}.geojson`
      );
      expect(byKey(links, "jsonPolygon")?.download).toEqual(
        `my path${SUFFIX_POLYGON}.geojson`
      );
      expect(byKey(links, "gpxTracks")?.download).toEqual(
        `my path${SUFFIX_LINES}.gpx`
      );
    });

    it("drops links whose generator produced no content", async function () {
      const links = await generate(makeGeometry({ isClosed: true }));
      expect(links.every((link) => link.href !== false)).toBe(true);
    });

    describe("filtering by download key", function () {
      it("keeps the line and point exports of an open path named after a polygon", async function () {
        const links = await generate(makeGeometry(), `route${SUFFIX_POLYGON}`);
        const keys = links.map((link) => link.key);

        expect(keys).toContain("kmlLines");
        expect(keys).toContain("jsonLines");
        expect(keys).toContain("csv");
        expect(keys).not.toContain("kmlPolygon");
        expect(keys).not.toContain("jsonPolygon");
      });

      it("still names those downloads after the path", async function () {
        const links = await generate(makeGeometry(), `route${SUFFIX_POLYGON}`);
        expect(byKey(links, "jsonLines")?.download).toEqual(
          `route${SUFFIX_POLYGON}${SUFFIX_LINES}.geojson`
        );
      });

      it("keeps the point exports of loose points named after lines", async function () {
        const links = await generate(
          makeGeometry({ onlyPoints: true }),
          `grid${SUFFIX_LINES}`
        );
        const keys = links.map((link) => link.key);

        expect(keys).toContain("csv");
        expect(keys).toContain("kmlPoints");
        expect(keys).toContain("gpxWaypoints");
        expect(keys).toContain("jsonPoints");
        expect(keys).not.toContain("kmlLines");
        expect(keys).not.toContain("jsonLines");
        expect(keys).not.toContain("gpxTracks");
      });

      it("keeps every export of a closed path named after a polygon", async function () {
        const links = await generate(
          makeGeometry({ isClosed: true }),
          `area${SUFFIX_POLYGON}`
        );
        const keys = links.map((link) => link.key);

        expect(keys).toContain("kmlPolygon");
        expect(keys).toContain("jsonPolygon");
        expect(keys).toContain("jsonLines");
        expect(keys).toContain("csv");
      });
    });

    describe("multi-path exports", function () {
      const geomList = [
        makeGeometry(),
        makeGeometry({
          stopPoints: [carto(11.36, 44.51, 10), carto(11.37, 44.52, 20)]
        })
      ];

      it("offers only the multipath KML and GeoJSON formats", async function () {
        const keys = (await generate(geomList[0], "paths", true, geomList)).map(
          (link) => link.key
        );
        expect(keys).toContain("kmlMultiPathLines");
        expect(keys).toContain("jsonMultiPathLines");
        expect(keys).not.toContain("csv");
        expect(keys).not.toContain("gpxTracks");
      });

      it("tags multipath filenames with both suffixes", async function () {
        const links = await generate(geomList[0], "paths", true, geomList);
        expect(byKey(links, "jsonMultiPathLines")?.download).toEqual(
          `paths${SUFFIX_LINES}${SUFFIX_MULTIPATH}.geojson`
        );
      });

      it("writes every path into one FeatureCollection", async function () {
        const links = await generate(geomList[0], "paths", true, geomList);
        const json = JSON.parse(decode(byKey(links, "jsonMultiPathLines")));
        expect(json.type).toEqual("FeatureCollection");
        expect(json.features.length).toEqual(2);
      });

      it("writes each path as a MultiLineString so viewers keep them apart", async function () {
        const links = await generate(geomList[0], "paths", true, geomList);
        const json = JSON.parse(decode(byKey(links, "jsonMultiPathLines")));
        expect(json.features[0].geometry.type).toEqual("MultiLineString");
        expect(json.features[0].geometry.coordinates.length).toEqual(1);
        expect(json.features[0].geometry.coordinates[0].length).toEqual(2);
        expect(json.features[1].geometry.coordinates[0][0][0]).toBeCloseTo(
          11.36,
          6
        );
      });
    });
  });

  describe("CSV export", function () {
    it("writes one header plus one row per stop point", async function () {
      const csv = decode(byKey(await generate(makeGeometry()), "csv"));
      const rows = csv.split("\n");
      expect(rows.length).toEqual(3);
      expect(rows[0]).toEqual(
        "longitude,latitude,height,alt_diff,geodetic_distance,air_distance,ground_distance,slope"
      );
    });

    it("writes coordinates in degrees and heights in metres", async function () {
      const csv = decode(byKey(await generate(makeGeometry()), "csv"));
      const [longitude, latitude, height] = csv.split("\n")[1].split(",");
      expect(longitude).toEqual("11.340000");
      expect(latitude).toEqual("44.490000");
      expect(height).toEqual("30.00");
    });

    it("leaves the cumulative columns empty on the first row", async function () {
      const csv = decode(byKey(await generate(makeGeometry()), "csv"));
      expect(csv.split("\n")[1]).toEqual("11.340000,44.490000,30.00,,,,,");
    });

    it("reports distances and slope from the second row onwards", async function () {
      const csv = decode(byKey(await generate(makeGeometry()), "csv"));
      const columns = csv.split("\n")[2].split(",");
      expect(columns[3]).toEqual("50.00");
      expect(columns[4]).toEqual("1300.00");
      expect(columns[5]).toEqual("1301.00");
      expect(columns[6]).toEqual("1302.00");
      expect(columns[7]).toEqual("3.8");
    });

    it("uses a description column instead of distances for loose points", async function () {
      const geom = makeGeometry({
        onlyPoints: true,
        pointDescriptions: ["start", "end"]
      });
      const csv = decode(byKey(await generate(geom), "csv"));
      const rows = csv.split("\n");
      expect(rows[0]).toEqual("longitude,latitude,height,description");
      expect(rows[1]).toEqual("11.340000,44.490000,30.00,start");
      expect(rows[2]).toEqual("11.350000,44.500000,80.00,end");
    });

    it("writes an empty description when a point has none", async function () {
      const geom = makeGeometry({ onlyPoints: true });
      const csv = decode(byKey(await generate(geom), "csv"));
      expect(csv.split("\n")[1].endsWith(",")).toBe(true);
    });

    it("writes headers only when there are no stop points", async function () {
      const geom = makeGeometry({ onlyPoints: true, stopPoints: [] });
      const csv = decode(byKey(await generate(geom), "csv"));
      expect(csv).toEqual("longitude,latitude,height,description");
    });
  });

  describe("GeoJSON export", function () {
    it("writes a LineString with lon/lat/height triples", async function () {
      const json = JSON.parse(
        decode(byKey(await generate(makeGeometry()), "jsonLines"))
      );
      expect(json.type).toEqual("Feature");
      expect(json.geometry.type).toEqual("LineString");
      expect(json.geometry.coordinates.length).toEqual(2);
      expect(json.geometry.coordinates[0][0]).toBeCloseTo(11.34, 6);
      expect(json.geometry.coordinates[0][1]).toBeCloseTo(44.49, 6);
      expect(json.geometry.coordinates[0][2]).toEqual(30);
    });

    it("carries the measured summary in the LineString properties", async function () {
      const geom = makeGeometry({ pathNotes: "survey line" });
      const json = JSON.parse(decode(byKey(await generate(geom), "jsonLines")));
      expect(json.properties.path_notes).toEqual("survey line");
      expect(json.properties.alt_min).toEqual("30.00");
      expect(json.properties.alt_max).toEqual("80.00");
      expect(json.properties.alt_diff).toEqual("50.00");
      expect(json.properties.geodetic_distance).toEqual("1300.00");
      expect(json.properties.air_distance).toEqual("1301.00");
      expect(json.properties.ground_distance).toEqual("1302.00");
      expect(parseFloat(json.properties.bearing)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(json.properties.bearing)).toBeLessThan(360);
    });

    it("preserves feature properties carried over from an imported file", async function () {
      const geom = makeGeometry({ featureProperties: { source: "upload" } });
      const json = JSON.parse(decode(byKey(await generate(geom), "jsonLines")));
      expect(json.properties.source).toEqual("upload");
    });

    it("closes the polygon ring when the first and last points differ", async function () {
      const geom = makeGeometry({ isClosed: true });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPolygon"))
      );
      const ring = json.geometry.coordinates[0];
      expect(json.geometry.type).toEqual("Polygon");
      expect(ring.length).toEqual(3);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    });

    it("does not duplicate a ring that is already closed", async function () {
      const first = carto(11.34, 44.49, 30);
      const geom = makeGeometry({
        isClosed: true,
        stopPoints: [first, carto(11.35, 44.5, 80), first],
        stopGeodeticDistances: [0, 1300, 1300],
        stopAirDistances: [0, 1301, 1301],
        stopGroundDistances: [0, 1302, 1302]
      });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPolygon"))
      );
      expect(json.geometry.coordinates[0].length).toEqual(3);
    });

    it("reports areas and perimeters in the polygon properties", async function () {
      const geom = makeGeometry({
        isClosed: true,
        hasArea: true,
        geodeticArea: 1500000,
        airArea: 1600000
      });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPolygon"))
      );
      expect(json.properties.geodetic_area).toEqual("1500000.00");
      expect(json.properties.air_area).toEqual("1600000.00");
      expect(json.properties.geodetic_perimeter).toEqual("1300.00");
      expect(json.properties.air_perimeter).toEqual("1301.00");
      expect(json.properties.ground_perimeter).toEqual("1302.00");
    });

    it("writes points as a FeatureCollection carrying each altitude", async function () {
      const geom = makeGeometry({ onlyPoints: true });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPoints"))
      );
      expect(json.type).toEqual("FeatureCollection");
      expect(json.features.length).toEqual(2);
      expect(json.features[0].geometry.type).toEqual("Point");
      expect(json.features[0].properties.altitude).toEqual(30);
      expect(json.features[1].properties.altitude).toEqual(80);
    });

    it("copies point descriptions into the point features", async function () {
      const geom = makeGeometry({
        onlyPoints: true,
        pointDescriptions: ["start", "end"]
      });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPoints"))
      );
      expect(json.features[0].properties.description).toEqual("start");
      expect(json.features[1].properties.description).toEqual("end");
    });

    it("keeps an existing point description rather than overwriting it", async function () {
      const geom = makeGeometry({
        onlyPoints: true,
        pointDescriptions: ["from stop list"],
        pointProperties: [{ description: "from imported file" }]
      });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPoints"))
      );
      expect(json.features[0].properties.description).toEqual(
        "from imported file"
      );
    });

    it("omits distances from the points summary", async function () {
      const geom = makeGeometry({ onlyPoints: true });
      const json = JSON.parse(
        decode(byKey(await generate(geom), "jsonPoints"))
      );
      expect(json.alt_min).toEqual("30.00");
      expect(json.alt_max).toEqual("80.00");
      expect(json.geodetic_distance).toBeUndefined();
      expect(json.bearing).toBeUndefined();
    });
  });

  describe("GPX export", function () {
    it("writes one trkpt per stop point with degrees and elevation", async function () {
      const gpx = decode(byKey(await generate(makeGeometry()), "gpxTracks"));
      const doc = new DOMParser().parseFromString(gpx, "application/xml");
      const points = doc.getElementsByTagName("trkpt");
      expect(points.length).toEqual(2);
      expect(parseFloat(points[0].getAttribute("lat")!)).toBeCloseTo(44.49, 6);
      expect(parseFloat(points[0].getAttribute("lon")!)).toBeCloseTo(11.34, 6);
      expect(points[0].getAttribute("ele")).toEqual("30.00");
    });

    it("names the track after the path and carries its notes", async function () {
      const geom = makeGeometry({ pathNotes: "survey line" });
      const gpx = decode(byKey(await generate(geom, "my path"), "gpxTracks"));
      const doc = new DOMParser().parseFromString(gpx, "application/xml");
      expect(doc.getElementsByTagName("name")[0].textContent).toEqual(
        "my path"
      );
      expect(doc.getElementsByTagName("desc")[0].textContent).toEqual(
        "survey line"
      );
    });

    it("writes an extra info waypoint ahead of the stop waypoints", async function () {
      const geom = makeGeometry({ onlyPoints: true });
      const gpx = decode(byKey(await generate(geom), "gpxWaypoints"));
      const doc = new DOMParser().parseFromString(gpx, "application/xml");
      const waypoints = doc.getElementsByTagName("wpt");
      expect(waypoints.length).toEqual(3);
      expect(waypoints[0].getAttribute("name")).toEqual("Info File");
      expect(waypoints[1].getAttribute("name")).toEqual("Tappa 0");
      expect(waypoints[2].getAttribute("name")).toEqual("Tappa 1");
    });
  });

  describe("KML export", function () {
    it("writes a closed LinearRing clamped to the ground", async function () {
      const geom = makeGeometry({ isClosed: true });
      const kml = decode(byKey(await generate(geom), "kmlPolygon"));
      const doc = new DOMParser().parseFromString(kml, "application/xml");
      const coordinates =
        doc.getElementsByTagName("coordinates")[0].textContent ?? "";
      const pairs = coordinates.trim().split(" ");
      expect(pairs.length).toEqual(3);
      expect(pairs[0]).toEqual(pairs[pairs.length - 1]);
      expect(kml).toContain("<altitudeMode>clampToGround</altitudeMode>");
    });

    it("clamps exported lines to the ground", async function () {
      const kml = decode(byKey(await generate(makeGeometry()), "kmlLines"));
      expect(kml).toContain("<LineString>");
      expect(kml).toContain("<altitudeMode>clampToGround</altitudeMode>");
    });

    it("always starts with an XML declaration", async function () {
      const links = await generate(makeGeometry({ isClosed: true }));
      for (const key of ["kmlPolygon", "kmlLines", "kmlPoints"]) {
        expect(decode(byKey(links, key)).startsWith("<?xml")).toBe(true);
      }
    });

    it("wraps exported points in a named folder", async function () {
      const geom = makeGeometry({
        onlyPoints: true,
        pathNotes: "survey points"
      });
      const kml = decode(byKey(await generate(geom, "my path"), "kmlPoints"));
      expect(kml).toContain("<name>my path</name>");
      expect(kml).toContain("<description>survey points</description>");
    });
  });
});
