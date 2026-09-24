import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styled, { useTheme } from "styled-components";
import {
  formatAxisValue,
  type BarAggregation,
  type BarResult,
  type BoxResult,
  type HistogramResult,
  type LineResult,
  type PieResult,
  type ScatterResult
} from "./attributeCharts";
import { type ChartResult } from "./chartSpec";

/** The SVG the charts are drawn into; it scales to its container. */
export const CHART_W = 560;
export const CHART_H = 300;
const MARGIN = { top: 16, right: 16, bottom: 52, left: 52 };
const INNER_W = CHART_W - MARGIN.left - MARGIN.right;
const INNER_H = CHART_H - MARGIN.top - MARGIN.bottom;

/**
 * Categorical palette for charts whose marks are distinct categories (bar,
 * pie). Fixed hues rather than theme colors, so each category reads as its own
 * color instead of as a shade of the map's accent.
 */
export const CHART_PALETTE = [
  "#3fb1ce",
  "#f4a259",
  "#8b5cf6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#0ea5e9",
  "#ec4899"
];

/** The palette color for the category at `index`, cycling when it overflows. */
function paletteColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

const Caption = styled.p`
  margin: 4px 0 0;
  text-align: center;
  font-size: 12px;
  color: ${(p) => p.theme.textDark};
`;

