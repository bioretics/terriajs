import { runInAction } from "mobx";
import {
  addOrReplaceLocalFileUploadType,
  customLocalDataTypes,
  getLocalDataTypeExtensions
} from "../../lib/Core/getDataType";
import stripFileExtension from "../../lib/Core/stripFileExtension";

describe("getLocalDataTypeExtensions", function () {
  it("lists the extensions of the builtin upload types", function () {
    const extensions = getLocalDataTypeExtensions();

    ["geojson", "kml", "kmz", "csv", "czml", "gpx", "json", "zip"].forEach(
      (extension) => expect(extensions).toContain(extension)
    );
  });

  it("does not invent an extension for the auto type", function () {
    expect(getLocalDataTypeExtensions()).not.toContain("auto");
  });

  it("picks up extensions added by an application", function () {
    addOrReplaceLocalFileUploadType("test-strip-extension", {
      value: "test-strip-extension",
      name: "Test",
      extensions: ["tst"]
    });

    expect(getLocalDataTypeExtensions()).toContain("tst");

    runInAction(() => customLocalDataTypes.delete("test-strip-extension"));
  });
});

describe("stripFileExtension", function () {
  it("drops an extension the app knows how to upload", function () {
    expect(stripFileExtension("bike_racks.zip")).toEqual("bike_racks");
    expect(stripFileExtension("cemeteries.geojson")).toEqual("cemeteries");
    expect(stripFileExtension("track.gpx")).toEqual("track");
    expect(stripFileExtension("places.kmz")).toEqual("places");
  });

  it("ignores the case of the extension", function () {
    expect(stripFileExtension("BIKE_RACKS.ZIP")).toEqual("BIKE_RACKS");
    expect(stripFileExtension("Cemeteries.GeoJson")).toEqual("Cemeteries");
  });

  it("drops only the last extension", function () {
    expect(stripFileExtension("archive.zip.csv")).toEqual("archive.zip");
  });

  it("keeps a name whose ending is not an upload extension", function () {
    // Layer names often end in something that looks like an extension but is
    // just part of the name, and those must survive untouched.
    expect(stripFileExtension("Comune di Bologna 1.5")).toEqual(
      "Comune di Bologna 1.5"
    );
    expect(stripFileExtension("Rete stradale v2.0")).toEqual(
      "Rete stradale v2.0"
    );
    expect(stripFileExtension("report.pdf")).toEqual("report.pdf");
  });

  it("keeps a name with no extension at all", function () {
    expect(stripFileExtension("bike_racks")).toEqual("bike_racks");
    expect(stripFileExtension("")).toEqual("");
  });

  it("keeps a dotfile whole", function () {
    expect(stripFileExtension(".csv")).toEqual(".csv");
    expect(stripFileExtension(".gitignore")).toEqual(".gitignore");
  });

  it("leaves a trailing dot alone", function () {
    expect(stripFileExtension("bike_racks.")).toEqual("bike_racks.");
  });

  it("follows the upload types an application registers", function () {
    expect(stripFileExtension("survey.tst")).toEqual("survey.tst");

    addOrReplaceLocalFileUploadType("test-strip-extension", {
      value: "test-strip-extension",
      name: "Test",
      extensions: ["tst"]
    });
    expect(stripFileExtension("survey.tst")).toEqual("survey");

    runInAction(() => customLocalDataTypes.delete("test-strip-extension"));
    expect(stripFileExtension("survey.tst")).toEqual("survey.tst");
  });
});
