import { deepEqual } from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const BASE = "https://tds.hycom.org/thredds/dodsC/GOMu0.04/expt_90.1m000";
const FILL = -30000;
const NO_DATA = -999;

export function resampleColumn(depths, values, targets) {
  return targets.map((d) => {
    const k = depths.findIndex((depth) => depth >= d);
    if (k === -1) return NO_DATA;
    if (k === 0 || depths[k] === d) return values[k];
    const a = values[k - 1];
    const b = values[k];
    if (a === NO_DATA || b === NO_DATA) return NO_DATA;
    return a + ((d - depths[k - 1]) / (depths[k] - depths[k - 1])) * (b - a);
  });
}

export function parseAsciiVector(text, name) {
  const lines = text.split("\n");
  const i = lines.findIndex((line) => line.startsWith(`${name}[`));
  return lines[i + 1].split(",").map(Number);
}

export function parseAsciiGrid(text) {
  const lines = text.split("\n");
  const out = [];
  let i = lines.findIndex((line) => line.startsWith("water_temp.water_temp["));
  for (i++; i < lines.length && lines[i].trim(); i++) {
    const row = lines[i];
    for (const v of row.slice(row.indexOf(",") + 1).split(","))
      out.push(Number(v));
  }
  return out;
}

export async function writeTileset(
  dir,
  { values, nx, ny, nz, west, south, east, north, height }
) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === NO_DATA) continue;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const dimensions = [nx, ny, nz];
  const schema = {
    classes: {
      voxel: {
        properties: {
          temperature: { type: "SCALAR", componentType: "FLOAT32" }
        }
      }
    }
  };
  const tileset = {
    asset: { version: "1.1" },
    schema,
    statistics: {
      classes: {
        voxel: {
          count: values.length,
          properties: { temperature: { min, max } }
        }
      }
    },
    geometricError: 0,
    root: {
      boundingVolume: { region: [west, south, east, north, 0, height] },
      geometricError: 16,
      refine: "REPLACE",
      content: {
        uri: "tiles/{level}/{x}/{y}/{z}.gltf",
        extensions: {
          "3DTILES_content_voxels": { dimensions, class: "voxel" }
        }
      },
      implicitTiling: {
        subdivisionScheme: "OCTREE",
        subtreeLevels: 1,
        availableLevels: 1,
        subtrees: { uri: "subtrees/{level}/{x}/{y}/{z}.json" }
      }
    },
    extensionsUsed: ["3DTILES_content_voxels"],
    extensionsRequired: ["3DTILES_content_voxels"]
  };
  const subtree = {
    tileAvailability: { constant: 1 },
    contentAvailability: [{ constant: 1 }],
    childSubtreeAvailability: { constant: 0 }
  };
  const extensions = ["EXT_primitive_voxels", "EXT_structural_metadata"];
  const gltf = {
    asset: { version: "2.0" },
    extensionsUsed: extensions,
    extensionsRequired: extensions,
    extensions: {
      EXT_structural_metadata: {
        schema,
        propertyAttributes: [
          {
            class: "voxel",
            properties: { temperature: { attribute: "_TEMPERATURE" } }
          }
        ]
      }
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { _TEMPERATURE: 0 },
            mode: 2147483647,
            extensions: {
              EXT_primitive_voxels: { shape: 0, dimensions },
              EXT_structural_metadata: { propertyAttributes: [0] }
            }
          }
        ]
      }
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: values.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: values.byteLength }],
    buffers: [{ uri: "temperature.bin", byteLength: values.byteLength }]
  };
  const tileDir = join(dir, "tiles/0/0/0");
  const subtreeDir = join(dir, "subtrees/0/0/0");
  await mkdir(tileDir, { recursive: true });
  await mkdir(subtreeDir, { recursive: true });
  await writeFile(join(dir, "tileset.json"), JSON.stringify(tileset, null, 2));
  await writeFile(join(subtreeDir, "0.json"), JSON.stringify(subtree, null, 2));
  await writeFile(join(tileDir, "0.gltf"), JSON.stringify(gltf, null, 2));
  await writeFile(
    join(tileDir, "temperature.bin"),
    Buffer.from(values.buffer, values.byteOffset, values.byteLength)
  );
  console.log(`wrote ${dir} ${dimensions.join("x")} min ${min} max ${max}`);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const encode = (s) => s.replaceAll("[", "%5B").replaceAll("]", "%5D");
const toRadians = (degrees) => (degrees * Math.PI) / 180;

