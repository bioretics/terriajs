import { applyOpacityToStyleColor } from "../../lib/ModelMixins/cesium3dTilesApplyOpacityToStyleColor";
import "../SpecMain";

describe("applyOpacityToStyleColor", function () {
  it("wraps a non-CSS color expression", function () {
    expect(applyOpacityToStyleColor("vec4(${Height})")).toBe(
      "color((vec4(${Height})), ${opacity})"
    );
  });

  it("wraps color() expressions", function () {
    expect(applyOpacityToStyleColor("color('white')")).toBe(
      "color((color('white')), ${opacity})"
    );
  });

  it("rewrites CSS colors", function () {
    expect(applyOpacityToStyleColor("#00ff00")).toBe(
      "color('#00ff00', ${opacity})"
    );
  });

  it("does not double-wrap expressions that already use opacity", function () {
    const expr = "color('#ff0000', ${opacity})";
    expect(applyOpacityToStyleColor(expr)).toBe(expr);
  });

  it("rewrites each condition color value", function () {
    expect(
      applyOpacityToStyleColor({
        conditions: [
          ["true", "color('dodgerblue')"],
          ["${Height} > 100", "#ff0000"]
        ]
      })
    ).toEqual({
      conditions: [
        ["true", "color((color('dodgerblue')), ${opacity})"],
        ["${Height} > 100", "color('#ff0000', ${opacity})"]
      ]
    });
  });
});
