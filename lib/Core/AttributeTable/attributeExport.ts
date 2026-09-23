/**
 * Turning attribute table rows back into files: the CSV and GeoJSON the Export
 * button writes. Cells are written with the same `formatAttributeValue` the
 * table renders with, so a downloaded file reads exactly like what was on
 * screen.
 */

import Papa from "papaparse";
import { AttributeTableRow } from "../../Models/AttributeTable/AttributeTableSource";
import { formatAttributeValue } from "./attributeValue";

export { formatAttributeValue };

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
