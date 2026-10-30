import { interpolateSpectral } from "d3-scale-chromatic";
import { runInAction } from "mobx";
import Color from "terriajs-cesium/Source/Core/Color";
import VoxelPrimitive from "terriajs-cesium/Source/Scene/VoxelPrimitive";
import VoxelCatalogItem, {
  paletteTexels
} from "../../../../lib/Models/Catalog/CatalogItems/VoxelCatalogItem";
import Terria from "../../../../lib/Models/Terria";
import "../../../SpecMain";

describe("VoxelCatalogItem", function () {
  let item: VoxelCatalogItem;

  const primitive = () => item.mapItems[0] as VoxelPrimitive;
  const uniform = (name: string) =>
    (primitive().customShader.uniforms as any)[name].value;
  const set = (trait: string, value: unknown) =>
    runInAction(() => item.setTrait("definition", trait as any, value as any));

  beforeEach(async function () {
    item = new VoxelCatalogItem("test", new Terria());
    set("url", "/test/Voxel/tileset.json");
    await item.loadMapItems();
  });

  it("has type 3d-tiles-voxel", function () {
    expect(item.type).toBe("3d-tiles-voxel");
  });

  it("is mappable", function () {
    expect(item.isMappable).toBe(true);
  });

  it("yields one VoxelPrimitive", function () {
    expect(item.mapItems.length).toBe(1);
    expect(primitive() instanceof VoxelPrimitive).toBe(true);
  });

  it("follows show", function () {
    set("show", false);
    expect(primitive().show).toBe(false);
  });

  it("sets range and opacity uniforms", function () {
    set("minimumValue", 32);
    set("maximumValue", 4);
    set("opacity", 0.5);
    expect(uniform("u_min")).toBe(32);
    expect(uniform("u_max")).toBe(4);
    expect(uniform("u_opacity")).toBe(0.5);
  });

  it("avoids a zero range", function () {
    set("minimumValue", 5);
    set("maximumValue", 5);
    expect(uniform("u_max")).toBe(6);
  });

  it("keeps primitive and shader on opacity change", function () {
    const first = primitive();
    const shader = first.customShader;
    set("opacity", 0.3);
    expect(primitive()).toBe(first);
    expect(primitive().customShader).toBe(shader);
  });

  it("hides noData only when set", function () {
    expect(primitive().customShader.fragmentShaderText).not.toContain(
      "== u_noData"
    );
    set("noDataValue", -999);
    expect(primitive().customShader.fragmentShaderText).toContain(
      "== u_noData"
    );
    expect(uniform("u_noData")).toBe(-999);
  });

  it("recreates the primitive after destroy", async function () {
    const first = primitive();
    first.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = primitive();
    expect(second).not.toBe(first);
    expect(second.isDestroyed()).toBe(false);
  });

  it("gives a recreated primitive its own shader", async function () {
    const first = primitive();
    const shader = first.customShader;
    first.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(primitive().customShader).not.toBe(shader);
  });

  it("errors on a non-voxel tileset", async function () {
    set("url", "/test/Cesium3DTiles/tileset.json");
    expect((await item.loadMapItems()).error).toBeDefined();
    expect(item.mapItems).toEqual([]);
  });

  it("falls back to Viridis", function () {
    expect(paletteTexels("Nope")).toEqual(paletteTexels("Viridis"));
  });

  it("ends the palette on interpolator(1)", function () {
    expect(Array.from(paletteTexels("Spectral").slice(-4))).toEqual(
      Color.fromCssColorString(interpolateSpectral(1)).toBytes()
    );
  });
});
