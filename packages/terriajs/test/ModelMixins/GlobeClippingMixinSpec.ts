import { runInAction } from "mobx";
import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import GlobeClippingMixin from "../../lib/ModelMixins/GlobeClippingMixin";
import Cesium3DTilesCatalogItem from "../../lib/Models/Catalog/CatalogItems/Cesium3DTilesCatalogItem";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import GltfCatalogItem from "../../lib/Models/Catalog/Gltf/GltfCatalogItem";
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

const onePointGeoJson = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Point" as const, coordinates: [11.34, 44.49] }
    }
  ]
};

async function loadPoints(
  item: GeoJsonCatalogItem,
  geoJson: unknown = twoPointGeoJson
) {
  runInAction(() => {
    item.setTrait(CommonStrata.definition, "geoJsonData", geoJson as any);
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

      item.autoComputeClippingPlanes(item.globeClippingBoundingSphere);

      expect(globe.clippingPlanes).toBeDefined();
      expect(globe.clippingPlanes.length).toEqual(4);
      expect(globe.clippingPlanes.enabled).toBe(true);
      expect(globe.clippingPlanes.unionClippingRegions).toBe(true);
    });

    it("turns off back face culling and skirts so the cut is visible", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);

      item.autoComputeClippingPlanes(item.globeClippingBoundingSphere);

      expect(globe.backFaceCulling).toBe(false);
      expect(globe.showSkirts).toBe(false);
    });

    it("restores the globe and disables the planes when clipping is cleared", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);
      item.autoComputeClippingPlanes(item.globeClippingBoundingSphere);

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

    it("leaves the globe alone for a sphere with no extent to clip", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item, onePointGeoJson);

      // A single point gives a sphere of radius zero: there is nothing to cut.
      expect(item.globeClippingBoundingSphere?.radius).toEqual(0);
      item.autoComputeClippingPlanes(item.globeClippingBoundingSphere);

      expect(globe.clippingPlanes).toBeUndefined();
      expect(globe.backFaceCulling).toBe(true);
      expect(globe.showSkirts).toBe(true);
    });

    it("centres the planes on the data it was given", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);
      const sphere = item.globeClippingBoundingSphere!;

      item.autoComputeClippingPlanes(sphere);

      // The planes are built in a frame anchored at the sphere centre, one
      // sphere radius away from it on each of the four horizontal directions.
      expect(globe.clippingPlanes.length).toEqual(4);
      for (let i = 0; i < globe.clippingPlanes.length; ++i) {
        expect(globe.clippingPlanes.get(i).distance).toBeCloseTo(
          sphere.radius,
          3
        );
      }
    });
  });

  describe("globeClippingBoundingSphere", function () {
    it("has nothing to measure before the data is loaded", function () {
      expect(item.globeClippingBoundingSphere).toBeUndefined();
    });

    it("fits a sphere around the positions of the item's entities", async function () {
      await loadPoints(item);

      const sphere = item.globeClippingBoundingSphere;
      expect(sphere).toBeDefined();
      expect(sphere?.radius).toBeGreaterThan(0);
      // The two points are roughly 1.3 km apart, so the sphere around them is
      // of that order rather than of the order of the globe.
      expect(sphere!.radius).toBeLessThan(10000);
    });

    it("is what drives the clipping, so it can be measured another way", function () {
      // 3D Tiles and glTF items have no `data` to read positions off; they
      // override this getter instead, which is why the autorun watches it.
      const measured = new BoundingSphere(new Cartesian3(1, 2, 3), 42);
      spyOnProperty(item, "globeClippingBoundingSphere", "get").and.returnValue(
        measured
      );

      const globe = fakeGlobe();
      stubCesium(terria, globe);
      item.autoComputeClippingPlanes(item.globeClippingBoundingSphere);

      expect(globe.clippingPlanes).toBeDefined();
      expect(globe.clippingPlanes.length).toEqual(4);
    });
  });

  describe("the item types it is mixed into", function () {
    it("covers 3D Tiles catalog items", function () {
      const tileset = new Cesium3DTilesCatalogItem("tiles", terria);

      expect(GlobeClippingMixin.isMixedInto(tileset)).toBe(true);
      expect(tileset.globeClippingControlShowed).toBe(false);
      expect(tileset.globeClippingEnabled).toBe(false);
    });

    it("covers glTF catalog items", function () {
      const gltf = new GltfCatalogItem("gltf", terria);

      expect(GlobeClippingMixin.isMixedInto(gltf)).toBe(true);
      expect(gltf.globeClippingControlShowed).toBe(false);
      expect(gltf.globeClippingEnabled).toBe(false);
    });

    it("offers the same checkbox on a 3D Tiles item", function () {
      const tileset = new Cesium3DTilesCatalogItem("tiles", terria);
      runInAction(() => {
        tileset.setTrait(
          CommonStrata.definition,
          "globeClippingControlShowed",
          true
        );
      });

      const dimension = tileset.globeClippingSelectableDimensions[0];
      expect(dimension?.id).toEqual("globe-clipping-box");

      runInAction(() => {
        (dimension as SelectableDimensionCheckbox).setDimensionValue(
          CommonStrata.user,
          "true"
        );
      });
      expect(tileset.globeClippingEnabled).toBe(true);
    });

    it("has nothing to clip against a 3D Tiles item that has not loaded", function () {
      const tileset = new Cesium3DTilesCatalogItem("tiles", terria);

      expect(tileset.globeClippingBoundingSphere).toBeUndefined();
    });

    it("has nothing to clip against a glTF item that was never measured", function () {
      const gltf = new GltfCatalogItem("gltf", terria);

      expect(gltf.globeClippingBoundingSphere).toBeUndefined();
    });
  });

  describe("dispose", function () {
    it("stops watching the item once it is disposed", async function () {
      const globe = fakeGlobe();
      stubCesium(terria, globe);
      await loadPoints(item);
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "globeClippingEnabled", true);
      });
      expect(globe.clippingPlanes).toBeDefined();

      item.dispose();
      globe.clippingPlanes = undefined;
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "globeClippingEnabled", false);
      });

      // The autorun is gone, so nothing touches the globe any more.
      expect(globe.clippingPlanes).toBeUndefined();
    });
  });
});
