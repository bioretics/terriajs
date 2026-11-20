import loadArrayBuffer from "../../../lib/Core/loadArrayBuffer";
import { parsePly } from "../../../lib/Core/ply/parsePly";
import plyToGlb from "../../../lib/Core/ply/plyToGlb";

interface Accessor {
  bufferView: number;
  count: number;
  min?: number[];
  max?: number[];
}

interface Gltf {
  accessors: Accessor[];
  bufferViews: { byteOffset: number; byteLength: number }[];
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices?: number;
      mode: number;
    }[];
  }[];
  materials: {
    alphaMode: string;
    extensions?: Record<string, unknown>;
  }[];
  extensionsUsed?: string[];
}

function readGlb(glb: ArrayBuffer) {
  const view = new DataView(glb);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(
    new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength))
  ) as Gltf;
  const binOffset = 20 + jsonLength + 8;
  const floats = (accessorIndex: number) => {
    const bufferView =
      gltf.bufferViews[gltf.accessors[accessorIndex].bufferView];
    return Array.from(
      new Float32Array(
        glb.slice(
          binOffset + bufferView.byteOffset,
          binOffset + bufferView.byteOffset + bufferView.byteLength
        )
      )
    );
  };
  return { gltf, floats };
}

async function convert(name: string) {
  return plyToGlb(parsePly(await loadArrayBuffer(`test/ply/${name}`)));
}

describe("plyToGlb", function () {
  it("moves large coordinates to the bounding box centre before converting to float32", async function () {
    const model = await convert("points-utm-ascii.ply");
    expect(model.center).toEqual([686005.125, 4929010.25, 52.5]);
    expect(model.size).toEqual([10, 20, 4]);
    const { gltf, floats } = readGlb(model.glb);
    const position = gltf.meshes[0].primitives[0].attributes.POSITION;
    expect(floats(position).slice(0, 3)).toEqual([-5, -10, -2]);
    expect(gltf.accessors[position].min).toEqual([-5, -10, -2]);
    expect(gltf.accessors[position].max).toEqual([5, 10, 2]);
  });

  it("writes point clouds as unlit POINTS", async function () {
    const model = await convert("points-binary-le.ply");
    expect(model.isPointCloud).toBeTrue();
    const { gltf } = readGlb(model.glb);
    const primitive = gltf.meshes[0].primitives[0];
    expect(primitive.mode).toBe(0);
    expect(primitive.indices).toBeUndefined();
    expect(primitive.attributes.COLOR_0).toBeDefined();
    expect(gltf.extensionsUsed).toEqual(["KHR_materials_unlit"]);
    expect(gltf.materials[0].alphaMode).toBe("BLEND");
  });

  it("normalises normals from the file", async function () {
    const model = await convert("points-binary-le.ply");
    const { gltf, floats } = readGlb(model.glb);
    const normal = gltf.meshes[0].primitives[0].attributes.NORMAL;
    expect(floats(normal).slice(0, 3)).toEqual([0, 0, 1]);
  });

  it("writes meshes as TRIANGLES and computes missing normals", async function () {
    const model = await convert("mesh-ascii-nocolors.ply");
    expect(model.isPointCloud).toBeFalse();
    const { gltf, floats } = readGlb(model.glb);
    const primitive = gltf.meshes[0].primitives[0];
    expect(primitive.mode).toBe(4);
    expect(gltf.accessors[primitive.indices!].count).toBe(3);
    expect(primitive.attributes.COLOR_0).toBeUndefined();
    expect(floats(primitive.attributes.NORMAL).slice(0, 3)).toEqual([0, 0, 1]);
    expect(gltf.materials[0].alphaMode).toBe("OPAQUE");
  });
});
