import { runInAction } from "mobx";
import GlobeClippingMixin from "../../lib/ModelMixins/GlobeClippingMixin";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import Terria from "../../lib/Models/Terria";
import { SelectableDimensionCheckbox } from "../../lib/Models/SelectableDimensions/SelectableDimensions";

function clippingCheckbox(
  item: GeoJsonCatalogItem
): SelectableDimensionCheckbox | undefined {
  const dimension = item.selectableDimensions.find(
    (d) => d.id === "globe-clipping-box"
  );
  return dimension?.type === "checkbox"
    ? (dimension as SelectableDimensionCheckbox)
    : undefined;
}

const twoPointGeoJson = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [11.34, 44.49] }
    },
    {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [11.35, 44.5] }
    }
  ]
};

async function loadPoints(item: GeoJsonCatalogItem) {
  runInAction(() => {
    item.setTrait(CommonStrata.definition, "geoJsonData", twoPointGeoJson);
    item.setTrait(CommonStrata.definition, "forceCesiumPrimitives", true);
  });
  await item.loadMapItems();
}

function fakeGlobe() {
  return {
    backFaceCulling: true,
    showSkirts: true,
    clippingPlanes: undefined as any
  };
}

function stubCesium(terria: Terria, globe: ReturnType<typeof fakeGlobe>) {
  spyOnProperty(terria, "cesium", "get").and.returnValue({
    scene: { globe }
  } as any);
}

describe("GlobeClippingMixin", function () {
  let terria: Terria;
  let item: GeoJsonCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GeoJsonCatalogItem("test", terria);
  });

  it("is mixed into GeoJSON catalog items", function () {
    expect(GlobeClippingMixin.isMixedInto(item)).toBe(true);
    expect(item.hasGlobeClippingMixin).toBe(true);
  });

  it("is off by default so existing maps are unaffected", function () {
    expect(item.globeClippingControlShowed).toBe(false);
    expect(item.globeClippingEnabled).toBe(false);
  });

  describe("selectableDimensions", function () {
    it("offers no clipping control by default", function () {
      expect(
        item.selectableDimensions.find((d) => d.id === "globe-clipping-box")
      ).toBeUndefined();
    });

    it("offers a checkbox once the control is enabled in the config", function () {
      runInAction(() => {
        item.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });

      const dimension = item.selectableDimensions.find(
        (d) => d.id === "globe-clipping-box"
      );
      expect(dimension).toBeDefined();
      expect(dimension?.type).toEqual("checkbox");
    });

    it("reflects whether clipping is currently enabled", function () {
      runInAction(() => {
        item.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });
      expect(clippingCheckbox(item)?.selectedId).toEqual("false");

      runInAction(() => {
        item.setTrait(CommonStrata.definition, "globeClippingEnabled", true);
      });

      expect(clippingCheckbox(item)?.selectedId).toEqual("true");
    });

    it("toggles the trait when the checkbox is used", function () {
      runInAction(() => {
        item.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });
      const dimension = clippingCheckbox(item);

      runInAction(() => {
        dimension?.setDimensionValue(CommonStrata.user, "true");
      });
      expect(item.globeClippingEnabled).toBe(true);

      runInAction(() => {
        dimension?.setDimensionValue(CommonStrata.user, "false");
      });
      expect(item.globeClippingEnabled).toBe(false);
    });

    it("is contributed by the mixin rather than overriding the accessor", function () {
      expect(item.globeClippingSelectableDimensions).toEqual([]);

      runInAction(() => {
        item.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });

      expect(item.globeClippingSelectableDimensions.length).toEqual(1);
      expect(item.globeClippingSelectableDimensions[0].id).toEqual(
        "globe-clipping-box"
      );
    });

    it("keeps the dimensions the item already had", function () {
      runInAction(() => {
        item.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });
      // The clipping checkbox is appended, never a replacement.
      expect(item.selectableDimensions.length).toBeGreaterThan(0);
      expect(
        item.selectableDimensions[item.selectableDimensions.length - 1].id
      ).toEqual("globe-clipping-box");
    });
  });

  describe("autoComputeClippingPlanes", function () {
    it("does nothing without a Cesium viewer", function () {
      expect(() => item.autoComputeClippingPlanes(undefined)).not.toThrow();
    });

    it("fits four clipping planes around the item's data", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);

      item.autoComputeClippingPlanes(item.data);

      expect(globe.clippingPlanes).toBeDefined();
      expect(globe.clippingPlanes.length).toEqual(4);
      expect(globe.clippingPlanes.enabled).toBe(true);
      expect(globe.clippingPlanes.unionClippingRegions).toBe(true);
    });

    it("turns off back face culling and skirts so the cut is visible", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);

      item.autoComputeClippingPlanes(item.data);

      expect(globe.backFaceCulling).toBe(false);
      expect(globe.showSkirts).toBe(false);
    });

    it("restores the globe and disables the planes when clipping is cleared", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);
      item.autoComputeClippingPlanes(item.data);

      item.autoComputeClippingPlanes(undefined);

      expect(globe.backFaceCulling).toBe(true);
      expect(globe.showSkirts).toBe(true);
      expect(globe.clippingPlanes.enabled).toBe(false);
    });

    it("copes with being cleared before any planes were built", function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);

      expect(() => item.autoComputeClippingPlanes(undefined)).not.toThrow();
      expect(globe.backFaceCulling).toBe(true);
      expect(globe.showSkirts).toBe(true);
    });
  });
});
