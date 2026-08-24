import { runInAction } from "mobx";
import WebMapServiceCatalogItem from "../../../../lib/Models/Catalog/Ows/WebMapServiceCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../../lib/Models/Terria";

describe("WebMapServiceCatalogItem stylesToUse", function () {
  let terria: Terria;
  let wmsItem: WebMapServiceCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    wmsItem = new WebMapServiceCatalogItem("test", terria);
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "url", "http://example.com");
      wmsItem.setTrait(
        CommonStrata.definition,
        "getCapabilitiesUrl",
        "test/WMS/styles_and_dimensions.xml"
      );
      wmsItem.setTrait(CommonStrata.definition, "layers", "A");
    });
  });

  function styleIds() {
    return wmsItem.styleSelectableDimensions[0].options!.map(
      (option) => option.id
    );
  }

  it("is undefined by default", function () {
    expect(wmsItem.stylesToUse).toBeUndefined();
  });

  it("offers every advertised style when it is not set", async function () {
    await wmsItem.loadMetadata();
    expect(wmsItem.styleSelectableDimensions[0].options!.length).toBe(41);
  });

  it("offers only the listed styles when it is set", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", [
        "areafill/rainbow",
        "areafill/greyscale"
      ]);
    });
    await wmsItem.loadMetadata();

    expect(styleIds()).toEqual(["areafill/rainbow", "areafill/greyscale"]);
  });

  it("keeps the server's order rather than the list's", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", [
        "areafill/greyscale",
        "areafill/rainbow"
      ]);
    });
    await wmsItem.loadMetadata();

    expect(styleIds()).toEqual(["areafill/rainbow", "areafill/greyscale"]);
  });

  it("ignores names the server does not advertise", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", [
        "areafill/rainbow",
        "not/a/real/style"
      ]);
    });
    await wmsItem.loadMetadata();

    expect(styleIds()).toEqual(["areafill/rainbow"]);
  });

  it("falls back to every style when the list is empty", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", []);
    });
    await wmsItem.loadMetadata();

    expect(wmsItem.styleSelectableDimensions[0].options!.length).toBe(41);
  });

  it("still shows the style chosen in the styles trait", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "styles", "areafill/rainbow");
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", [
        "areafill/rainbow",
        "areafill/greyscale"
      ]);
    });
    await wmsItem.loadMetadata();

    expect(wmsItem.styleSelectableDimensions[0].selectedId).toBe(
      "areafill/rainbow"
    );
  });

  it("narrows the styles of each layer when several are shown", async function () {
    runInAction(() => {
      wmsItem.setTrait(CommonStrata.definition, "layers", "A,B");
      wmsItem.setTrait(CommonStrata.definition, "stylesToUse", [
        "areafill/rainbow"
      ]);
    });
    await wmsItem.loadMetadata();

    expect(wmsItem.styleSelectableDimensions.length).toBe(2);
    for (const dimension of wmsItem.styleSelectableDimensions) {
      expect(dimension.options!.map((option) => option.id)).toEqual([
        "areafill/rainbow"
      ]);
    }
  });
});
