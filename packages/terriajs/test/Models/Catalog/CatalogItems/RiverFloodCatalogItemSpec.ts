import { autorun } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import EllipsoidSurfaceAppearance from "terriajs-cesium/Source/Scene/EllipsoidSurfaceAppearance";
import Primitive from "terriajs-cesium/Source/Scene/Primitive";
import RiverFloodCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/RiverFloodCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import {
  isNumeric,
  SelectableDimensionNumeric
} from "../../../../lib/Models/SelectableDimensions/SelectableDimensions";
import Terria from "../../../../lib/Models/Terria";

describe("RiverFloodCatalogItem", function () {
  let terria: Terria;
  let item: RiverFloodCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new RiverFloodCatalogItem("river", terria);
    item.setTrait(CommonStrata.definition, "url", "test/flood/river.geojson");
  });

  function primitive() {
    return item.mapItems[0] as Primitive;
  }

  function riseDimension() {
    return item.selectableDimensions.find(
      (dim) => dim.id === "waterRise"
    ) as SelectableDimensionNumeric;
  }

  it("builds one water surface primitive along the river", async function () {
    (await item.loadMapItems()).throwIfError();
    expect(item.mapItems.length).toBe(1);
    expect(primitive() instanceof Primitive).toBeTrue();
  });

  it("sets its rectangle around the flooded area, so it can be zoomed to", async function () {
    (await item.loadMapItems()).throwIfError();
    const { west, south, east, north } = item.rectangle;
    expect(west!).toBeLessThan(11);
    expect(east!).toBeGreaterThan(11.01);
    expect(south!).toBeLessThan(44);
    expect(north!).toBeGreaterThan(44);
    expect(east! - west!).toBeLessThan(0.03);
  });

  it("raises the water without rebuilding the primitive", async function () {
    (await item.loadMapItems()).throwIfError();
    const observe = autorun(() => item.mapItems);
    const before = primitive();
    item.setTrait(CommonStrata.user, "waterRise", 3);
    expect(primitive()).toBe(before);
    observe();
    const translation = Matrix4.getTranslation(
      primitive().modelMatrix,
      new Cartesian3()
    );
    expect(Cartesian3.magnitude(translation)).toBeCloseTo(3, 6);
  });

  it("applies opacity to the water material", async function () {
    item.setTrait(CommonStrata.user, "opacity", 0.4);
    (await item.loadMapItems()).throwIfError();
    const appearance = primitive().appearance as EllipsoidSurfaceAppearance;
    expect(appearance.material.uniforms.baseWaterColor.alpha).toBeCloseTo(
      0.4,
      6
    );
  });

  it("exposes the water rise in the workbench, within its limits", async function () {
    (await item.loadMapItems()).throwIfError();
    const dimension = riseDimension();
    expect(isNumeric(dimension)).toBeTrue();
    expect(dimension.max).toBe(10);
    dimension.setDimensionValue(CommonStrata.user, 4.5);
    expect(item.waterRise).toBe(4.5);
    riseDimension().setDimensionValue(CommonStrata.user, 50);
    expect(item.waterRise).toBe(10);
    riseDimension().setDimensionValue(CommonStrata.user, -2);
    expect(item.waterRise).toBe(0);
  });

  it("warns that the profile is flat without 3D terrain", async function () {
    (await item.loadMapItems()).throwIfError();
    expect(item.shortReport).toContain("models.waterSurface.noTerrain");
  });

  it("shows the 2D message in Leaflet", async function () {
    (await item.loadMapItems()).throwIfError();
    spyOnProperty(terria, "currentViewer").and.returnValue({
      type: "Leaflet"
    } as Terria["currentViewer"]);
    expect(item.shortReport).toContain("3dTypeIn2dMode");
  });

  it("raises a readable error when the data has no lines", async function () {
    item.setTrait(
      CommonStrata.definition,
      "url",
      "test/flood/no-lines.geojson"
    );
    const result = await item.loadMapItems();
    expect(result.error?.highestImportanceError.message).toContain(
      "models.waterSurface.noRiverLine"
    );
  });
});