const Empty = styled.p`
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textDark};
`;

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
`;

/** Map a value within [min, max] to a 0..1 fraction, centering a flat range. */
function fraction(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Colors the chart marks take from the theme (the dialog is light). */
interface ChartColors {
  axis: string;
  tick: string;
  series: string;
}

function useChartColors(): ChartColors {
  const theme = useTheme();
  return {
    axis: theme.greyLighter,
    tick: theme.textDark,
    series: theme.colorPrimary
  };
}

function tickText(
  x: number,
  y: number,
  text: string,
  anchor: "start" | "middle" | "end",
  fill: string,
  baseline: "middle" | "auto" = "auto"
) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline={baseline}
      fontSize={10}
      fill={fill}
    >
      {text}
    </text>
  );
}

function axisTitle(text: string, fill: string) {
  return (
    <text
      x={MARGIN.left + INNER_W / 2}
      y={CHART_H - 4}
      textAnchor="middle"
      fontSize={11}
      fill={fill}
    >
      {text}
    </text>
  );
}

function yAxisTitle(text: string, fill: string) {
  const cy = MARGIN.top + INNER_H / 2;
  return (
    <text
      x={12}
      y={cy}
      textAnchor="middle"
      fontSize={11}
      fill={fill}
      transform={`rotate(-90 12 ${cy})`}
    >
      {text}
    </text>
  );
}

function ChartFrame(props: {
  label: string;
  axis: string;
  children: ReactNode;
}) {
  return (
    <Svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      role="img"
      aria-label={props.label}
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1={MARGIN.left}
        y1={MARGIN.top}
        x2={MARGIN.left}
        y2={MARGIN.top + INNER_H}
        stroke={props.axis}
      />
      <line
        x1={MARGIN.left}
        y1={MARGIN.top + INNER_H}
        x2={MARGIN.left + INNER_W}
        y2={MARGIN.top + INNER_H}
        stroke={props.axis}
      />
      {props.children}
    </Svg>
  );
}

/**
 * Draw a computed {@link ChartResult} as an inline SVG with a caption. No
 * charting library: the shapes are few and the axes are deliberately minimal
 * (the extremes of each scale), which keeps the dialog light and the output
 * identical in every browser.
 */
export function AttributeChartView({ result }: { result: ChartResult }) {
  switch (result.type) {
    case "histogram":
      return <HistogramChart result={result.result} field={result.field} />;
    case "scatter":
      return (
        <ScatterChart
          result={result.result}
          xField={result.xField}
          yField={result.yField}
        />
      );
    case "bar":
      return (
        <BarChart
          result={result.result}
          aggregation={result.aggregation}
          category={result.category}
        />
      );
    case "line":
      return <LineChart result={result.result} field={result.field} />;
    case "box":
      return <BoxChart result={result.result} field={result.field} />;
    case "pie":
      return (
        <PieChart
          result={result.result}
          aggregation={result.aggregation}
          category={result.category}
        />
      );
  }
}

function HistogramChart(props: {
  result: HistogramResult | undefined;
  field: string;
}) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, field } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyNumeric)}</Empty>;

  const { bins, maxCount, min, max, total } = result;
  const slot = INNER_W / bins.length;
  const gap = Math.min(4, slot * 0.15);

  return (
    <>
      <ChartFrame
        axis={colors.axis}
        label={t(($) => $.attributeTable.chart.ariaHistogram, { field })}
      >
        {tickText(
          MARGIN.left - 6,
          MARGIN.top + INNER_H,
          "0",
          "end",
          colors.tick,
          "middle"
        )}
        {tickText(
          MARGIN.left - 6,
          MARGIN.top,
          String(maxCount),
          "end",
          colors.tick,
          "middle"
        )}
        {bins.map((bin, index) => {
          const height = maxCount === 0 ? 0 : (bin.count / maxCount) * INNER_H;
          return (
            <rect
              key={index}
              x={MARGIN.left + index * slot + gap / 2}
              y={MARGIN.top + INNER_H - height}
              width={Math.max(1, slot - gap)}
              height={height}
              fill={colors.series}
              opacity={0.85}
            >
              <title>{`[${formatAxisValue(bin.x0)}, ${formatAxisValue(bin.x1)}${
                index === bins.length - 1 ? "]" : ")"
              }: ${bin.count}`}</title>
            </rect>
          );
        })}
        {/* A collapsed (min === max) histogram spans the full width, so show a
            single centred label instead of identical min/max labels. */}
        {min === max ? (
          tickText(
            MARGIN.left + INNER_W / 2,
            MARGIN.top + INNER_H + 14,
            formatAxisValue(min),
            "middle",
            colors.tick
          )
        ) : (
          <>
            {tickText(
              MARGIN.left,
              MARGIN.top + INNER_H + 14,
              formatAxisValue(min),
              "start",
              colors.tick
            )}
            {tickText(
              MARGIN.left + INNER_W,
              MARGIN.top + INNER_H + 14,
              formatAxisValue(max),
              "end",
              colors.tick
            )}
          </>
        )}
        {axisTitle(field, colors.tick)}
      </ChartFrame>
      <Caption>
        {t(($) => $.attributeTable.chart.captionHistogram, { count: total })}
      </Caption>
    </>
  );
}

function ScatterChart(props: {
  result: ScatterResult | undefined;
  xField: string;
  yField: string;
}) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, xField, yField } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyScatter)}</Empty>;

  const { points, total, xMin, xMax, yMin, yMax } = result;
  const sampled = total > points.length;

  return (
    <>
      <ChartFrame
        axis={colors.axis}
        label={t(($) => $.attributeTable.chart.ariaScatter, { xField, yField })}
      >
        {/* A single centred tick when an axis is flat (every value identical),
            rather than the same number at both ends. */}
        {yMin === yMax ? (
          tickText(
            MARGIN.left - 6,
            MARGIN.top + INNER_H / 2,
            formatAxisValue(yMin),
            "end",
            colors.tick,
            "middle"
          )
        ) : (
          <>
            {tickText(
              MARGIN.left - 6,
              MARGIN.top,
              formatAxisValue(yMax),
              "end",
              colors.tick,
              "middle"
            )}
            {tickText(
              MARGIN.left - 6,
              MARGIN.top + INNER_H,
              formatAxisValue(yMin),
              "end",
              colors.tick,
              "middle"
            )}
          </>
        )}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={MARGIN.left + fraction(point.x, xMin, xMax) * INNER_W}
            cy={MARGIN.top + INNER_H - fraction(point.y, yMin, yMax) * INNER_H}
            r={3}
            fill={colors.series}
            opacity={0.6}
          >
            <title>{`${xField}: ${formatAxisValue(
              point.x
            )}, ${yField}: ${formatAxisValue(point.y)}`}</title>
          </circle>
        ))}
        {xMin === xMax ? (
          tickText(
            MARGIN.left + INNER_W / 2,
            MARGIN.top + INNER_H + 14,
            formatAxisValue(xMin),
            "middle",
            colors.tick
          )
        ) : (
          <>
            {tickText(
              MARGIN.left,
              MARGIN.top + INNER_H + 14,
              formatAxisValue(xMin),
              "start",
              colors.tick
            )}
            {tickText(
              MARGIN.left + INNER_W,
              MARGIN.top + INNER_H + 14,
              formatAxisValue(xMax),
              "end",
              colors.tick
            )}
          </>
        )}
        {axisTitle(xField, colors.tick)}
        {yAxisTitle(yField, colors.tick)}
      </ChartFrame>
      <Caption>
        {t(($) => $.attributeTable.chart.captionScatter, { count: total })}
        {sampled
          ? ` · ${t(($) => $.attributeTable.chart.captionSampled, {
              count: points.length
            })}`
          : ""}
      </Caption>
    </>
  );
}

function BarChart(props: {
  result: BarResult | undefined;
  aggregation: BarAggregation;
  category: string;
}) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, aggregation, category } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyBar)}</Empty>;

  const { bars, maxValue, minValue, truncated } = result;
  const domainMin = Math.min(0, minValue);
  // Keep 0 as the top of the scale when every bar is <= 0 (possible for
  // sum/mean); only fall back to 1 when the domain would otherwise have no
  // width at all (every bar exactly 0).
  const domainMax = maxValue > 0 ? maxValue : minValue < 0 ? 0 : 1;
  const slot = INNER_W / bars.length;
  const gap = Math.min(6, slot * 0.2);
  const scaleY = (value: number) =>
    MARGIN.top + INNER_H - fraction(value, domainMin, domainMax) * INNER_H;
  const baselineY = scaleY(0);

  return (
    <>
      <ChartFrame
        axis={colors.axis}
        label={t(($) => $.attributeTable.chart.ariaBar, { category })}
      >
        {domainMax > 0
          ? tickText(
              MARGIN.left - 6,
              MARGIN.top,
              formatAxisValue(domainMax),
              "end",
              colors.tick,
              "middle"
            )
          : null}
        {tickText(
          MARGIN.left - 6,
          baselineY,
          "0",
          "end",
          colors.tick,
          "middle"
        )}
        {minValue < 0
          ? tickText(
              MARGIN.left - 6,
              MARGIN.top + INNER_H,
              formatAxisValue(domainMin),
              "end",
              colors.tick,
              "middle"
            )
          : null}
        {bars.map((datum, index) => {
          const top = Math.min(baselineY, scaleY(datum.value));
          const height = Math.abs(scaleY(datum.value) - baselineY);
          const cx = MARGIN.left + index * slot + slot / 2;
          return (
            <g key={datum.label}>
              <rect
                x={MARGIN.left + index * slot + gap / 2}
                y={top}
                width={Math.max(1, slot - gap)}
                height={Math.max(0, height)}
                fill={paletteColor(index)}
                opacity={0.9}
              >
                <title>{`${datum.label}: ${formatAxisValue(datum.value)} (${
                  datum.count
                })`}</title>
              </rect>
              <text
                x={cx}
                y={MARGIN.top + INNER_H + 12}
                textAnchor="end"
                fontSize={9}
                fill={colors.tick}
                transform={`rotate(-40 ${cx} ${MARGIN.top + INNER_H + 12})`}
              >
                {truncateLabel(datum.label)}
              </text>
            </g>
          );
        })}
      </ChartFrame>
      <Caption>
        {aggregation === "count"
          ? t(($) => $.attributeTable.chart.captionBar.count)
          : aggregation === "sum"
            ? t(($) => $.attributeTable.chart.captionBar.sum)
            : t(($) => $.attributeTable.chart.captionBar.mean)}
        {truncated > 0
          ? ` · ${t(($) => $.attributeTable.chart.captionTruncated, {
              shown: bars.length,
              hidden: truncated
            })}`
          : ""}
      </Caption>
    </>
  );
}

function LineChart(props: { result: LineResult | undefined; field: string }) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, field } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyNumeric)}</Empty>;

  const { points, min, max, length } = result;
  const scaleX = (index: number) =>
    MARGIN.left + (length > 1 ? index / (length - 1) : 0.5) * INNER_W;
  const scaleY = (value: number) =>
    MARGIN.top + INNER_H - fraction(value, min, max) * INNER_H;
  const path = points
    .map((point, index) => {
      // Break the line when rows are non-consecutive, so features with no value
      // show as a gap rather than as a straight segment across them.
      const command =
        index === 0 || point.index !== points[index - 1].index + 1 ? "M" : "L";
      return `${command}${scaleX(point.index)} ${scaleY(point.value)}`;
    })
    .join(" ");

  return (
    <>
      <ChartFrame
        axis={colors.axis}
        label={t(($) => $.attributeTable.chart.ariaLine, { field })}
      >
        {tickText(
          MARGIN.left - 6,
          MARGIN.top,
          formatAxisValue(max),
          "end",
          colors.tick,
          "middle"
        )}
        {tickText(
          MARGIN.left - 6,
          MARGIN.top + INNER_H,
          formatAxisValue(min),
          "end",
          colors.tick,
          "middle"
        )}
        <path d={path} fill="none" stroke={colors.series} strokeWidth={1.5} />
        {points.length <= 80
          ? points.map((point) => (
              <circle
                key={point.index}
                cx={scaleX(point.index)}
                cy={scaleY(point.value)}
                r={2}
                fill={colors.series}
              >
                <title>{`#${point.index}: ${formatAxisValue(
                  point.value
                )}`}</title>
              </circle>
            ))
          : null}
        {length <= 1 ? (
          tickText(
            MARGIN.left + INNER_W / 2,
            MARGIN.top + INNER_H + 14,
            "0",
            "middle",
            colors.tick
          )
        ) : (
          <>
            {tickText(
              MARGIN.left,
              MARGIN.top + INNER_H + 14,
              "0",
              "start",
              colors.tick
            )}
            {tickText(
              MARGIN.left + INNER_W,
              MARGIN.top + INNER_H + 14,
              String(length - 1),
              "end",
              colors.tick
            )}
          </>
        )}
        {axisTitle(
          t(($) => $.attributeTable.chart.featureOrder),
          colors.tick
        )}
      </ChartFrame>
      <Caption>
        {t(($) => $.attributeTable.chart.captionLine, {
          count: points.length,
          field
        })}
      </Caption>
    </>
  );
}

function BoxChart(props: { result: BoxResult | undefined; field: string }) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, field } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyNumeric)}</Empty>;

  const { min, q1, median, q3, max, count } = result;
  const centerX = MARGIN.left + INNER_W / 2;
  const boxWidth = 96;
  const scaleY = (value: number) =>
    MARGIN.top + INNER_H - fraction(value, min, max) * INNER_H;

  const stats: [string, number][] = [
    [t(($) => $.attributeTable.stat.max), max],
    ["Q3", q3],
    [t(($) => $.attributeTable.stat.median), median],
    ["Q1", q1],
    [t(($) => $.attributeTable.stat.min), min]
  ];

  return (
    <>
      <ChartFrame
        axis={colors.axis}
        label={t(($) => $.attributeTable.chart.ariaBox, { field })}
      >
        <line
          x1={centerX}
          y1={scaleY(min)}
          x2={centerX}
          y2={scaleY(max)}
          stroke={colors.axis}
        />
        <line
          x1={centerX - 20}
          y1={scaleY(max)}
          x2={centerX + 20}
          y2={scaleY(max)}
          stroke={colors.axis}
        />
        <line
          x1={centerX - 20}
          y1={scaleY(min)}
          x2={centerX + 20}
          y2={scaleY(min)}
          stroke={colors.axis}
        />
        <rect
          x={centerX - boxWidth / 2}
          y={scaleY(q3)}
          width={boxWidth}
          height={Math.max(1, scaleY(q1) - scaleY(q3))}
          fill={colors.series}
          opacity={0.25}
          stroke={colors.series}
        />
        <line
          x1={centerX - boxWidth / 2}
          y1={scaleY(median)}
          x2={centerX + boxWidth / 2}
          y2={scaleY(median)}
          stroke={colors.series}
          strokeWidth={2}
        />
        {/* When every value is identical the five statistics share one y
            position; show a single label instead of five overlapping ones. */}
        {min === max
          ? tickText(
              centerX + boxWidth / 2 + 8,
              scaleY(median),
              formatAxisValue(median),
              "start",
              colors.tick,
              "middle"
            )
          : stats.map(([label, value]) => (
              <text
                key={label}
                x={centerX + boxWidth / 2 + 8}
                y={scaleY(value)}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={10}
                fill={colors.tick}
              >
                {`${label} ${formatAxisValue(value)}`}
              </text>
            ))}
        {axisTitle(field, colors.tick)}
      </ChartFrame>
      <Caption>
        {t(($) => $.attributeTable.chart.captionBox, { count })}
      </Caption>
    </>
  );
}

function PieChart(props: {
  result: PieResult | undefined;
  aggregation: BarAggregation;
  category: string;
}) {
  const { t } = useTranslation();
  const colors = useChartColors();
  const { result, aggregation, category } = props;
  if (!result)
    return <Empty>{t(($) => $.attributeTable.chart.emptyPie)}</Empty>;

  const { slices, total } = result;
  const radius = INNER_H / 2 - 6;
  const cx = MARGIN.left + radius;
  const cy = MARGIN.top + INNER_H / 2;
  const legendX = cx + radius + 24;
  const legendStep = Math.min(22, INNER_H / Math.max(slices.length, 1));

  // Slice angles run from the top (12 o'clock) clockwise. Each start angle
  // comes from the prefix sum of the previous slices, so this stays a pure map
  // over a handful of slices.
  const start0 = -Math.PI / 2;
  const arcs = slices.map((slice, index) => {
    const share = slice.value / total;
    const prior = slices
      .slice(0, index)
      .reduce((sum, previous) => sum + previous.value, 0);
    const start = start0 + (prior / total) * Math.PI * 2;
    const end = start + share * Math.PI * 2;
    const x0 = cx + radius * Math.cos(start);
    const y0 = cy + radius * Math.sin(start);
    const x1 = cx + radius * Math.cos(end);
    const y1 = cy + radius * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    // A lone slice is a full circle, which a single arc cannot express; draw it
    // as two half-circle arcs instead.
    const d =
      slices.length === 1
        ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${
            cx + radius
          } ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} Z`
        : `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    return { d, color: paletteColor(index), slice, share };
  });

  return (
    <>
      <Svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={t(($) => $.attributeTable.chart.ariaPie, { category })}
        preserveAspectRatio="xMidYMid meet"
      >
        {arcs.map(({ d, color, slice }) => (
          <path
            key={slice.label}
            d={d}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
          >
            <title>{`${slice.label}: ${formatAxisValue(
              slice.value
            )} (${Math.round((slice.value / total) * 100)}%)`}</title>
          </path>
        ))}
        {arcs.map(({ color, slice, share }, index) => {
          const y = MARGIN.top + index * legendStep;
          return (
            <g key={`legend-${slice.label}`}>
              <rect
                x={legendX}
                y={y}
                width={10}
                height={10}
                rx={2}
                fill={color}
              />
              <text
                x={legendX + 16}
                y={y + 5}
                dominantBaseline="middle"
                fontSize={11}
                fill={colors.tick}
              >
                {`${truncateLabel(slice.label, 18)} · ${Math.round(
                  share * 100
                )}%`}
              </text>
            </g>
          );
        })}
      </Svg>
      <Caption>
        {aggregation === "count"
          ? t(($) => $.attributeTable.chart.captionPieCount, {
              count: slices.length
            })
          : t(($) => $.attributeTable.chart.captionPieSum, {
              count: slices.length
            })}
      </Caption>
    </>
  );
}

export default AttributeChartView;
