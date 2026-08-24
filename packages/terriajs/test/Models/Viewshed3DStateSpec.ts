import CesiumMath from "terriajs-cesium/Source/Core/Math";
import {
  DEFAULT_VIEWSHED_HORIZONTAL_FOV,
  DEFAULT_VIEWSHED_TEXTURE_SIZE,
  DEFAULT_VIEWSHED_VERTICAL_FOV
} from "../../lib/Map/Cesium/Viewshed3D";
import { createViewshed3DState } from "../../lib/Models/Viewshed3DState";

describe("Viewshed3DState", () => {
  it("uses the agreed interactive defaults", () => {
    const state = createViewshed3DState(1250);

    expect(CesiumMath.toDegrees(DEFAULT_VIEWSHED_HORIZONTAL_FOV)).toBeCloseTo(
      60
    );
    expect(CesiumMath.toDegrees(DEFAULT_VIEWSHED_VERTICAL_FOV)).toBeCloseTo(45);
    expect(DEFAULT_VIEWSHED_TEXTURE_SIZE).toBe(512);
    expect(state.maximumDistance).toBe(1250);
    expect(state.observerHeight).toBe(0);
    expect(state.targetHeight).toBe(0);
    expect(state.terrainStatus).toBe("updating");
    expect(state.showDebug).toBeFalse();
  });
});
