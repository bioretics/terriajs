import bbox from "@turf/bbox";
import { Feature as GeoJsonFeature } from "@turf/helpers";
import { computed, makeObservable } from "mobx";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CatalogMemberMixin, {
  getName
} from "../../ModelMixins/CatalogMemberMixin";
import GeoJsonMixin, { FEATURE_ID_PROP } from "../../ModelMixins/GeojsonMixin";
import MappableMixin from "../../ModelMixins/MappableMixin";
import TableMixin from "../../ModelMixins/TableMixin";
import { BaseModel } from "../Definition/Model";

/** One feature of the layer, as the attribute table reads it. */
export interface AttributeTableRow {
  /** Stable id of the feature within its layer (the GeoJSON `_id_` property,
   * or the table row index). Used as the React key and as the selection id. */
  featureId: string;
  /** The attributes shown in the table's columns. */
  properties: Record<string, unknown>;
  /** The GeoJSON feature behind the row, when the source has one. It is what
   * the map highlight is built from (see `AttributeTablePanel`). */
  geoJsonFeature?: GeoJsonFeature;
  /** Bounding rectangle of the row's geometry, when it has one. */
  rectangle?: Rectangle;
}

/** Properties Terria adds to GeoJSON features itself - never shown as columns. */
const INTERNAL_PROPERTIES = new Set<string>([
  FEATURE_ID_PROP,
  "__leafletClusteringConfig__"
]);

/** Points are zoomed to with this much padding, in degrees. */
const POINT_ZOOM_BOX_SIZE = 0.01;

/**
 * A rectangle that covers a single GeoJSON feature, or undefined when its
 * geometry is missing or degenerate. A point (or any zero-sized extent) is
 * padded, otherwise the camera would be asked to fly to a rectangle of no
 * width and end up under the ground.
 */
export function rectangleForGeoJsonFeature(
  feature: GeoJsonFeature
): Rectangle | undefined {
  if (!feature.geometry) return undefined;
  try {
    const [west, south, east, north] = bbox(feature);
    if (
      !isFinite(west) ||
      !isFinite(south) ||
      !isFinite(east) ||
      !isFinite(north)
    )
      return undefined;
    const padX = east - west < POINT_ZOOM_BOX_SIZE ? POINT_ZOOM_BOX_SIZE : 0;
    const padY = north - south < POINT_ZOOM_BOX_SIZE ? POINT_ZOOM_BOX_SIZE : 0;
    return Rectangle.fromDegrees(
      west - padX,
      south - padY,
      east + padX,
      north + padY
    );
  } catch {
    // A malformed geometry should cost the row its zoom, not the whole table.
    return undefined;
  }
}

/** The union of some rectangles, or undefined when there is none. */
export function unionRectangles(
  rectangles: (Rectangle | undefined)[]
): Rectangle | undefined {
  let result: Rectangle | undefined;
  for (const rectangle of rectangles) {
    if (!rectangle) continue;
    result = result ? Rectangle.union(result, rectangle) : rectangle;
  }
  return result;
}

/**
 * Reads the features of a workbench item as attribute table rows.
 *
 * Two kinds of item are supported, in this order:
 *
 * - anything built on `GeoJsonMixin` (GeoJSON, GPX, KML/KMZ, Shapefile, ...):
 *   rows come straight from `readyData`, so they carry their geometry and the
 *   table can highlight and zoom to a feature on the map;
 * - anything else built on `TableMixin` (CSV, and GeoJSON styled through vector
 *   tiles falls back here only when it has no ready data): rows come from the
 *   column-major table, and a row can be located only when the item declares
 *   longitude/latitude columns.
 *
 * Every getter is a MobX computed, so the panel re-reads the layer only when the
 * layer itself changes rather than on each render.
 */
export default class AttributeTableSource {
  constructor(readonly item: BaseModel) {
    makeObservable(this);
  }

  /** Whether this item can be shown in the attribute table at all. */
  static canOpen(item: BaseModel | undefined): boolean {
    if (!item || !MappableMixin.isMixedInto(item)) return false;
    if (GeoJsonMixin.isMixedInto(item)) return true;
    return TableMixin.isMixedInto(item);
  }

  @computed
  get name(): string {
    return CatalogMemberMixin.isMixedInto(this.item) ? getName(this.item) : "";
  }

  /** True while the layer is still loading its data. */
  @computed
  get isLoading(): boolean {
    return MappableMixin.isMixedInto(this.item) && this.item.isLoadingMapItems;
  }

  @computed
  get rows(): AttributeTableRow[] {
    return this.geoJsonRows ?? this.tableRows ?? [];
  }

  /**
   * The columns to show, in the order the fields were first met. Discovered from
   * the rows rather than declared, because GeoJSON features are free to carry
   * different property sets from one another.
   */
  @computed
  get columns(): string[] {
    const keys = new Set<string>();
    for (const row of this.rows) {
      for (const key of Object.keys(row.properties)) keys.add(key);
    }
    return Array.from(keys);
  }

  /** Rows read from a GeoJSON-backed item, or undefined when it is not one. */
  @computed
  private get geoJsonRows(): AttributeTableRow[] | undefined {
    const item = this.item;
    if (!GeoJsonMixin.isMixedInto(item)) return undefined;
    const readyData = item.readyData;
    if (!readyData) return undefined;

    return readyData.features.map((feature, index) => {
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(feature.properties ?? {})) {
        if (INTERNAL_PROPERTIES.has(key)) continue;
        properties[key] = value;
      }
      const geoJsonFeature = feature as GeoJsonFeature;
      return {
        featureId: String(feature.properties?.[FEATURE_ID_PROP] ?? index),
        properties,
        geoJsonFeature,
        rectangle: rectangleForGeoJsonFeature(geoJsonFeature)
      };
    });
  }

  /** Rows read from a table-backed item, or undefined when it is not one. */
  @computed
  private get tableRows(): AttributeTableRow[] | undefined {
    const item = this.item;
    if (!TableMixin.isMixedInto(item)) return undefined;
    const columns = item.tableColumns;
    if (columns.length === 0) return undefined;

    // Longitude/latitude are shown as ordinary columns, but they also let a row
    // be zoomed to - which is the only spatial handle a table item has.
    const longitudes =
      item.activeTableStyle.longitudeColumn?.valuesAsNumbers.values;
    const latitudes =
      item.activeTableStyle.latitudeColumn?.valuesAsNumbers.values;

    return item.rowIds.map((rowId) => {
      const properties: Record<string, unknown> = {};
      for (const column of columns) {
        // A column with no name carries no meaning in the table header; Terria
        // creates one for GeoJSON items that have no properties at all.
        if (!column.name) continue;
        properties[column.name] = column.values[rowId];
      }
      const longitude = longitudes?.[rowId];
      const latitude = latitudes?.[rowId];
      const hasPosition =
        longitude !== undefined &&
        longitude !== null &&
        latitude !== undefined &&
        latitude !== null;
      return {
        featureId: String(rowId),
        properties,
        rectangle: hasPosition
          ? Rectangle.fromDegrees(
              longitude - POINT_ZOOM_BOX_SIZE,
              latitude - POINT_ZOOM_BOX_SIZE,
              longitude + POINT_ZOOM_BOX_SIZE,
              latitude + POINT_ZOOM_BOX_SIZE
            )
          : undefined
      };
    });
  }
}