async function build({ date, stride, maxDepth, layers, exaggeration, out }) {
  const das = await fetchText(`${BASE}.das`);
  const block = das.slice(das.indexOf("water_temp {"));
  const scale = Number(block.match(/scale_factor ([-\d.eE]+)/)[1]);
  const offset = Number(block.match(/add_offset ([-\d.eE]+)/)[1]);

  const axes = await fetchText(`${BASE}.ascii?depth,lat,lon,time`);
  const [depth, lat, lon, time] = ["depth", "lat", "lon", "time"].map((n) =>
    parseAsciiVector(axes, n)
  );
  const epoch = Date.UTC(2000, 0, 1);
  const target = (Date.parse(date) - epoch) / 3600000;
  let t = 0;
  time.forEach((h, i) => {
    if (Math.abs(h - target) < Math.abs(time[t] - target)) t = i;
  });
  console.log(`time ${new Date(epoch + time[t] * 3600000).toISOString()}`);

  const deeper = depth.findIndex((d) => d > maxDepth);
  const levels = deeper === -1 ? depth.length : deeper + 1;
  const lats = lat.filter((_, i) => i % stride === 0);
  const lons = lon.filter((_, i) => i % stride === 0);
  const nx = lons.length;
  const ny = lats.length;
  const grids = [];
  for (let k = 0; k < levels; k++) {
    console.log(`level ${k + 1}/${levels} (${depth[k]} m)`);
    const query = `water_temp[${t}][${k}][0:${stride}:${lat.length - 1}][0:${stride}:${lon.length - 1}]`;
    const grid = parseAsciiGrid(
      await fetchText(`${BASE}.ascii?${encode(query)}`)
    );
    if (grid.length !== nx * ny) {
      throw new Error(
        `level ${k}: expected ${nx * ny} values, got ${grid.length}`
      );
    }
    grids.push(grid.map((v) => (v === FILL ? NO_DATA : v * scale + offset)));
  }

  const nz = layers;
  const targets = Array.from(
    { length: nz },
    (_, i) => ((i + 0.5) * maxDepth) / nz
  );
  const depths = depth.slice(0, levels);
  const values = new Float32Array(nx * ny * nz);
  for (let p = 0; p < nx * ny; p++) {
    const column = resampleColumn(
      depths,
      grids.map((grid) => grid[p]),
      targets
    );
    column.forEach((v, i) => {
      values[p + nx * ny * (nz - 1 - i)] = v;
    });
  }

  const halfLon = (lons[1] - lons[0]) / 2;
  const halfLat = (lats[1] - lats[0]) / 2;
  await writeTileset(out, {
    values,
    nx,
    ny,
    nz,
    west: toRadians(lons[0] - halfLon),
    south: toRadians(lats[0] - halfLat),
    east: toRadians(lons[nx - 1] + halfLon),
    north: toRadians(lats[ny - 1] + halfLat),
    height: maxDepth * exaggeration
  });
}

function selftest() {
  deepEqual(resampleColumn([0, 10, 20], [30, 20, 10], [5, 15]), [25, 15]);
  deepEqual(resampleColumn([0, 10, 20], [30, -999, 10], [5, 15]), [-999, -999]);
  deepEqual(resampleColumn([0, 10], [30, 20], [10, 25]), [20, -999]);
  deepEqual(resampleColumn([0, 10], [-999, -999], [5]), [-999]);
  deepEqual(
    parseAsciiGrid(
      "x\nwater_temp.water_temp[1][1][2][2]\n[0][0][0], 1, 2\n[0][0][1], -30000, 4\n\nwater_temp.time[1]\n9"
    ),
    [1, 2, -30000, 4]
  );
  deepEqual(parseAsciiVector("depth[3]\n0.0, 2.0, 4.0\n", "depth"), [0, 2, 4]);
  console.log("selftest ok");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: args } = parseArgs({
    options: {
      date: { type: "string", default: "2022-08-15T00:00Z" },
      stride: { type: "string", default: "1" },
      "max-depth": { type: "string", default: "1000" },
      layers: { type: "string", default: "25" },
      exaggeration: { type: "string", default: "50" },
      out: {
        type: "string",
        default: "apps/terriamap/wwwroot/test/voxels/gulf-of-mexico"
      },
      selftest: { type: "boolean" },
      fixture: { type: "string" }
    }
  });
  if (args.selftest) {
    selftest();
  } else if (args.fixture) {
    await writeTileset(args.fixture, {
      values: new Float32Array([0, 1, 2, 3, 4, 5, 6, NO_DATA]),
      nx: 2,
      ny: 2,
      nz: 2,
      west: -0.01,
      south: -0.01,
      east: 0.01,
      north: 0.01,
      height: 1000
    });
  } else {
    await build({
      date: args.date,
      stride: Number(args.stride),
      maxDepth: Number(args["max-depth"]),
      layers: Number(args.layers),
      exaggeration: Number(args.exaggeration),
      out: args.out
    });
  }
}
