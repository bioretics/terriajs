import BoundingSphere from "terriajs-cesium/Source/Core/BoundingSphere";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import ComponentDatatype from "terriajs-cesium/Source/Core/ComponentDatatype";
import Geometry from "terriajs-cesium/Source/Core/Geometry";
import GeometryAttribute from "terriajs-cesium/Source/Core/GeometryAttribute";
import PrimitiveType from "terriajs-cesium/Source/Core/PrimitiveType";

export type LonLat = [number, number];

export interface LineSample {
  longitude: number;
  latitude: number;
  distance: number;
}

export interface SurfacePoint {
  longitude: number;
  latitude: number;
  height: number;
  s: number;
  t: number;
}

export interface SurfaceMesh {
  points: SurfacePoint[];
  indices: number[];
}

const EARTH_RADIUS = 6371008.8;
const METRES_PER_DEGREE = (EARTH_RADIUS * Math.PI) / 180;
const ST_UNIT = 1000;

function metresPerDegreeLongitude(latitude: number) {
  return METRES_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
}

function distance(a: LonLat, b: LonLat) {
  const dx = (b[0] - a[0]) * metresPerDegreeLongitude((a[1] + b[1]) / 2);
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

export function linesFromGeoJson(json: unknown): LonLat[][] {
  if (typeof json !== "object" || json === null) return [];
  const object = json as {
    type?: string;
    features?: unknown[];
    geometry?: unknown;
    geometries?: unknown[];
    coordinates?: unknown;
  };
  switch (object.type) {
    case "FeatureCollection":
      return (object.features ?? []).flatMap(linesFromGeoJson);
    case "Feature":
      return linesFromGeoJson(object.geometry);
    case "GeometryCollection":
      return (object.geometries ?? []).flatMap(linesFromGeoJson);
    case "LineString":
      return [object.coordinates as LonLat[]];
    case "MultiLineString":
      return object.coordinates as LonLat[][];
    default:
      return [];
  }
}

export function resampleLine(line: LonLat[], spacing: number): LineSample[] {
  const samples: LineSample[] = [];
  if (line.length === 0) return samples;
  let travelled = 0;
  let next = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const length = distance(a, b);
    while (next <= travelled + length) {
      const f = length === 0 ? 0 : (next - travelled) / length;
      samples.push({
        longitude: a[0] + (b[0] - a[0]) * f,
        latitude: a[1] + (b[1] - a[1]) * f,
        distance: next
      });
      next += spacing;
    }
    travelled += length;
  }
  const last = line[line.length - 1];
  if (
    samples.length === 0 ||
    samples[samples.length - 1].distance < travelled
  ) {
    samples.push({
      longitude: last[0],
      latitude: last[1],
      distance: travelled
    });
  }
  return samples;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function downstreamProfile(heights: number[], window = 9): number[] {
  const valid = heights.filter(Number.isFinite);
  if (valid.length === 0) return heights.map(() => 0);

  const half = Math.floor(window / 2);
  const smoothed = heights.map((_, i) => {
    const values = heights
      .slice(Math.max(0, i - half), i + half + 1)
      .filter(Number.isFinite);
    return values.length > 0 ? median(values) : median(valid);
  });

  const edge = Math.max(1, Math.round(smoothed.length / 10));
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const flowsForward =
    mean(smoothed.slice(0, edge)) >= mean(smoothed.slice(-edge));

  const order = flowsForward ? smoothed : [...smoothed].reverse();
  let level = Infinity;
  const profile = order.map((height) => (level = Math.min(level, height)));
  return flowsForward ? profile : profile.reverse();
}

export function riverSurfaceMesh(
  samples: LineSample[],
  profile: number[],
  halfWidth: number,
  cellSize: number
): SurfaceMesh {
  if (samples.length === 0) return { points: [], indices: [] };
  const mx = metresPerDegreeLongitude(
    samples.reduce((sum, sample) => sum + sample.latitude, 0) / samples.length
  );
  const xs = samples.map((sample) => sample.longitude * mx);
  const ys = samples.map((sample) => sample.latitude * METRES_PER_DEGREE);
  const minX = Math.min(...xs) - halfWidth;
  const minY = Math.min(...ys) - halfWidth;
  const columns =
    Math.ceil((Math.max(...xs) + halfWidth - minX) / cellSize) + 1;
  const rows = Math.ceil((Math.max(...ys) + halfWidth - minY) / cellSize) + 1;

  const best = new Float64Array(columns * rows).fill(Infinity);
  const nearest = new Int32Array(columns * rows).fill(-1);
  const reach = Math.ceil(halfWidth / cellSize);
  const limit = halfWidth * halfWidth;
  for (let k = 0; k < samples.length; k++) {
    const column = Math.round((xs[k] - minX) / cellSize);
    const row = Math.round((ys[k] - minY) / cellSize);
    for (
      let r = Math.max(0, row - reach);
      r <= Math.min(rows - 1, row + reach);
      r++
    ) {
      for (
        let c = Math.max(0, column - reach);
        c <= Math.min(columns - 1, column + reach);
        c++
      ) {
        const d2 =
          (minX + c * cellSize - xs[k]) ** 2 +
          (minY + r * cellSize - ys[k]) ** 2;
        const index = r * columns + c;
        if (d2 <= limit && d2 < best[index]) {
          best[index] = d2;
          nearest[index] = k;
        }
      }
    }
  }

  const points: SurfacePoint[] = [];
  const vertex = new Int32Array(columns * rows).fill(-1);
  for (let index = 0; index < nearest.length; index++) {
    if (nearest[index] < 0) continue;
    const x = minX + (index % columns) * cellSize;
    const y = minY + Math.floor(index / columns) * cellSize;
    vertex[index] = points.length;
    points.push({
      longitude: x / mx,
      latitude: y / METRES_PER_DEGREE,
      height: profile[nearest[index]],
      s: x - minX,
      t: y - minY
    });
  }

  const indices: number[] = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < columns; c++) {
      const a = vertex[r * columns + c];
      const b = vertex[r * columns + c + 1];
      const d = vertex[(r + 1) * columns + c];
      const e = vertex[(r + 1) * columns + c + 1];
      if (a >= 0 && b >= 0 && d >= 0 && e >= 0) indices.push(a, b, d, b, e, d);
    }
  }
  return { points, indices };
}

