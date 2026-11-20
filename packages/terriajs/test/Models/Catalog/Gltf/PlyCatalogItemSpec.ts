import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import Color from "terriajs-cesium/Source/Core/Color";
import getDataTypes from "../../../../lib/Core/getDataType";
import loadBlob from "../../../../lib/Core/loadBlob";
import createCatalogItemFromFileOrUrl from "../../../../lib/Models/Catalog/createCatalogItemFromFileOrUrl";
import PlyCatalogItem from "../../../../lib/Models/Catalog/Gltf/PlyCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../../lib/Models/Terria";
import { isGroup } from "../../../../lib/Models/SelectableDimensions/SelectableDimensions";

describe("PlyCatalogItem", function () {
  let terria: Terria;
  let item: PlyCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new PlyCatalogItem("test", terria);
  });

  async function load(name: string) {
    item.setTrait(CommonStrata.definition, "url", `test/ply/${name}`);
    return item.loadMapItems();
  }

  function entity() {
    return item.mapItems[0].entities.values[0];
  }

  function dimensionIds() {
    const group = item.selectableDimensions.find(
      (dim) => dim.id === "ply-georeferencing"
    );
    return group && isGroup(group)
      ? group.selectableDimensions.map((dim) => dim.id)
      : [];
  }

  it("is available as a local data type for .ply files", function () {
    const ply = getDataTypes().localDataType.find((t) => t.value === "ply");
    expect(ply?.extensions).toEqual(["ply"]);
  });

  it("is created from a local file", async function () {
    const blob = await loadBlob("test/ply/mesh-ascii-colors.ply");
    const file = new File([blob], "cube.ply");
    const created = await createCatalogItemFromFileOrUrl(terria, file, "ply");
    expect(created instanceof PlyCatalogItem).toBeTrue();
    expect((created as PlyCatalogItem).hasLocalData).toBeTrue();
  });

  it("loads a mesh as a glTF model", async function () {
    (await load("mesh-ascii-colors.ply")).throwIfError();
    expect(item.mapItems.length).toBe(1);
    const model = entity().model!;
    expect(model.uri?.getValue(JulianDate.now())).toMatch(/^blob:/);
    expect(model.customShader).toBeUndefined();
    expect(dimensionIds()).not.toContain("pointSize");
  });

  it("places a model without a CRS in the middle of the view, so it can be zoomed to", async function () {
    expect(item.disableZoomTo).toBeTrue();
    (await load("mesh-ascii-colors.ply")).throwIfError();
    expect(item.origin.longitude).toBeDefined();
    expect(item.origin.latitude).toBeDefined();
    expect(item.origin.height).toBeDefined();
    expect(item.disableZoomTo).toBeFalse();
    expect(dimensionIds()).toContain("longitude");
    expect(dimensionIds()).not.toContain("heightOffset");
  });

  it("keeps a user defined origin", async function () {
    item.origin.setTrait(CommonStrata.user, "longitude", 11);
    item.origin.setTrait(CommonStrata.user, "latitude", 44);
    item.origin.setTrait(CommonStrata.user, "height", 100);
    (await load("mesh-ascii-colors.ply")).throwIfError();
    const position = Cartographic.fromCartesian(item.cesiumPosition);
    expect(CesiumMath.toDegrees(position.longitude)).toBeCloseTo(11, 6);
    expect(position.height).toBeCloseTo(100, 3);
  });

  it("gives point clouds a point size", async function () {
    (await load("points-binary-le.ply")).throwIfError();
    expect(entity().model!.customShader).toBeDefined();
    expect(dimensionIds()).toContain("pointSize");
  });

  it("applies opacity", async function () {
    item.setTrait(CommonStrata.user, "opacity", 0.4);
    (await load("mesh-ascii-colors.ply")).throwIfError();
    const color: Color = entity().model!.color!.getValue(JulianDate.now());
    expect(color.alpha).toBeCloseTo(0.4, 6);
  });

  it("positions projected coordinates from the CRS, correcting grid convergence", async function () {
    item.setTrait(CommonStrata.user, "crs", "EPSG:7791");
    item.setTrait(CommonStrata.user, "heightOffset", 10);
    (await load("points-utm-ascii.ply")).throwIfError();

    const position = Cartographic.fromCartesian(item.cesiumPosition);
    expect(CesiumMath.toDegrees(position.longitude)).toBeCloseTo(11.3394, 3);
    expect(CesiumMath.toDegrees(position.latitude)).toBeCloseTo(44.4905, 3);
    expect(position.height).toBeCloseTo(52.5 + 10, 3);

    const hpr = Transforms.fixedFrameToHeadingPitchRoll(
      entity().computeModelMatrix(JulianDate.now())
    );
    expect(CesiumMath.toDegrees(hpr.heading)).toBeCloseTo(1.64, 1);

    expect(item.disableZoomTo).toBeFalse();
    expect(item.shortReport).toBeUndefined();
    expect(dimensionIds()).toContain("heightOffset");
    expect(dimensionIds()).not.toContain("longitude");
  });

  it("warns about an unknown CRS", async function () {
    item.setTrait(CommonStrata.user, "crs", "EPSG:999999");
    (await load("points-utm-ascii.ply")).throwIfError();
    expect(item.shortReport).toContain("models.ply.invalidCrs");
  });

  it("warns about a geographic CRS", async function () {
    item.setTrait(CommonStrata.user, "crs", "EPSG:4326");
    (await load("points-utm-ascii.ply")).throwIfError();
    expect(item.shortReport).toContain("models.ply.geographicCrs");
  });

  it("suggests a CRS for large coordinates", async function () {
    (await load("points-utm-ascii.ply")).throwIfError();
    expect(item.shortReport).toContain("models.ply.largeCoordinates");
  });

  it("reports decimated point clouds", async function () {
    item.setTrait(CommonStrata.user, "maximumPoints", 2);
    (await load("points-binary-be.ply")).throwIfError();
    expect(item.shortReport).toContain("models.ply.decimated");
  });

  it("shows the 2D message in Leaflet", async function () {
    (await load("mesh-ascii-colors.ply")).throwIfError();
    spyOnProperty(terria, "currentViewer").and.returnValue({
      type: "Leaflet"
    } as Terria["currentViewer"]);
    expect(item.shortReport).toContain("3dTypeIn2dMode");
  });

  it("raises a readable error for corrupt files", async function () {
    const result = await load("truncated.ply");
    expect(result.error).toBeDefined();
    expect(result.error?.highestImportanceError.message).toContain(
      "models.ply.errors.truncated"
    );
  });

  it("rejects files over the size limit", async function () {
    item.setTrait(CommonStrata.user, "maximumFileSizeMb", 0.0001);
    const result = await load("mesh-ascii-colors.ply");
    expect(result.error?.highestImportanceError.message).toContain(
      "models.ply.errors.tooLarge"
    );
  });
});
