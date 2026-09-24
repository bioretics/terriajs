/**
 * Pure chart-data helpers for the Attribute Table (ported from GeoLibre).
 */

export type ChartType =
  | "histogram"
  | "scatter"
  | "bar"
  | "line"
  | "box"
  | "pie";

export interface ChartRow {
  properties: Record<string, unknown>;
}

export const MIN_HISTOGRAM_BINS = 1;
export const MAX_HISTOGRAM_BINS = 50;
export const DEFAULT_HISTOGRAM_BINS = 10;
export const MAX_CATEGORY_CARDINALITY = 50;
export const MAX_BAR_CATEGORIES = 20;
export const MAX_PIE_SLICES = 8;
export const MAX_SCATTER_POINTS = 2000;

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const next = Number(trimmed);
    return Number.isFinite(next) ? next : null;
  }
  return null;
}

export function isNumericFieldValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasLeadingZeroes(value: string): boolean {
  return /^[+-]?0\d+$/.test(value.trim());
}

function isIdentifierFieldName(key: string): boolean {
  const normalized = key.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
  if (
    /(^|[\s_-])(id|fid|code|fips|zip|zipcode|postal)([\s_-]|$)/.test(normalized)
  ) {
    return true;
  }
  const compact = normalized.replace(/[\s_-]/g, "");
  return (
    /^(geo|object|feature|row)id\d*$/.test(compact) ||
    /^(state|county|place)fp\d*$/.test(compact) ||
    /^(tract|block)ce\d*$/.test(compact)
  );
}

export function coerceNumericStringRows(rows: ChartRow[]): ChartRow[] {
  const textKeys = new Set<string>();
  const populatedCounts = new Map<string, number>();
  const numericCounts = new Map<string, number>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.properties)) {
      if (value === null || value === undefined || value === "") continue;
      populatedCounts.set(key, (populatedCounts.get(key) ?? 0) + 1);
      if (
        typeof value === "string" &&
        (isIdentifierFieldName(key) || hasLeadingZeroes(value))
      ) {
        textKeys.add(key);
        continue;
      }
      const countsAsNumeric =
        isNumericFieldValue(value) ||
        (typeof value === "string" && toFiniteNumber(value) !== null);
      if (countsAsNumeric)
        numericCounts.set(key, (numericCounts.get(key) ?? 0) + 1);
    }
  }

  const numericKeys = new Set<string>();
  for (const [key, numeric] of numericCounts) {
    if (textKeys.has(key)) continue;
    if (numeric >= 2 && numeric >= (populatedCounts.get(key) ?? 0) / 2)
      numericKeys.add(key);
  }
  if (numericKeys.size === 0) return rows;

  return rows.map((row) => {
    let properties: Record<string, unknown> | null = null;
    for (const [key, value] of Object.entries(row.properties)) {
      if (!numericKeys.has(key) || typeof value !== "string") continue;
      const numeric = toFiniteNumber(value);
      if (numeric === null) continue;
      properties ??= { ...row.properties };
      properties[key] = numeric;
    }
    return properties ? { ...row, properties } : row;
  });
}

export function pickAnalysisRows(
  analysisRows: ChartRow[],
  sourceRows: { featureId: string }[],
  featureIds: ReadonlySet<string>
): ChartRow[] {
  return analysisRows.filter((_, index) =>
    featureIds.has(sourceRows[index].featureId)
  );
}

