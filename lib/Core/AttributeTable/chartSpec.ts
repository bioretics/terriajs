/**
 * The chart specification the attribute table's Charts dialog builds, and the
 * dispatch that turns it into a ready-to-draw result. Pure (no React), so the
 * field-level helpers in `attributeCharts` stay the only place that touches
 * data and the drawing stays in `AttributeChartView`.
 */

import {
  computeBar,
  computeBox,
  computeHistogram,
  computeLine,
  computePie,
  computeScatter,
  DEFAULT_HISTOGRAM_BINS,
  numericValues,
  type BarAggregation,
  type BarResult,
  type BoxResult,
  type ChartRow,
  type ChartType,
  type HistogramResult,
  type LineResult,
  type PieResult,
  type ScatterResult
} from "./attributeCharts";

/**
 * A chart type plus the field(s)/options it needs. Which keys apply depends on
 * `type`; unused keys are ignored.
 */
export interface ChartSpec {
  type: ChartType;
  /** Value field for histogram/line/box. */
  field?: string;
  /** X/Y fields for scatter. */
  xField?: string;
  yField?: string;
  /** Histogram bin count. */
  bins?: number;
  /** Category field for bar/pie. */
  category?: string;
  /** Bar/pie aggregation (default `count`). */
  aggregation?: BarAggregation;
  /** Value field a bar's or slice's sum/mean reduces. */
  valueField?: string;
}

/**
 * The computed, ready-to-draw result for each chart type. `result` is undefined
 * when the spec's fields produced nothing to plot (an empty state is shown).
 */
export type ChartResult =
  | { type: "histogram"; result: HistogramResult | undefined; field: string }
  | {
      type: "scatter";
      result: ScatterResult | undefined;
      xField: string;
      yField: string;
    }
  | {
      type: "bar";
      result: BarResult | undefined;
      aggregation: BarAggregation;
      category: string;
    }
  | { type: "line"; result: LineResult | undefined; field: string }
  | { type: "box"; result: BoxResult | undefined; field: string }
  | {
      type: "pie";
      result: PieResult | undefined;
      category: string;
      aggregation: BarAggregation;
    };

/**
 * Compute a chart from `rows` and a {@link ChartSpec}. Returns a typed result
 * whose `result` is undefined when the chosen fields yield nothing to draw.
 *
 * @param rows The attribute rows to chart.
 * @param spec The chart type and field selections.
 * @returns A typed result, ready for the chart view.
 */
export function computeChart(rows: ChartRow[], spec: ChartSpec): ChartResult {
  switch (spec.type) {
    case "histogram": {
      const field = spec.field ?? "";
      return {
        type: "histogram",
        field,
        result: field
          ? computeHistogram(
              numericValues(rows, field),
              spec.bins ?? DEFAULT_HISTOGRAM_BINS
            )
          : undefined
      };
    }
    case "scatter": {
      const xField = spec.xField ?? "";
      const yField = spec.yField ?? "";
      return {
        type: "scatter",
        xField,
        yField,
        result:
          xField && yField ? computeScatter(rows, xField, yField) : undefined
      };
    }
    case "bar": {
      const category = spec.category ?? "";
      const aggregation = spec.aggregation ?? "count";
      return {
        type: "bar",
        category,
        aggregation,
        result: category
          ? computeBar(
              rows,
              category,
              aggregation,
              aggregation === "count" ? undefined : spec.valueField
            )
          : undefined
      };
    }
    case "line": {
      const field = spec.field ?? "";
      return {
        type: "line",
        field,
        result: field ? computeLine(rows, field) : undefined
      };
    }
    case "box": {
      const field = spec.field ?? "";
      return {
        type: "box",
        field,
        result: field ? computeBox(numericValues(rows, field)) : undefined
      };
    }
    case "pie": {
      const category = spec.category ?? "";
      const aggregation = spec.aggregation ?? "count";
      return {
        type: "pie",
        category,
        aggregation,
        result: category
          ? computePie(
              rows,
              category,
              aggregation,
              aggregation === "count" ? undefined : spec.valueField
            )
          : undefined
      };
    }
  }
}

/** Whether a computed chart actually produced something to draw. */
export function chartResultHasData(result: ChartResult): boolean {
  return result.result !== undefined;
}
