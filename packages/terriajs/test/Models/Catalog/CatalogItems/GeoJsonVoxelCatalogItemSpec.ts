import { runInAction } from "mobx";
import VoxelPrimitive from "terriajs-cesium/Source/Scene/VoxelPrimitive";
import GeoJsonVoxelCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/GeoJsonVoxelCatalogItem";
import Terria from "../../../../lib/Models/Terria";
import "../../../SpecMain";

describe("GeoJsonVoxelCatalogItem", function () {
  let item: GeoJsonVoxelCatalogItem;

  const set = (trait: string, value: unknown) =>
    runInAction(() => item.setTrait("definition", trait as any, value as any));
  const primitive = () => item.mapItems[0] as VoxelPrimitive;

  beforeEach(function () {
    item = new GeoJsonVoxelCatalogItem("test", new Terria());
    set("url", "/test/Voxel/points.geojson");
    set("gridDimensions", [2, 1, 4]);
  });

  it("has type geojson-voxel", function () {
    expect(item.type).toBe("geojson-voxel");
  });

  it("voxelizes the chosen property", async function () {
    set("property", "T");
    expect((await item.loadMapItems()).error).toBeUndefined();
    expect(primitive() instanceof VoxelPrimitive).toBe(true);
    expect(primitive().provider.names).toEqual(["T"]);
    const d = primitive().provider.dimensions;
    expect([d.x, d.y, d.z]).toEqual([2, 1, 4]);
  });

  it("skips features it cannot use", async function () {
    set("property", "T");
    await item.loadMapItems();
    expect(primitive().provider.maxBounds!.z).toBe(15);
  });

  it("errors without property", async function () {
    expect((await item.loadMapItems()).error).toBeDefined();
    expect(item.mapItems).toEqual([]);
  });

  it("errors when no feature has the property", async function () {
    set("property", "NAME");
    expect((await item.loadMapItems()).error).toBeDefined();
    expect(item.mapItems).toEqual([]);
  });

  it("lifts the volume by heightOffset", async function () {
    set("property", "T");
    set("heightOffset", 100);
    await item.loadMapItems();
    expect(primitive().provider.maxBounds!.z).toBe(115);
  });
});
