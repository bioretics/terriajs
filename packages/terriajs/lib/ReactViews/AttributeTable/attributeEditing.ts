/**
 * Writable GeoJSON commit helpers for Attribute Table edits.
 */

import { Feature, FeatureCollection } from "geojson";
import { toJS } from "mobx";
import { FEATURE_ID_PROP } from "../../ModelMixins/GeojsonMixin";
import GeoJsonCatalogItem from "../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../Models/Definition/CommonStrata";
import { BaseModel } from "../../Models/Definition/Model";
import TableMixin from "../../ModelMixins/TableMixin";
import MappableMixin from "../../ModelMixins/MappableMixin";
import { AttributeTableColumn, AttributeTableRow } from "./types";
import {
  isWritableGeoJsonItem,
  isWritableTableItem
} from "./canOpenAttributeTable";
import { hasLoadedTableRows } from "./attributeTableRows";

export type CellDrafts = Map<string, Map<string, unknown>>;

/**
 * Apply in-memory cell drafts onto a row snapshot (non-mutating).
 */
export function applyDraftsToRows(
  rows: AttributeTableRow[],
  drafts: CellDrafts
): AttributeTableRow[] {
  if (drafts.size === 0) return rows;
  return rows.map((row) => {
    const rowDrafts = drafts.get(row.featureId);
    if (!rowDrafts || rowDrafts.size === 0) return row;
    return {
      ...row,
      properties: { ...row.properties, ...Object.fromEntries(rowDrafts) }
    };
  });
}

function findFeatureIndex(features: Feature[], row: AttributeTableRow): number {
  const byProp = features.findIndex((f) => {
    const id = f.properties?.[FEATURE_ID_PROP];
    return id !== undefined && String(id) === row.featureId;
  });
  if (byProp >= 0) return byProp;
  const byId = features.findIndex(
    (f) => f.id !== undefined && String(f.id) === row.featureId
  );
  if (byId >= 0) return byId;
  if (row.rowId >= 0 && row.rowId < features.length) return row.rowId;
  return -1;
}

/**
 * Build an updated FeatureCollection from table rows + column list.
 * Geometry is preserved from the existing readyData features.
 */
export function buildUpdatedFeatureCollection(
  item: GeoJsonCatalogItem,
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[]
): FeatureCollection | undefined {
  const ready = item.readyData;
  if (!ready?.features) return undefined;

  const sourceFeatures = ready.features as Feature[];
  const columnKeys = columns.map((c) => c.key);
  const rowByIndex = new Map<number, AttributeTableRow>();
  for (const row of rows) {
    const index = findFeatureIndex(sourceFeatures, row);
    if (index >= 0) rowByIndex.set(index, row);
  }

  const features: Feature[] = sourceFeatures.map((feature, index) => {
    const matchingRow = rowByIndex.get(index);
    if (!matchingRow) return feature;

    const properties: Record<string, unknown> = {
      ...(feature.properties ?? {})
    };
    // Drop table-managed keys that are no longer in the column list.
    for (const key of Object.keys(properties)) {
      if (key === FEATURE_ID_PROP) continue;
      if (!columnKeys.includes(key)) {
        delete properties[key];
      }
    }
    for (const key of columnKeys) {
      properties[key] = matchingRow.properties[key] ?? null;
    }

    return {
      ...feature,
      properties
    };
  });

  return {
    type: "FeatureCollection",
    features
  };
}

/**
 * Persist attribute edits for a writable GeoJSON catalog item.
 * Writes `geoJsonData` into the user stratum and forces a map-items reload.
 */
export async function commitGeoJsonAttributeEdits(
  item: BaseModel,
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[]
): Promise<boolean> {
  if (!isWritableGeoJsonItem(item) || !(item instanceof GeoJsonCatalogItem)) {
    return false;
  }

  const fc = buildUpdatedFeatureCollection(item, rows, columns);
  if (!fc) return false;

  item.setTrait(CommonStrata.user, "geoJsonData", toJS(fc) as any);
  if (item.geoJsonString) {
    item.setTrait(CommonStrata.user, "geoJsonString", undefined);
  }

  if (typeof item.loadMapItems === "function") {
    await item.loadMapItems(true);
  }

  return true;
}

