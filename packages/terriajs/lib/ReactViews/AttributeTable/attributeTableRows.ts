import { FEATURE_ID_PROP } from "../../ModelMixins/GeojsonMixin";
import GeoJsonMixin from "../../ModelMixins/GeojsonMixin";
import MappableMixin from "../../ModelMixins/MappableMixin";
import TableMixin from "../../ModelMixins/TableMixin";
import { BaseModel } from "../../Models/Definition/Model";
import TableColumnType from "../../Table/TableColumnType";
import { AttributeTableColumn, AttributeTableRow } from "./types";

export function hasLoadedTableRows(item: TableMixin.Instance): boolean {
  const data = item.dataColumnMajor;
  return !!data && data.length > 0 && (data[0]?.length ?? 0) > 1;
}

export function hasReadyDataFeatures(item: BaseModel): boolean {
  return (
    GeoJsonMixin.isMixedInto(item) &&
    Array.isArray(item.readyData?.features) &&
    item.readyData!.features.length > 0
  );
}

function readEntityPropertyValue(value: unknown): unknown {
  if (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    typeof (value as { getValue?: unknown }).getValue === "function"
  ) {
    try {
      return (value as { getValue: (time?: unknown) => unknown }).getValue();
    } catch {
      return undefined;
    }
  }
  return value;
}

function getEntityPropertyBag(
  entity: any
): Record<string, unknown> | undefined {
  const props = entity?.properties;
  if (!props) return undefined;
  if (typeof props.getValue === "function") {
    try {
      const bag = props.getValue();
      if (bag && typeof bag === "object") return bag as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  const names =
    typeof props.propertyNames !== "undefined"
      ? Array.from(props.propertyNames as string[])
      : Object.keys(props);
  if (names.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const name of names) {
    if (name === "propertyNames") continue;
    out[name] = readEntityPropertyValue(props[name]);
  }
  return out;
}

/**
 * Build rows from currently loaded Cesium/Leaflet entities (RER POI caches, etc.).
 */
export function buildRowsFromMapEntities(item: BaseModel): AttributeTableRow[] {
  if (!MappableMixin.isMixedInto(item)) return [];
  const rows: AttributeTableRow[] = [];
  let index = 0;
  for (const mapItem of item.mapItems) {
    const entities = (mapItem as any)?.entities?.values as any[] | undefined;
    if (!entities) continue;
    for (const entity of entities) {
      const properties = getEntityPropertyBag(entity) ?? {};
      const cleaned: Record<string, unknown> = { ...properties };
      delete cleaned[FEATURE_ID_PROP];
      const rawId =
        cleaned.id ??
        cleaned.OBJECTID ??
        cleaned.objectId ??
        entity.id ??
        index;
      rows.push({
        featureId: String(rawId),
        rowId: index,
        properties: cleaned
      });
      index += 1;
    }
  }
  return rows;
}

export function buildColumnsFromRows(
  rows: AttributeTableRow[]
): AttributeTableColumn[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.properties)) {
      if (key !== FEATURE_ID_PROP) keys.add(key);
    }
  }
  return [...keys].map((key) => ({
    key,
    title: key,
    hidden: false
  }));
}

/**
 * Build display columns from a TableMixin item, excluding internal `_id_` and
 * hidden columns from the default visible set (hidden flag is retained).
 */
export function buildAttributeTableColumns(
  item: TableMixin.Instance
): AttributeTableColumn[] {
  if (hasLoadedTableRows(item)) {
    return (item.tableColumns ?? [])
      .filter((col) => col.name !== FEATURE_ID_PROP)
      .map((col) => ({
        key: col.name,
        title: col.title || col.name,
        hidden: col.type === TableColumnType.hidden
      }));
  }

  if (GeoJsonMixin.isMixedInto(item) && item.readyData?.features?.length) {
    return buildColumnsFromGeoJsonFeatures(item.readyData.features);
  }

  return buildColumnsFromRows(buildRowsFromMapEntities(item));
}

/**
 * Materialize attribute rows from TableMixin column data, GeoJSON `readyData`,
 * or currently loaded map entities (RER POI / Cesium primitive layers).
 */
export function buildAttributeTableRows(
  item: TableMixin.Instance
): AttributeTableRow[] {
  if (hasLoadedTableRows(item)) {
    const rowIds = item.rowIds ?? [];
    const columns = (item.tableColumns ?? []).filter(
      (col) => col.name !== FEATURE_ID_PROP
    );
    const idColumn = (item.tableColumns ?? []).find(
      (col) => col.name === FEATURE_ID_PROP
    );

    return rowIds.map((rowId) => {
      const properties: Record<string, unknown> = {};
      for (const col of columns) {
        properties[col.name] = col.valueFunctionForType(rowId);
      }
      const rawId = idColumn ? idColumn.valueFunctionForType(rowId) : undefined;
      const featureId =
        rawId !== null && rawId !== undefined && String(rawId).length > 0
          ? String(rawId)
          : String(rowId);
      return { featureId, rowId, properties };
    });
  }

  if (GeoJsonMixin.isMixedInto(item) && item.readyData?.features?.length) {
    return buildRowsFromGeoJsonFeatures(item.readyData.features);
  }

  return buildRowsFromMapEntities(item);
}

export function buildColumnsFromGeoJsonFeatures(
  features: { properties?: Record<string, unknown> | null }[]
): AttributeTableColumn[] {
  const keys = new Set<string>();
  for (const feature of features) {
    if (!feature.properties) continue;
    for (const key of Object.keys(feature.properties)) {
      if (key !== FEATURE_ID_PROP) keys.add(key);
    }
  }
  return [...keys].map((key) => ({
    key,
    title: key,
    hidden: false
  }));
}

export function buildRowsFromGeoJsonFeatures(
  features: {
    id?: string | number;
    properties?: Record<string, unknown> | null;
  }[]
): AttributeTableRow[] {
  return features.map((feature, index) => {
    const properties: Record<string, unknown> = {
      ...(feature.properties ?? {})
    };
    delete properties[FEATURE_ID_PROP];
    const rawId =
      properties.id ??
      feature.id ??
      (feature.properties as any)?.[FEATURE_ID_PROP];
    const featureId =
      rawId !== null && rawId !== undefined && String(rawId).length > 0
        ? String(rawId)
        : String(index);
    return { featureId, rowId: index, properties };
  });
}

/**
 * Filter rows by a case-insensitive substring across all property values and
 * the feature id.
 */
export function filterAttributeRows(
  rows: AttributeTableRow[],
  search: string
): AttributeTableRow[] {
  const needle = search.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    if (row.featureId.toLowerCase().includes(needle)) return true;
    return Object.values(row.properties).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(needle)
    );
  });
}

/**
 * Sort rows by a property key. Nullish values sort last in both directions.
 */
export function sortAttributeRows(
  rows: AttributeTableRow[],
  key: string | undefined,
  direction: "asc" | "desc" = "asc"
): AttributeTableRow[] {
  if (!key) return rows;
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a.properties[key];
    const bv = b.properties[key];
    const aNull = av === null || av === undefined || av === "";
    const bNull = bv === null || bv === undefined || bv === "";
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * factor;
    }
    return (
      String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base"
      }) * factor
    );
  });
}

/**
 * Narrow rows to a selected feature-id set, preserving input order.
 */
export function filterRowsBySelectedIds(
  rows: AttributeTableRow[],
  selectedIds: ReadonlySet<string>
): AttributeTableRow[] {
  if (selectedIds.size === 0) return [];
  return rows.filter((row) => selectedIds.has(row.featureId));
}
