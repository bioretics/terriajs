/**
 * Pure data helpers for the Column explorer dialog: roll every field of a layer
 * into a compact, at-a-glance summary (type, populated vs null, unique count,
 * numeric range and a small distribution). This composes the existing field
 * statistics and chart helpers rather than recomputing anything. Like the
 * statistics dialog it respects the primitive value types the rows carry, so
 * numeric-looking text remains text unless the caller coerced it first. Kept
 * free of rendering and React so it can be unit-tested in isolation.
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

/** Bins used for a numeric column's distribution sparkline. */
export const COLUMN_EXPLORER_BINS = 12;
/** How many most-frequent values a text column lists in the explorer. */
export const COLUMN_EXPLORER_TOP_VALUES = 8;

export interface ColumnSummary {
  /** The field name. */
  key: string;
  /** Numeric or text statistics (count / nulls / unique / ...). */
  stats: FieldStats;
  /**
   * Equal-width distribution of the field's finite numeric values, for the
   * sparkline. Undefined for text fields (which show their top values instead)
   * and when there is nothing to bin.
   */
  histogram: HistogramResult | undefined;
  /** Total rows considered (populated + null), for the fill ratio. */
  total: number;
}

/**
 * Summarize one field across `rows`: its statistics (numeric or text, chosen
 * from the stored primitive values) plus a numeric distribution when the field
 * reads as numeric. Returns undefined only when the field yields no statistics
 * at all, so callers can skip it.
 *
 * A single pass both classifies the field and, when it reads as numeric,
 * collects its finite values for `computeNumericStats` and `computeHistogram` -
 * so a numeric column is not scanned once to classify and again to extract.
 * Populated means not null and not the empty string. Numeric means at least two
 * finite number-typed values that make up at least half of those populated rows.
 */
export function summarizeColumn(
  rows: ChartRow[],
  key: string
): ColumnSummary | undefined {
  const values: number[] = [];
  let nulls = 0;
  let nonNumeric = 0;
  let numeric = 0;
  // Populated rows exclude null and empty strings. Keep this separate from the
  // trimming `nulls` count used by statistics so whitespace remains populated
  // for field-type classification.
  let populated = 0;
  for (const row of rows) {
    const raw = row.properties[key];
    if (isBlank(raw)) {
      nulls += 1;
      // A whitespace-only string is blank for statistics but still a populated,
      // non-numeric row for classification.
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
    return { key, stats, histogram: undefined, total: rows.length };
  }

  const stats = computeNumericStats(values, nulls, nonNumeric);
  if (!stats) return undefined;
  const histogram = computeHistogram(values, COLUMN_EXPLORER_BINS);
  return { key, stats, histogram, total: rows.length };
}

/**
 * Summarize every field in `columns`, preserving their given order and dropping
 * any that yield no statistics.
 */
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

/**
 * Rows that hold a value for the field (total minus nulls). For a numeric field
 * this includes the rows whose value was non-numeric text, which still count as
 * populated even though they are excluded from the numeric statistics.
 */
export function populatedCount(summary: ColumnSummary): number {
  return summary.total - summary.stats.nulls;
}