function tableCellString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Rebuild TableMixin column-major data from attribute rows (header row at index 0).
 */
export function buildDataColumnMajorFromRows(
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[],
  existing: string[][] | undefined
): string[][] | undefined {
  if (!existing?.length) return undefined;

  const nDataRows = existing[0].length - 1;
  const columnKeys = columns.map((c) => c.key);
  const rowByRowId = new Map(rows.map((r) => [r.rowId, r]));

  const result = existing.map((col) => [...col]);

  for (let colIndex = 0; colIndex < result.length; colIndex++) {
    const colName = result[colIndex][0];
    if (colName === FEATURE_ID_PROP) {
      continue;
    }
    if (!columnKeys.includes(colName)) {
      continue;
    }
    for (let dataIndex = 0; dataIndex < nDataRows; dataIndex++) {
      const row = rowByRowId.get(dataIndex);
      if (!row) continue;
      result[colIndex][dataIndex + 1] = tableCellString(
        row.properties[colName]
      );
    }
  }

  for (const colDef of columns) {
    const exists = result.some((col) => col[0] === colDef.key);
    if (exists) continue;
    const newCol = new Array(nDataRows + 1).fill("");
    newCol[0] = colDef.key;
    for (let dataIndex = 0; dataIndex < nDataRows; dataIndex++) {
      const row = rowByRowId.get(dataIndex);
      if (row) {
        newCol[dataIndex + 1] = tableCellString(row.properties[colDef.key]);
      }
    }
    result.push(newCol);
  }

  return result;
}

export async function commitTableAttributeEdits(
  item: BaseModel,
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[]
): Promise<boolean> {
  if (!isWritableTableItem(item) || !TableMixin.isMixedInto(item)) {
    return false;
  }
  if (!hasLoadedTableRows(item)) {
    return false;
  }

  const built = buildDataColumnMajorFromRows(
    rows,
    columns,
    item.dataColumnMajor
  );
  if (!built) return false;

  item.dataColumnMajor = built;

  if (
    MappableMixin.isMixedInto(item) &&
    typeof item.loadMapItems === "function"
  ) {
    await item.loadMapItems(true);
  }

  return true;
}

/**
 * Persist attribute edits for the active catalog item (GeoJSON or table-backed).
 */
export async function commitAttributeEdits(
  item: BaseModel,
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[]
): Promise<boolean> {
  if (isWritableGeoJsonItem(item)) {
    return commitGeoJsonAttributeEdits(item, rows, columns);
  }
  if (isWritableTableItem(item)) {
    return commitTableAttributeEdits(item, rows, columns);
  }
  return false;
}

export function applyColumnRename(
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[],
  oldKey: string,
  newKey: string,
  newTitle?: string
): { rows: AttributeTableRow[]; columns: AttributeTableColumn[] } {
  if (!newKey || oldKey === newKey) return { rows, columns };
  const nextColumns = columns.map((c) =>
    c.key === oldKey ? { ...c, key: newKey, title: newTitle ?? newKey } : c
  );
  const nextRows = rows.map((row) => {
    const { [oldKey]: value, ...rest } = row.properties;
    return {
      ...row,
      properties: { ...rest, [newKey]: value }
    };
  });
  return { rows: nextRows, columns: nextColumns };
}

export function applyColumnAdd(
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[],
  key: string,
  title?: string
): { rows: AttributeTableRow[]; columns: AttributeTableColumn[] } {
  if (!key || columns.some((c) => c.key === key)) return { rows, columns };
  return {
    columns: [...columns, { key, title: title ?? key, hidden: false }],
    rows: rows.map((row) => ({
      ...row,
      properties: { ...row.properties, [key]: null }
    }))
  };
}

export function applyColumnDelete(
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[],
  key: string
): { rows: AttributeTableRow[]; columns: AttributeTableColumn[] } {
  return {
    columns: columns.filter((c) => c.key !== key),
    rows: rows.map((row) => {
      const { [key]: _removed, ...rest } = row.properties;
      return { ...row, properties: rest };
    })
  };
}

export function applyColumnReorder(
  columns: AttributeTableColumn[],
  fromIndex: number,
  toIndex: number
): AttributeTableColumn[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= columns.length ||
    toIndex >= columns.length
  ) {
    return columns;
  }
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
