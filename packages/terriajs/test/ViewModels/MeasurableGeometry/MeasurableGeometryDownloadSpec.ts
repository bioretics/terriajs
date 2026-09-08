import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Terria from "../../../lib/Models/Terria";
import MeasurableDownload, {
  DownloadLink
} from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryDownload";
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
    ...overrides
  };
}

describe("MeasurableDownload", function () {
  let terria: Terria;
  let download: MeasurableDownload;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    download = new MeasurableDownload(terria);
  });

  describe("normalizeDefaultFilename", function () {
    it("returns an empty string for an empty name", function () {
      expect(MeasurableDownload.normalizeDefaultFilename("")).toEqual("");
    });

    it("leaves a plain name untouched", function () {
      expect(MeasurableDownload.normalizeDefaultFilename("my path")).toEqual(
        "my path"
      );
    });

    it("strips the file extension", function () {
      expect(
        MeasurableDownload.normalizeDefaultFilename("my path.kml")
      ).toEqual("my path");
    });

    it("strips a geometry-kind suffix", function () {
      expect(
        MeasurableDownload.normalizeDefaultFilename("my path_polygon.kml")
      ).toEqual("my path");
      expect(
        MeasurableDownload.normalizeDefaultFilename("my path_lines.geojson")
      ).toEqual("my path");
      expect(
        MeasurableDownload.normalizeDefaultFilename("my path_points.csv")
      ).toEqual("my path");
    });

    it("strips a multipath suffix along with the geometry kind", function () {
      expect(
        MeasurableDownload.normalizeDefaultFilename(
          "my path_lines_multipath.kml"
        )
      ).toEqual("my path");
    });

    it("strips repeated suffixes left by re-importing an exported file", function () {
      expect(
        MeasurableDownload.normalizeDefaultFilename(
          "my path_lines_points_polygon.kml"
        )
      ).toEqual("my path");
    });

    it("does not strip a suffix that appears mid-name", function () {
      expect(
        MeasurableDownload.normalizeDefaultFilename("my_points_path.kml")
      ).toEqual("my_points_path");
    });
  });

  describe("isValidForDownload", function () {
    it("accepts a named path with a chosen format that is not loading", function () {
      expect(download.isValidForDownload("path", "csv", false)).toBe(true);
    });

    it("rejects an empty name", function () {
      expect(download.isValidForDownload("", "csv", false)).toBe(false);
    });

    it("rejects an unchosen format", function () {
      expect(download.isValidForDownload("path", "", false)).toBe(false);
    });

    it("rejects while still loading", function () {
      expect(download.isValidForDownload("path", "csv", true)).toBe(false);
    });
  });

  describe("findLinkByFormat", function () {
    const links: DownloadLink[] = [
      { key: "", label: "placeholder" },
      {
        key: "csv",
        href: "data:attachment/csv,a",
        download: "a.csv",
        label: "CSV"
      }
    ];

    it("finds a link by its format key", function () {
      expect(download.findLinkByFormat(links, "csv")?.download).toEqual(
        "a.csv"
      );
    });

    it("returns undefined for an unknown format", function () {
      expect(download.findLinkByFormat(links, "kml")).toBeUndefined();
    });
  });

  describe("handleDownload", function () {
    const links: DownloadLink[] = [
      {
        key: "csv",
        href: "data:attachment/csv,a",
        download: "a.csv",
        label: "CSV"
      },
      { key: "empty", href: false, download: "b.csv", label: "Empty" }
    ];

    it("clicks a temporary anchor for the selected format", function () {
      const anchor = document.createElement("a");
      const click = spyOn(anchor, "click");
      spyOn(document, "createElement").and.returnValue(anchor);

      expect(download.handleDownload(links, "csv")).toBe(true);

      expect(click).toHaveBeenCalled();
      expect(anchor.download).toEqual("a.csv");
      expect(anchor.getAttribute("href")).toEqual("data:attachment/csv,a");
    });

    it("removes the temporary anchor from the document afterwards", function () {
      const anchor = document.createElement("a");
      spyOn(anchor, "click");
      spyOn(document, "createElement").and.returnValue(anchor);

      download.handleDownload(links, "csv");

      expect(document.body.contains(anchor)).toBe(false);
    });

    it("returns false for a format with no link", function () {
      expect(download.handleDownload(links, "gpx")).toBe(false);
    });

    it("reports success but downloads nothing when the link has no data", function () {
      const anchor = document.createElement("a");
      const click = spyOn(anchor, "click");
      spyOn(document, "createElement").and.returnValue(anchor);

      expect(download.handleDownload(links, "empty")).toBe(true);
      expect(click).not.toHaveBeenCalled();
    });
  });

  describe("generateAllFormatLinks", function () {
    it("puts the format placeholder first so no format is preselected", async function () {
      const links = await download.generateAllFormatLinks(
        makeGeometry(),
        "path",
        false,
        Ellipsoid.WGS84
      );
      expect(links[0].key).toEqual("");
      expect(links[0].href).toBeUndefined();
    });

    it("offers the single-path formats for a plain path", async function () {
      const links = await download.generateAllFormatLinks(
        makeGeometry(),
        "path",
        false,
        Ellipsoid.WGS84
      );
      const keys = links.map((link) => link.key);
      expect(keys).toContain("csv");
      expect(keys).toContain("kmlLines");
      expect(keys).toContain("gpxTracks");
      expect(keys).toContain("jsonLines");
    });

    it("offers only the multipath formats when exporting several paths", async function () {
      const geomList = [makeGeometry(), makeGeometry()];
      const links = await download.generateAllFormatLinks(
        geomList[0],
        "paths",
        true,
        Ellipsoid.WGS84,
        geomList
      );
      const keys = links.map((link) => link.key);
      expect(keys).toContain("kmlMultiPathLines");
      expect(keys).not.toContain("csv");
    });
  });
});
