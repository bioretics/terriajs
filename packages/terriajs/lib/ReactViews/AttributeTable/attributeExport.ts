/**
 * Pure CSV export helpers for the attribute table.
 */

import { AttributeTableColumn, AttributeTableRow } from "./types";

export function sanitizeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Escape quotes by doubling; wrap when needed.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(
  rows: AttributeTableRow[],
  columns: AttributeTableColumn[],
  options?: { includeFeatureId?: boolean }
): string {
  const includeFeatureId = options?.includeFeatureId ?? true;
  const visible = columns.filter((c) => !c.hidden);
  const headers = [
    ...(includeFeatureId ? ["featureId"] : []),
    ...visible.map((c) => c.key)
  ];
  const lines = [headers.map(sanitizeCsvValue).join(",")];
  for (const row of rows) {
    const cells = [
      ...(includeFeatureId ? [row.featureId] : []),
      ...visible.map((c) => sanitizeCsvValue(row.properties[c.key]))
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = "text/csv"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
