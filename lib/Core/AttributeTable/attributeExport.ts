/**
 * Turning attribute table rows back into files: the CSV and GeoJSON the Export
 * button writes, plus the value formatting the table cells and the CSV share so
 * a downloaded file reads exactly like what was on screen.
 */

import Papa from "papaparse";
import { AttributeTableRow } from "../../Models/AttributeTable/AttributeTableSource";

/**
 * How a raw attribute value is shown in a table cell (and written to CSV).
 * Nullish values become an empty cell; objects and arrays are stringified,
 * because a GeoJSON property is free to hold either.
 */
export function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The rows as CSV, one column per field plus a leading `id` column holding the
 * feature id, so an exported file can be joined back onto the layer.
 */
export function attributeRowsToCsv(
  rows: AttributeTableRow[],
  columns: string[]
): string {
  const data = rows.map((row) => [
    row.featureId,
    ...columns.map((column) => formatAttributeValue(row.properties[column]))
  ]);
  return Papa.unparse({ fields: ["id", ...columns], data });
}

/**
 * The rows as a GeoJSON FeatureCollection. Rows whose source had no geometry
 * (a CSV, or a feature with a null geometry) are still exported, as features
 * with a null geometry, so the attributes are never silently dropped. Returns
 * undefined when there is nothing to export.
 */
export function attributeRowsToGeoJson(
  rows: AttributeTableRow[]
): unknown | undefined {
  if (rows.length === 0) return undefined;
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      id: row.featureId,
      geometry: row.geoJsonFeature?.geometry ?? null,
      properties: { ...row.properties }
    }))
  };
}

/**
 * A layer name made safe to use as a download file name: path separators and
 * the characters Windows rejects become dashes, and the result is trimmed and
 * capped so it cannot produce an unusable name.
 */
export function sanitizeExportFileName(
  name: string,
  fallback = "layer"
): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}