export function distinctCategoryValues(
  rows: ChartRow[],
  key: string
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = String(row.properties[key] ?? "");
    if (value.trim() !== "") values.add(value);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export interface CategorySelection {
  field: string;
  values: string[];
}

export function filterRowsBySelections(
  rows: ChartRow[],
  selections: CategorySelection[]
): ChartRow[] {
  const active = selections.filter((s) => s.values.length > 0);
  if (active.length === 0) return rows;
  const matchers = active.map((selection) => ({
    field: selection.field,
    values: new Set(selection.values)
  }));
  return rows.filter((row) =>
    matchers.every((matcher) =>
      matcher.values.has(String(row.properties[matcher.field] ?? ""))
    )
  );
}

export function numericColumns(rows: ChartRow[], columns: string[]): string[] {
  return columns.filter((key) => {
    let numeric = 0;
    let nonNull = 0;
    for (const row of rows) {
      const raw = row.properties[key];
      if (raw === null || raw === undefined || raw === "") continue;
      nonNull += 1;
      if (isNumericFieldValue(raw)) numeric += 1;
    }
    return numeric >= 2 && numeric >= nonNull / 2;
  });
}

export function numericValues(rows: ChartRow[], key: string): number[] {
  const values: number[] = [];
  for (const row of rows) {
    const value = row.properties[key];
    if (isNumericFieldValue(value)) values.push(value);
  }
  return values;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export interface HistogramResult {
  bins: HistogramBin[];
  min: number;
  max: number;
  total: number;
  maxCount: number;
}

export function computeHistogram(
  values: number[],
  binCount: number
): HistogramResult | null {
  if (values.length === 0) return null;

  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (min === max) {
    return {
      bins: [{ x0: min, x1: max, count: values.length }],
      min,
      max,
      total: values.length,
      maxCount: values.length
    };
  }

  const requested = Math.trunc(binCount);
  const count = Number.isFinite(requested)
    ? Math.max(MIN_HISTOGRAM_BINS, Math.min(MAX_HISTOGRAM_BINS, requested))
    : DEFAULT_HISTOGRAM_BINS;
  const width = (max - min) / count;
  const bins: HistogramBin[] = Array.from({ length: count }, (_, i) => ({
    x0: min + i * width,
    x1: i === count - 1 ? max : min + (i + 1) * width,
    count: 0
  }));

  for (const value of values) {
    const index = Math.min(count - 1, Math.floor((value - min) / width));
    bins[index].count += 1;
  }

  let maxCount = 0;
  for (const bin of bins) {
    if (bin.count > maxCount) maxCount = bin.count;
  }

  return { bins, min, max, total: values.length, maxCount };
}

export interface ScatterPoint {
  x: number;
  y: number;
}

export interface ScatterResult {
  points: ScatterPoint[];
  total: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export function computeScatter(
  rows: ChartRow[],
  xKey: string,
  yKey: string,
  maxPoints: number = MAX_SCATTER_POINTS
): ScatterResult | null {
  const all: ScatterPoint[] = [];
  let xMin = 0;
  let xMax = 0;
  let yMin = 0;
  let yMax = 0;
  for (const row of rows) {
    const x = row.properties[xKey];
    const y = row.properties[yKey];
    if (!isNumericFieldValue(x) || !isNumericFieldValue(y)) continue;
    if (all.length === 0) {
      xMin = xMax = x;
      yMin = yMax = y;
    } else {
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    all.push({ x, y });
  }
  if (all.length === 0) return null;

  let points = all;
  if (all.length > maxPoints) {
    const stride = Math.ceil(all.length / maxPoints);
    points = all.filter((_, index) => index % stride === 0);
  }
  return { points, total: all.length, xMin, xMax, yMin, yMax };
}

export function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e7)) {
    return value.toExponential(1);
  }
  if (Number.isInteger(value)) return String(value);
  return parseFloat(value.toFixed(3)).toString();
}

const CATEGORY_ABSOLUTE_LIMIT = 15;
const CATEGORY_RATIO = 0.5;

export function categoricalColumns(
  rows: ChartRow[],
  columns: string[],
  maxCardinality: number = MAX_CATEGORY_CARDINALITY
): string[] {
  return columns.filter((key) => {
    const distinct = new Set<string>();
    let nonNull = 0;
    for (const row of rows) {
      const raw = row.properties[key];
      if (raw === null || raw === undefined || raw === "") continue;
      nonNull += 1;
      distinct.add(String(raw));
      if (distinct.size > maxCardinality) return false;
    }
    if (distinct.size < 1) return false;
    if (nonNull > 1 && distinct.size === nonNull) return false;
    const limit = Math.max(CATEGORY_ABSOLUTE_LIMIT, nonNull * CATEGORY_RATIO);
    return distinct.size <= limit;
  });
}

export function categoryColumnOptions(
  rows: ChartRow[],
  columns: string[]
): string[] {
  const preferred = categoricalColumns(rows, columns);
  if (preferred.length === 0) return columns;
  const preferredSet = new Set(preferred);
  return [...preferred, ...columns.filter((c) => !preferredSet.has(c))];
}

export type BarAggregation = "count" | "sum" | "mean";

export interface BarDatum {
  label: string;
  value: number;
  count: number;
}

export interface BarResult {
  bars: BarDatum[];
  maxValue: number;
  minValue: number;
  truncated: number;
}

export function computeBar(
  rows: ChartRow[],
  categoryKey: string,
  aggregation: BarAggregation,
  valueKey: string | null,
  maxBars: number = MAX_BAR_CATEGORIES
): BarResult | null {
  const groups = new Map<
    string,
    { count: number; sum: number; numericCount: number }
  >();
  for (const row of rows) {
    const raw = row.properties[categoryKey];
    const label =
      raw === null || raw === undefined || raw === "" ? "(blank)" : String(raw);
    const group = groups.get(label) ?? { count: 0, sum: 0, numericCount: 0 };
    group.count += 1;
    if (aggregation !== "count" && valueKey) {
      const value = row.properties[valueKey];
      if (isNumericFieldValue(value)) {
        group.sum += value;
        group.numericCount += 1;
      }
    }
    groups.set(label, group);
  }
  if (groups.size === 0) return null;

  const all: BarDatum[] = [...groups.entries()]
    .filter(([, group]) => aggregation === "count" || group.numericCount > 0)
    .map(([label, group]) => {
      let value = group.count;
      if (aggregation === "sum") value = group.sum;
      else if (aggregation === "mean") value = group.sum / group.numericCount;
      return { label, value, count: group.count };
    });
  if (all.length === 0) return null;
  all.sort((a, b) => b.value - a.value);

  const bars = all.slice(0, Math.max(1, maxBars));
  let maxValue = 0;
  let minValue = 0;
  for (const bar of bars) {
    if (bar.value > maxValue) maxValue = bar.value;
    if (bar.value < minValue) minValue = bar.value;
  }
  return {
    bars,
    maxValue,
    minValue,
    truncated: Math.max(0, all.length - bars.length)
  };
}

export interface PieSlice {
  label: string;
  value: number;
  count: number;
}

export interface PieResult {
  slices: PieSlice[];
  total: number;
  otherCount: number;
}

export function computePie(
  rows: ChartRow[],
  categoryKey: string,
  aggregation: BarAggregation,
  valueKey: string | null,
  maxSlices: number = MAX_PIE_SLICES
): PieResult | null {
  const groups = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    const raw = row.properties[categoryKey];
    const label =
      raw === null || raw === undefined || raw === "" ? "(blank)" : String(raw);
    const group = groups.get(label) ?? { count: 0, sum: 0 };
    group.count += 1;
    if (aggregation !== "count" && valueKey) {
      const value = row.properties[valueKey];
      if (isNumericFieldValue(value)) group.sum += value;
    }
    groups.set(label, group);
  }
  if (groups.size === 0) return null;

  const all = [...groups.entries()]
    .map(([label, group]) => ({
      label,
      value: aggregation === "count" ? group.count : group.sum,
      count: group.count
    }))
    .filter((slice) => slice.value > 0);
  if (all.length === 0) return null;
  all.sort((a, b) => b.value - a.value);

  const limit = Math.max(2, maxSlices);
  let slices: PieSlice[] = all;
  let otherCount = 0;
  if (all.length > limit) {
    const head = all.slice(0, limit - 1);
    const tail = all.slice(limit - 1);
    const otherValue = tail.reduce((sum, slice) => sum + slice.value, 0);
    otherCount = tail.reduce((sum, slice) => sum + slice.count, 0);
    const foldLabel = head.some((slice) => slice.label === "(other)")
      ? "(other categories)"
      : "(other)";
    slices = [
      ...head,
      { label: foldLabel, value: otherValue, count: otherCount }
    ];
  }
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;
  return { slices, total, otherCount };
}

export interface LinePoint {
  index: number;
  value: number;
}

export interface LineResult {
  points: LinePoint[];
  min: number;
  max: number;
  length: number;
}

export function computeLine(rows: ChartRow[], key: string): LineResult | null {
  const points: LinePoint[] = [];
  let min = Infinity;
  let max = -Infinity;
  let index = 0;
  for (const row of rows) {
    const value = row.properties[key];
    if (isNumericFieldValue(value)) {
      points.push({ index, value });
      if (value < min) min = value;
      if (value > max) max = value;
    }
    index += 1;
  }
  if (points.length === 0) return null;
  return { points, min, max, length: rows.length };
}

export interface BoxResult {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined
    ? sorted[base]
    : sorted[base] + rest * (next - sorted[base]);
}

export function computeBox(values: number[]): BoxResult | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    q3: quantileSorted(sorted, 0.75),
    max: sorted[sorted.length - 1],
    count: sorted.length
  };
}
