/**
 * Pure field-statistics helpers (ported from GeoLibre attribute-stats).
 */

import { isNumericFieldValue, type ChartRow } from "./attributeCharts";

export interface NumericFieldStats {
  kind: "numeric";
  count: number;
  nulls: number;
  nonNumeric: number;
  unique: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  sum: number;
}

export interface TextValueCount {
  value: string;
  count: number;
}

export interface TextFieldStats {
  kind: "text";
  count: number;
  nulls: number;
  unique: number;
  top: TextValueCount[];
}

export type FieldStats = NumericFieldStats | TextFieldStats;

export const DEFAULT_TOP_VALUES = 5;

export function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function computeNumericStats(
  values: number[],
  nulls = 0,
  nonNumeric = 0
): NumericFieldStats | null {
  if (values.length === 0) return null;

  let min = values[0];
  let max = values[0];
  let sum = 0;
  const distinct = new Set<number>();
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    distinct.add(value);
  }
  const mean = sum / values.length;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  let std = 0;
  if (values.length > 1) {
    let sumSq = 0;
    for (const value of values) {
      const diff = value - mean;
      sumSq += diff * diff;
    }
    std = Math.sqrt(sumSq / (values.length - 1));
  }

  return {
    kind: "numeric",
    count: values.length,
    nulls,
    nonNumeric,
    unique: distinct.size,
    min,
    max,
    mean,
    median,
    std,
    sum
  };
}

export function computeTextStats(
  rows: ChartRow[],
  key: string,
  topCount: number = DEFAULT_TOP_VALUES
): TextFieldStats {
  const counts = new Map<string, number>();
  let nulls = 0;
  for (const row of rows) {
    const raw = row.properties[key];
    if (isBlank(raw)) {
      nulls += 1;
      continue;
    }
    const value = String(raw);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let count = 0;
  for (const n of counts.values()) count += n;

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, topCount))
    .map(([value, n]) => ({ value, count: n }));

  return { kind: "text", count, nulls, unique: counts.size, top };
}

export function computeFieldStats(
  rows: ChartRow[],
  key: string,
  topCount: number = DEFAULT_TOP_VALUES
): FieldStats | null {
  let numeric = 0;
  let populated = 0;
  for (const row of rows) {
    const raw = row.properties[key];
    if (raw === null || raw === undefined || raw === "") continue;
    populated += 1;
    if (isNumericFieldValue(raw)) numeric += 1;
  }
  const isNumeric = numeric >= 2 && numeric >= populated / 2;
  if (!isNumeric) return computeTextStats(rows, key, topCount);

  const values: number[] = [];
  let nulls = 0;
  let nonNumeric = 0;
  for (const row of rows) {
    const raw = row.properties[key];
    if (isBlank(raw)) {
      nulls += 1;
      continue;
    }
    if (isNumericFieldValue(raw)) values.push(raw);
    else nonNumeric += 1;
  }
  return computeNumericStats(values, nulls, nonNumeric);
}

export function formatStatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toLocaleString();
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e9)) return value.toExponential(3);
  return parseFloat(value.toFixed(4)).toLocaleString(undefined, {
    maximumFractionDigits: 4
  });
}

export type StatsScope = "all" | "filtered" | "selected";

export interface StatsScopeAvailability {
  hasFilter: boolean;
  hasSelection: boolean;
}

export function statsScopeAvailability(
  rows: ChartRow[],
  filteredRows: ChartRow[],
  selectedRows: ChartRow[]
): StatsScopeAvailability {
  const filteredMatchesSelection =
    selectedRows.length > 0 &&
    filteredRows.length === selectedRows.length &&
    filteredRows.every((row, index) => row === selectedRows[index]);
  return {
    hasFilter: filteredRows.length !== rows.length && !filteredMatchesSelection,
    hasSelection: selectedRows.length > 0 && selectedRows.length !== rows.length
  };
}

export function resolveStatsScope(
  scope: StatsScope,
  { hasFilter, hasSelection }: StatsScopeAvailability
): StatsScope {
  if (scope === "filtered")
    return hasFilter ? "filtered" : hasSelection ? "selected" : "all";
  if (scope === "selected")
    return hasSelection ? "selected" : hasFilter ? "filtered" : "all";
  return "all";
}
