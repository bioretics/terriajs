import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import RepositionableBoxDrawing, {
  RepositionableBoxDrawingChangeParams
} from "../../lib/Models/RepositionableBoxDrawing";
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
import {
  createCompositeTransform,
  getCompositeTransformation
} from "../../lib/Models/RepositionableComposite";
import { exportRepositionableCatalog } from "../../lib/Models/RepositionableCatalogExport";

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

  it("round-trips editable whole-composite coordinates and rotation", function () {
    const initial = Matrix4.fromTranslationQuaternionRotationScale(
      Cartesian3.fromDegrees(-122.3, 37.8, 41),
      Quaternion.IDENTITY,
      new Cartesian3(250, 250, 250)
    );
    const requested = {
      latitude: 47.6,
      longitude: -122.3,
      height: 85,
      heading: 23,
      pitch: -8,
      roll: 12
    };

    const updated = createCompositeTransform(initial, requested);
    const actual = getCompositeTransformation(updated);

    expect(actual).toBeDefined();
    expect(actual?.latitude).toBeCloseTo(requested.latitude, 6);
    expect(actual?.longitude).toBeCloseTo(requested.longitude, 6);
    expect(actual?.height).toBeCloseTo(requested.height, 3);
    expect(actual?.heading).toBeCloseTo(requested.heading, 6);
    expect(actual?.pitch).toBeCloseTo(requested.pitch, 6);
    expect(actual?.roll).toBeCloseTo(requested.roll, 6);
    expect(Matrix4.getScale(updated, new Cartesian3()).x).toBeCloseTo(250);
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
      clampToGroundOnce: jasmine
        .createSpy("clampToGroundOnce")
        .and.returnValue(Promise.resolve(true)),
      stopInteractions: jasmine.createSpy("stopInteractions")
    } as unknown as RepositionableBoxDrawing;

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
    } as RepositionableBoxDrawingChangeParams);

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

  it("delegates ground clamping to BoxDrawing", async function () {
    const harness = createHarness();

    const result = await harness.controller.clampToGround();

    expect(result).toBeTrue();
    expect(harness.boxDrawing.clampToGroundOnce).toHaveBeenCalledTimes(1);
  });

  it("is safe to dispose more than once", function () {
    const harness = createHarness();

    harness.controller.dispose();
    harness.controller.dispose();

    expect(harness.cesium.dataSources.remove).toHaveBeenCalledTimes(1);
  });

  it("exports definition and user strata in a reloadable init source", async function () {
    const terria = new Terria();
    const item = new GltfCatalogItem("repositioned-layer", terria);
    item.setTrait(CommonStrata.definition, "name", "Repositioned Layer");
    item.setTrait(CommonStrata.user, "isRepositionable", true);

    const exported = exportRepositionableCatalog(item);
    const json = JSON.parse(await exported.blob.text());

    expect(exported.filename).toBe("repositioned-layer.json");
    expect(json.workbench).toEqual(["repositioned-layer"]);
    expect(json.models["repositioned-layer"].strata.definition.name).toBe(
      "Repositioned Layer"
    );
    expect(json.models["repositioned-layer"].strata.user.isRepositionable).toBe(
      true
    );
  });
});
