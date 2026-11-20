import { PlyData } from "./parsePly";

export interface PlyModel {
  glb: ArrayBuffer;
  center: [number, number, number];
  size: [number, number, number];
  isPointCloud: boolean;
  vertexCount: number;
  sourceVertexCount: number;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;
const UNSIGNED_INT = 5125;
const POINTS = 0;
const TRIANGLES = 4;

function computeNormals(positions: Float32Array, indices: Uint32Array) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  return normals;
}

function normalize(normals: Float32Array) {
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (length > 0 && Number.isFinite(length)) {
      normals[i] /= length;
      normals[i + 1] /= length;
      normals[i + 2] /= length;
    } else {
      normals[i] = 0;
      normals[i + 1] = 0;
      normals[i + 2] = 1;
    }
  }
  return normals;
}

export default function plyToGlb(data: PlyData): PlyModel {
  const vertexCount = data.positions.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.positions.length; i++) {
    const value = data.positions[i];
    if (value < min[i % 3]) min[i % 3] = value;
    if (value > max[i % 3]) max[i % 3] = value;
  }
  const center: [number, number, number] = [0, 1, 2].map(
    (c) => (min[c] + max[c]) / 2
  ) as [number, number, number];

  const positions = new Float32Array(data.positions.length);
  for (let i = 0; i < positions.length; i++) {
    positions[i] = data.positions[i] - center[i % 3];
  }
  const localMin = [Infinity, Infinity, Infinity];
  const localMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    localMin[i % 3] = Math.min(localMin[i % 3], positions[i]);
    localMax[i % 3] = Math.max(localMax[i % 3], positions[i]);
  }

  const indices =
    data.indices && data.indices.length > 0 ? data.indices : undefined;
  const isPointCloud = indices === undefined;
  const normals = data.normals
    ? normalize(data.normals.slice())
    : indices
      ? normalize(computeNormals(positions, indices))
      : undefined;

  const chunks: { data: ArrayBufferView; target: number }[] = [];
  const accessors: object[] = [];
  const attributes: Record<string, number> = {};
  const addAccessor = (
    view: ArrayBufferView,
    target: number,
    accessor: object
  ) => {
    chunks.push({ data: view, target });
    accessors.push({ bufferView: chunks.length - 1, ...accessor });
    return accessors.length - 1;
  };

  attributes.POSITION = addAccessor(positions, ARRAY_BUFFER, {
    componentType: FLOAT,
    count: vertexCount,
    type: "VEC3",
    min: localMin,
    max: localMax
  });
  if (normals) {
    attributes.NORMAL = addAccessor(normals, ARRAY_BUFFER, {
      componentType: FLOAT,
      count: vertexCount,
      type: "VEC3"
    });
  }
  if (data.colors) {
    attributes.COLOR_0 = addAccessor(data.colors, ARRAY_BUFFER, {
      componentType: UNSIGNED_BYTE,
      normalized: true,
      count: vertexCount,
      type: "VEC4"
    });
  }
  const indicesAccessor = indices
    ? addAccessor(indices, ELEMENT_ARRAY_BUFFER, {
        componentType: UNSIGNED_INT,
        count: indices.length,
        type: "SCALAR"
      })
    : undefined;

  let byteOffset = 0;
  const bufferViews = chunks.map(({ data, target }) => {
    const view = { buffer: 0, byteOffset, byteLength: data.byteLength, target };
    byteOffset += data.byteLength;
    return view;
  });
  const binLength = byteOffset;

  const gltf = {
    asset: { version: "2.0", generator: "TerriaJS PLY converter" },
    extensionsUsed: isPointCloud ? ["KHR_materials_unlit"] : undefined,
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes,
            indices: indicesAccessor,
            mode: isPointCloud ? POINTS : TRIANGLES,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor:
            data.colors || isPointCloud ? [1, 1, 1, 1] : [0.8, 0.8, 0.8, 1],
          metallicFactor: 0,
          roughnessFactor: 1
        },
        alphaMode: data.hasAlpha ? "BLEND" : "OPAQUE",
        doubleSided: true,
        extensions: isPointCloud ? { KHR_materials_unlit: {} } : undefined
      }
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binLength }]
  };

  const encoder = new TextEncoder();
  let json = encoder.encode(JSON.stringify(gltf));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  if (jsonLength !== json.length) {
    const padded = new Uint8Array(jsonLength).fill(0x20);
    padded.set(json);
    json = padded;
  }

  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const glb = new ArrayBuffer(totalLength);
  const view = new DataView(glb);
  const bytes = new Uint8Array(glb);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20);
  let offset = 20 + jsonLength;
  view.setUint32(offset, binLength, true);
  view.setUint32(offset + 4, 0x004e4942, true);
  offset += 8;
  for (const { data } of chunks) {
    bytes.set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      offset
    );
    offset += data.byteLength;
  }

  return {
    glb,
    center,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    isPointCloud,
    vertexCount,
    sourceVertexCount: data.sourceVertexCount
  };
}
