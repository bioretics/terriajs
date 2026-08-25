import { DEFAULT_VIEWSHED_TEXTURE_SIZE } from "../../lib/Map/Cesium/Viewshed3D";
import { createViewshed3DState } from "../../lib/Models/Viewshed3DState";

describe("Viewshed3DState", () => {
  it("uses the agreed interactive defaults", () => {
    const state = createViewshed3DState(1250);

    expect(DEFAULT_VIEWSHED_TEXTURE_SIZE).toBe(512);
    expect(state.maximumDistance).toBe(1250);
    expect(state.observerHeight).toBe(0);
    expect(state.terrainStatus).toBe("updating");
  });
});
