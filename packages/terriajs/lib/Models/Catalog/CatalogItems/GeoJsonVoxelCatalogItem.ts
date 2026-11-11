import VoxelProvider from "terriajs-cesium/Source/Scene/VoxelProvider";
import loadJson from "../../../Core/loadJson";
import TerriaError from "../../../Core/TerriaError";
import {
  ColumnPoint,
  createPointColumnsVoxelProvider,
  voxelizePointColumns
} from "../../../Map/Voxel/voxelizePointColumns";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import VoxelCatalogItem from "./VoxelCatalogItem";

export default class GeoJsonVoxelCatalogItem extends VoxelCatalogItem {
  static readonly type = "geojson-voxel";

  get type() {
    return GeoJsonVoxelCatalogItem.type;
  }

  protected async loadVoxelProvider(url: string): Promise<VoxelProvider> {
    const property = this.property;
    if (property === undefined) {
      throw new TerriaError({
        title: "Missing property",
        message: "Set `property` to the feature property to show as voxels"
      });
    }
    const json = await loadJson(proxyCatalogItemUrl(this, url));
    const points: ColumnPoint[] = [];
    for (const feature of json?.features ?? []) {
      const coordinates = feature?.geometry?.coordinates;
      const value = feature?.properties?.[property];
      if (
        feature?.geometry?.type === "Point" &&
        coordinates?.length >= 3 &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        points.push({
          lon: coordinates[0],
          lat: coordinates[1],
          z: coordinates[2],
          value
        });
      }
    }
    if (points.length === 0) {
      throw new TerriaError({
        title: "No voxel data",
        message: `No Point features with a numeric "${property}"`
      });
    }
    const [nx, ny, nz] = this.gridDimensions;
    return createPointColumnsVoxelProvider(
      voxelizePointColumns(points, [nx, ny, nz]),
      property,
      this.heightOffset
    );
  }
}
