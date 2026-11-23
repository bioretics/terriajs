import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import BoxDrawing, {
  BoxDrawingChangeParams
} from "../../lib/Models/BoxDrawing";
import Cesium from "../../lib/Models/Cesium";
import RepositionableLayer, {
  RepositionableLayerAdapter
} from "../../lib/Models/RepositionableLayer";
import { BaseModel } from "../../lib/Models/Definition/Model";

describe("RepositionableLayer", function () {
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
        remove: jasmine.createSpy("remove").and.returnValue(true)
      }
    } as unknown as Cesium;

    const adapter: RepositionableLayerAdapter<string, BaseModel> = {
      item,
      snapshot: () => "original",
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

  it("is safe to dispose more than once", function () {
    const harness = createHarness();

    harness.controller.dispose();
    harness.controller.dispose();

    expect(harness.cesium.dataSources.remove).toHaveBeenCalledTimes(1);
  });
});
