import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import MetadataComponentType from "terriajs-cesium/Source/Scene/MetadataComponentType";
import MetadataType from "terriajs-cesium/Source/Scene/MetadataType";
import VoxelContent from "terriajs-cesium/Source/Scene/VoxelContent";
import VoxelProvider from "terriajs-cesium/Source/Scene/VoxelProvider";
import VoxelShapeType from "terriajs-cesium/Source/Scene/VoxelShapeType";

export const VOXEL_NO_DATA = -9999;

export interface ColumnPoint {
  lon: number;
  lat: number;
  z: number;
  value: number;
}

export interface PointColumnsGrid {
  values: Float32Array;
  dimensions: [number, number, number];
  west: number;
  south: number;
  east: number;
  north: number;
  minHeight: number;
  maxHeight: number;
}

interface Column {
  lon: number;
  lat: number;
  values: number[];
  boundaries: number[];
}

function toColumn(points: ColumnPoint[]): Column {
  const sorted = [...points].sort((a, b) => a.z - b.z);
  const z = sorted.map((p) => p.z);
  const n = z.length;
  const boundaries =
    n === 1
      ? [z[0], z[0]]
      : [
          z[0] - (z[1] - z[0]) / 2,
          ...z.slice(1).map((v, i) => (z[i] + v) / 2),
          z[n - 1] + (z[n - 1] - z[n - 2]) / 2
        ];
  return {
    lon: sorted[0].lon,
    lat: sorted[0].lat,
    values: sorted.map((p) => p.value),
    boundaries
  };
}

function layerValue(column: Column, height: number) {
  const { boundaries, values } = column;
  const last = values.length - 1;
  for (let l = 0; l <= last; l++) {
    if (
      height >= boundaries[l] &&
      (height < boundaries[l + 1] ||
        (l === last && height <= boundaries[l + 1]))
    ) {
      return values[l];
    }
  }
  return VOXEL_NO_DATA;
}

export function voxelizePointColumns(
  points: ColumnPoint[],
  dimensions: [number, number, number]
): PointColumnsGrid {
  const groups = new Map<string, ColumnPoint[]>();
  for (const p of points) {
    const key = `${p.lon},${p.lat}`;
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  const columns = [...groups.values()].map(toColumn);

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (const c of columns) {
    west = Math.min(west, c.lon);
    east = Math.max(east, c.lon);
    south = Math.min(south, c.lat);
    north = Math.max(north, c.lat);
    minHeight = Math.min(minHeight, c.boundaries[0]);
    maxHeight = Math.max(maxHeight, c.boundaries[c.boundaries.length - 1]);
  }

  const [nx, ny, nz] = dimensions;
  const cosLat = Math.cos(CesiumMath.toRadians((south + north) / 2));
  const values = new Float32Array(nx * ny * nz).fill(VOXEL_NO_DATA);
  for (let j = 0; j < ny; j++) {
    const lat = south + ((j + 0.5) / ny) * (north - south);
    for (let i = 0; i < nx; i++) {
      const lon = west + ((i + 0.5) / nx) * (east - west);
      let nearest = columns[0];
      let best = Infinity;
      for (const c of columns) {
        const dx = (c.lon - lon) * cosLat;
        const dy = c.lat - lat;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          nearest = c;
        }
      }
      for (let k = 0; k < nz; k++) {
        const height = minHeight + ((k + 0.5) / nz) * (maxHeight - minHeight);
        values[i + nx * (j + ny * k)] = layerValue(nearest, height);
      }
    }
  }

  return {
    values,
    dimensions,
    west,
    south,
    east,
    north,
    minHeight,
    maxHeight
  };
}

export function createPointColumnsVoxelProvider(
  grid: PointColumnsGrid,
  name: string,
  heightOffset: number
): VoxelProvider {
  return {
    shape: VoxelShapeType.ELLIPSOID,
    minBounds: new Cartesian3(
      CesiumMath.toRadians(grid.west),
      CesiumMath.toRadians(grid.south),
      grid.minHeight + heightOffset
    ),
    maxBounds: new Cartesian3(
      CesiumMath.toRadians(grid.east),
      CesiumMath.toRadians(grid.north),
      grid.maxHeight + heightOffset
    ),
    shapeTransform: Matrix4.fromScale(Ellipsoid.WGS84.radii),
    globalTransform: Matrix4.IDENTITY,
    dimensions: new Cartesian3(...grid.dimensions),
    paddingBefore: Cartesian3.ZERO,
    paddingAfter: Cartesian3.ZERO,
    names: [name],
    types: [MetadataType.SCALAR],
    componentTypes: [MetadataComponentType.FLOAT32],
    minimumValues: undefined,
    maximumValues: undefined,
    maximumTileCount: 1,
    availableLevels: 1,
    requestData: (options?: { tileLevel?: number }) =>
      (options?.tileLevel ?? 0) >= 1
        ? undefined
        : Promise.resolve(VoxelContent.fromMetadataArray([grid.values]))
  } as VoxelProvider;
}
