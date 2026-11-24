import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import BoxDrawing, {
  BoxDrawingChangeParams
} from "../../lib/Models/BoxDrawing";
import Cesium from "../../lib/Models/Cesium";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "../../lib/Models/RepositionableLayer";
import { BaseModel } from "../../lib/Models/Definition/Model";
import RepositionableMixin from "../../lib/ModelMixins/RepositionableMixin";
import Terria from "../../lib/Models/Terria";
import Cesium3DTilesCatalogItem from "../../lib/Models/Catalog/CatalogItems/Cesium3DTilesCatalogItem";
import GltfCatalogItem from "../../lib/Models/Catalog/Gltf/GltfCatalogItem";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import I3SCatalogItem from "../../lib/Models/Catalog/CatalogItems/I3SCatalogItem";
import CompositeCatalogItem from "../../lib/Models/Catalog/CatalogItems/CompositeCatalogItem";
import IonImageryCatalogItem from "../../lib/Models/Catalog/CatalogItems/IonImageryCatalogItem";

describe("RepositionableLayer", function () {
  it("marks 3D Tiles catalog items as repositionable", function () {
    const terria = new Terria();
    const item = new Cesium3DTilesCatalogItem("test", terria);

    expect(RepositionableMixin.isMixedInto(item)).toBeTrue();
  });

  it("marks glTF catalog items as repositionable", function () {
    const terria = new Terria();
    const item = new GltfCatalogItem("test", terria);

    expect(RepositionableMixin.isMixedInto(item)).toBeTrue();
  });

  it("marks I3S catalog items as repositionable", function () {
    const terria = new Terria();
    const item = new I3SCatalogItem("test", terria);

    expect(RepositionableMixin.isMixedInto(item)).toBeTrue();
  });

  it("marks composite catalog items as repositionable", function () {
    const terria = new Terria();
    const item = new CompositeCatalogItem("test", terria);

    expect(RepositionableMixin.isMixedInto(item)).toBeTrue();
  });

  it("marks Ion imagery catalog items as repositionable", function () {
    const terria = new Terria();
    const item = new IonImageryCatalogItem("test", terria);

    expect(RepositionableMixin.isMixedInto(item)).toBeTrue();
  });

  it("requires the catalog reposition flag", function () {
    const terria = new Terria();
    const item = new GltfCatalogItem("test", terria);

    expect(item.isRepositionable).toBeFalse();
    item.setTrait(CommonStrata.definition, "isRepositionable", true);
    item.setTrait(CommonStrata.definition, "repositionMode", "2d");

    expect(item.isRepositionable).toBeTrue();
    expect(item.repositionMode).toBe("2d");
  });

  function createHarness() {
    let restoredSnapshot: unknown;
    let previewCount = 0;
    let activated = false;
    let deactivated = false;

    const item = {} as BaseModel;
    const boxDrawing = {
      enableScaling: true,
      enableRotation: true,
      dataSource: { show: false },
      stopInteractions: jasmine.createSpy("stopInteractions")
    } as unknown as BoxDrawing;

    const cesium = {
      isFeaturePickingPaused: false,
      dataSources: {
        add: jasmine.createSpy("add").and.returnValue(true),
        remove: jasmine.createSpy("remove").and.returnValue(true)
      }
    } as unknown as Cesium;

    const adapter: RepositionableLayerAdapter<string, BaseModel> = {
      item,
      snapshot: () => "original",
      defaultSnapshot: () => "default",
      preview: () => {
        previewCount++;
      },
      restore: (snapshot) => {
        restoredSnapshot = snapshot;
      },
      activate: () => {
        activated = true;
      },
      deactivate: () => {
        deactivated = true;
      }
    };

    const controller = new RepositionableLayer(adapter, cesium, boxDrawing);
    return {
      controller,
      adapter,
      boxDrawing,
      cesium,
      get restoredSnapshot() {
        return restoredSnapshot;
      },
      get previewCount() {
        return previewCount;
      },
      get activated() {
        return activated;
      },
      get deactivated() {
        return deactivated;
      }
    };
  }

  it("captures the adapter snapshot and previews matrix changes", function () {
    const harness = createHarness();

    expect(harness.controller.snapshot).toBe("original");
    expect(harness.activated).toBeTrue();
    expect(harness.cesium.isFeaturePickingPaused).toBeTrue();
    expect(harness.boxDrawing.dataSource.show).toBeTrue();

    harness.boxDrawing.onChange?.({
      modelMatrix: Matrix4.IDENTITY,
      isFinished: false
    } as BoxDrawingChangeParams);

    expect(harness.previewCount).toBe(1);
  });

  it("restore on cancel and cleanly disposes", function () {
    const harness = createHarness();

    harness.controller.cancel();

    expect(harness.restoredSnapshot).toBe("original");
    expect(harness.deactivated).toBeTrue();
    expect(harness.boxDrawing.enableScaling).toBeFalse();
    expect(harness.boxDrawing.enableRotation).toBeFalse();
    expect(harness.boxDrawing.dataSource.show).toBeFalse();
    expect(harness.cesium.isFeaturePickingPaused).toBeFalse();
  });

  it("does not restore on save", function () {
    const harness = createHarness();

    harness.controller.save();

    expect(harness.restoredSnapshot).toBeUndefined();
    expect(harness.deactivated).toBeTrue();
  });

  it("restores the default snapshot on reset", function () {
    const harness = createHarness();

    harness.controller.reset();

    expect(harness.restoredSnapshot).toBe("default");
    expect(harness.deactivated).toBeTrue();
  });

  it("is safe to dispose more than once", function () {
    const harness = createHarness();

    harness.controller.dispose();
    harness.controller.dispose();

    expect(harness.cesium.dataSources.remove).toHaveBeenCalledTimes(1);
  });
});
