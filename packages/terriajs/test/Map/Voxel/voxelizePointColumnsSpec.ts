import {
  ColumnPoint,
  createPointColumnsVoxelProvider,
  VOXEL_NO_DATA,
  voxelizePointColumns
} from "../../../lib/Map/Voxel/voxelizePointColumns";

describe("voxelizePointColumns", function () {
  const pts: ColumnPoint[] = [
    { lon: 10, lat: 45, z: 0, value: 1 },
    { lon: 10, lat: 45, z: 10, value: 2 },
    { lon: 10.001, lat: 45, z: 0, value: 3 },
    { lon: 10.001, lat: 45, z: 10, value: 4 }
  ];

  it("computes bounds from column centres and layer boundaries", function () {
    const g = voxelizePointColumns(pts, [2, 1, 4]);
    expect([g.west, g.east, g.south, g.north]).toEqual([10, 10.001, 45, 45]);
    expect([g.minHeight, g.maxHeight]).toEqual([-5, 15]);
  });

  it("assigns each voxel the layer of the nearest column", function () {
    const g = voxelizePointColumns(pts, [2, 1, 4]);
    expect(Array.from(g.values)).toEqual([1, 3, 1, 3, 2, 4, 2, 4]);
  });

  it("leaves voxels outside a column empty", function () {
    const tall = voxelizePointColumns(
      [...pts, { lon: 10, lat: 45, z: 20, value: 9 }],
      [2, 1, 5]
    );
    expect(tall.values[1 + 2 * 4]).toBe(VOXEL_NO_DATA);
    expect(tall.values[0 + 2 * 4]).toBe(9);
  });

  it("handles a single column", function () {
    const single = voxelizePointColumns(pts.slice(0, 2), [1, 1, 2]);
    expect(Array.from(single.values)).toEqual([1, 2]);
  });

  it("creates an ellipsoid provider lifted by heightOffset", function () {
    const g = voxelizePointColumns(pts, [2, 1, 4]);
    const p = createPointColumnsVoxelProvider(g, "T", 100);
    expect(p.names).toEqual(["T"]);
    expect(p.maxBounds!.z).toBe(115);
    expect(p.dimensions.x).toBe(2);
    expect(p.minBounds!.x).toBeCloseTo((10 * Math.PI) / 180, 12);
  });
});
