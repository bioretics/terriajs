import { runInAction } from "mobx";
import { http, passthrough } from "msw";
import Primitive from "terriajs-cesium/Source/Scene/Primitive";
import SeaLevelRiseCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/SeaLevelRiseCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import createStratumInstance from "../../../../lib/Models/Definition/createStratumInstance";
import { SelectableDimensionNumeric } from "../../../../lib/Models/SelectableDimensions/SelectableDimensions";
import Terria from "../../../../lib/Models/Terria";
import { RectangleTraits } from "../../../../lib/Traits/TraitsClasses/MappableTraits";
import { worker } from "../../../mocks/browser";

describe("SeaLevelRiseCatalogItem", function () {
  let item: SeaLevelRiseCatalogItem;

  beforeEach(function () {
    item = new SeaLevelRiseCatalogItem("sea", new Terria({ baseUrl: "./" }));
    item.setTrait(
      CommonStrata.definition,
      "rectangle",
      createStratumInstance(RectangleTraits, {
        west: 12.15,
        south: 44.35,
        east: 12.4,
        north: 44.75
      })
    );
  });

  it("uses the EGM96 geoid height as mean sea level", async function () {
    worker.use(http.get("*.DAC", () => passthrough()));
    (await item.loadMapItems()).throwIfError();
    expect(item.seaLevel).toBeGreaterThan(40);
    expect(item.seaLevel).toBeLessThan(50);
    expect(item.mapItems.length).toBe(1);
  });

  it("lets the sea level be overridden", async function () {
    worker.use(http.get("*.DAC", () => passthrough()));
    item.setTrait(CommonStrata.definition, "seaLevelHeight", 0);
    (await item.loadMapItems()).throwIfError();
    expect(item.seaLevel).toBe(0);
    expect(item.mapItems[0] instanceof Primitive).toBeTrue();
  });

  it("limits the rise to 5 m by default", function () {
    const dimension = item.selectableDimensions.find(
      (dim) => dim.id === "waterRise"
    ) as SelectableDimensionNumeric;
    expect(dimension.max).toBe(5);
  });

  it("asks to turn on terrain depth testing in 3D", function () {
    spyOnProperty(item.terria, "cesium").and.returnValue(
      {} as Terria["cesium"]
    );
    runInAction(() => (item.terria.depthTestAgainstTerrainEnabled = false));
    expect(item.shortReport).toContain("models.waterSurface.enableDepthTest");
    runInAction(() => (item.terria.depthTestAgainstTerrainEnabled = true));
    expect(item.shortReport).toBeUndefined();
  });

  it("raises a readable error without an area", async function () {
    const empty = new SeaLevelRiseCatalogItem("empty", new Terria());
    const result = await empty.loadMapItems();
    expect(result.error?.highestImportanceError.message).toContain(
      "models.waterSurface.noSeaArea"
    );
  });
});
