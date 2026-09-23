/**
 * Column Explorer summaries (ported from GeoLibre column-explorer).
 */

import {
  computeHistogram,
  isNumericFieldValue,
  type ChartRow,
  type HistogramResult
} from "./attributeCharts";
import {
  computeNumericStats,
  computeTextStats,
  isBlank,
  type FieldStats
} from "./attributeStats";

export const COLUMN_EXPLORER_BINS = 12;
export const COLUMN_EXPLORER_TOP_VALUES = 8;

export interface ColumnSummary {
  key: string;
  stats: FieldStats;
  histogram: HistogramResult | null;
  total: number;
}

export function summarizeColumn(
  rows: ChartRow[],
  key: string
): ColumnSummary | null {
  const values: number[] = [];
  let nulls = 0;
  let nonNumeric = 0;
  let numeric = 0;
  let populated = 0;
  for (const row of rows) {
    const raw = row.properties[key];
    if (isBlank(raw)) {
      nulls += 1;
      if (raw !== null && raw !== undefined && raw !== "") populated += 1;
      continue;
    }
    populated += 1;
    if (isNumericFieldValue(raw)) {
      numeric += 1;
      values.push(raw);
    } else nonNumeric += 1;
  }

  const isNumeric = numeric >= 2 && numeric >= populated / 2;
  if (!isNumeric) {
    const stats = computeTextStats(rows, key, COLUMN_EXPLORER_TOP_VALUES);
    return { key, stats, histogram: null, total: rows.length };
  }

  const stats = computeNumericStats(values, nulls, nonNumeric);
  if (!stats) return null;
  const histogram = computeHistogram(values, COLUMN_EXPLORER_BINS);
  return { key, stats, histogram, total: rows.length };
}

export function summarizeColumns(
  rows: ChartRow[],
  columns: string[]
): ColumnSummary[] {
  const summaries: ColumnSummary[] = [];
  for (const key of columns) {
    const summary = summarizeColumn(rows, key);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

export function populatedCount(summary: ColumnSummary): number {
  return summary.total - summary.stats.nulls;
}
