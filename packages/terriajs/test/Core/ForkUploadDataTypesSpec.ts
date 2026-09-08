import { getDataTypes } from "../../lib/ViewModels/UploadDataTypes";

describe("fork upload data types", function () {
  describe("the local geotiff entry", function () {
    const geotiff = () =>
      getDataTypes().localDataType.find((type) => type.value === "geotiff");

    it("is offered for local uploads", function () {
      expect(geotiff()).toBeDefined();
    });

    it("is labelled GeoTIFF", function () {
      expect(geotiff()?.name).toEqual("GeoTIFF");
    });

    it("accepts both tif and tiff files", function () {
      expect(geotiff()?.extensions).toEqual(["tif", "tiff"]);
    });

    it("is the only entry claiming those extensions", function () {
      const claimants = getDataTypes().localDataType.filter((type) =>
        type.extensions?.includes("tiff")
      );
      expect(claimants.length).toEqual(1);
      expect(claimants[0].value).toEqual("geotiff");
    });
  });

  describe("the upstream cog entry", function () {
    it("is still offered for remote urls", function () {
      expect(
        getDataTypes().remoteDataType.find((type) => type.value === "cog")
      ).toBeDefined();
    });

    it("did not displace the local geotiff entry", function () {
      expect(
        getDataTypes().localDataType.find((type) => type.value === "cog")
      ).toBeUndefined();
      expect(
        getDataTypes().remoteDataType.find((type) => type.value === "geotiff")
      ).toBeUndefined();
    });
  });

  it("gives every builtin local type a distinct value", function () {
    const values = getDataTypes().localDataType.map((type) => type.value);
    expect(new Set(values).size).toEqual(values.length);
  });
});