export function rectangleSurfaceMesh(
  rectangle: { west: number; south: number; east: number; north: number },
  height: number,
  divisions = 32
): SurfaceMesh {
  const { west, south, east, north } = rectangle;
  const mx = metresPerDegreeLongitude((south + north) / 2);
  const points: SurfacePoint[] = [];
  for (let row = 0; row <= divisions; row++) {
    const latitude = south + ((north - south) * row) / divisions;
    for (let column = 0; column <= divisions; column++) {
      const longitude = west + ((east - west) * column) / divisions;
      points.push({
        longitude,
        latitude,
        height,
        s: (longitude - west) * mx,
        t: (latitude - south) * METRES_PER_DEGREE
      });
    }
  }
  const indices: number[] = [];
  const columns = divisions + 1;
  for (let r = 0; r < divisions; r++) {
    for (let c = 0; c < divisions; c++) {
      const a = r * columns + c;
      indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns);
    }
  }
  return { points, indices };
}

export function surfaceGeometry(meshes: SurfaceMesh[]): Geometry | undefined {
  const usable = meshes.filter((mesh) => mesh.indices.length > 0);
  if (usable.length === 0) return undefined;

  const vertexCount = usable.reduce((sum, mesh) => sum + mesh.points.length, 0);
  const positions = new Float64Array(vertexCount * 3);
  const st = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  const scratch = new Cartesian3();
  let vertex = 0;

  for (const mesh of usable) {
    const first = vertex;
    for (const point of mesh.points) {
      Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        point.height,
        undefined,
        scratch
      );
      positions[vertex * 3] = scratch.x;
      positions[vertex * 3 + 1] = scratch.y;
      positions[vertex * 3 + 2] = scratch.z;
      st[vertex * 2] = point.s / ST_UNIT;
      st[vertex * 2 + 1] = point.t / ST_UNIT;
      vertex++;
    }
    for (const index of mesh.indices) indices.push(first + index);
  }

  return new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions
      }),
      st: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: st
      })
    } as ConstructorParameters<typeof Geometry>[0]["attributes"],
    indices: new Uint32Array(indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(Array.from(positions))
  });
}
