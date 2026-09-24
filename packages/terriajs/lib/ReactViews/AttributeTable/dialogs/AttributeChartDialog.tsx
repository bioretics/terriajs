import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Button from "../../../Styled/Button";
import {
  BarAggregation,
  categoricalColumns,
  ChartType,
  coerceNumericStringRows,
  computeBar,
  computeBox,
  computeHistogram,
  computeLine,
  computePie,
  computeScatter,
  DEFAULT_HISTOGRAM_BINS,
  numericColumns,
  numericValues
} from "../attributeCharts";
import AttributeTableController from "../AttributeTableController";
import Styles from "../attribute-table.scss";

const COLORS = [
  "#63b598",
  "#ce7d78",
  "#ea9e70",
  "#0d5ac1",
  "#4ca2f9",
  "#a4e43f",
  "#f2510e",
  "#61da5e"
];

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
  onAddToDashboard?: (spec: {
    type: ChartType;
    field?: string;
    fieldY?: string;
    categoryField?: string;
    aggregation?: BarAggregation;
    bins?: number;
    title: string;
  }) => void;
}

const AttributeChartDialog: React.FC<Props> = observer(
  function AttributeChartDialog({ controller, onClose, onAddToDashboard }) {
    const { t } = useTranslation();
    const rows = useMemo(
      () => coerceNumericStringRows(controller.displayRows),
      [controller.displayRows]
    );
    const keys = controller.visibleColumns.map((c) => c.key);
    const numeric = numericColumns(rows, keys);
    const categorical = categoricalColumns(rows, keys);

    const [chartType, setChartType] = useState<ChartType>("histogram");
    const [field, setField] = useState(numeric[0] ?? keys[0] ?? "");
    const [fieldY, setFieldY] = useState(numeric[1] ?? numeric[0] ?? "");
    const [categoryField, setCategoryField] = useState(
      categorical[0] ?? keys[0] ?? ""
    );
    const [aggregation, setAggregation] = useState<BarAggregation>("count");
    const [bins, setBins] = useState(DEFAULT_HISTOGRAM_BINS);

    const chartBody = (() => {
      if (chartType === "histogram" && field) {
        const result = computeHistogram(numericValues(rows, field), bins);
        if (!result) return <p>No data</p>;
        const data = result.bins.map((b, i) => ({
          name: `${b.x0.toFixed(2)}–${b.x1.toFixed(2)}`,
          count: b.count,
          i
        }));
        return (
          <div className={Styles.chartPreview}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chartType === "scatter" && field && fieldY) {
        const result = computeScatter(rows, field, fieldY);
        if (!result) return <p>No data</p>;
        return (
          <div className={Styles.chartPreview}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid />
                <XAxis type="number" dataKey="x" name={field} />
                <YAxis type="number" dataKey="y" name={fieldY} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={result.points} fill={COLORS[1]} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chartType === "bar" && categoryField) {
        const result = computeBar(
          rows,
          categoryField,
          aggregation,
          aggregation === "count" ? null : field
        );
        if (!result) return <p>No data</p>;
        return (
          <div className={Styles.chartPreview}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.bars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chartType === "pie" && categoryField) {
        const result = computePie(
          rows,
          categoryField,
          aggregation,
          aggregation === "count" ? null : field
        );
        if (!result) return <p>No data</p>;
        return (
          <div className={Styles.chartPreview}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={result.slices}
                  dataKey="value"
                  nameKey="label"
                  outerRadius={100}
                  label
                >
                  {result.slices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chartType === "line" && field) {
        const result = computeLine(rows, field);
        if (!result) return <p>No data</p>;
        return (
          <div className={Styles.chartPreview}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={COLORS[3]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }
      if (chartType === "box" && field) {
        const result = computeBox(numericValues(rows, field));
        if (!result) return <p>No data</p>;
        return (
          <ul>
            <li>Min: {result.min}</li>
            <li>Q1: {result.q1}</li>
            <li>Median: {result.median}</li>
            <li>Q3: {result.q3}</li>
            <li>Max: {result.max}</li>
            <li>Count: {result.count}</li>
          </ul>
        );
      }
      return <p>Select chart options</p>;
    })();

    return (
      <div
        className={Styles.dialogBackdrop}
        role="presentation"
        onClick={onClose}
      >
        <div
          className={Styles.dialog}
          role="dialog"
          aria-label={t(($) => $.attributeTable.charts)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={Styles.dialogHeader}>
            <h3>{t(($) => $.attributeTable.charts)}</h3>
          </div>
          <div className={Styles.dialogBody}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <label>
                Type{" "}
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartType)}
                >
                  <option value="histogram">Histogram</option>
                  <option value="scatter">Scatter</option>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="box">Box</option>
                  <option value="pie">Pie</option>
                </select>
              </label>
              {(chartType === "histogram" ||
                chartType === "line" ||
                chartType === "box" ||
                chartType === "scatter" ||
                ((chartType === "bar" || chartType === "pie") &&
                  aggregation !== "count")) && (
                <label>
                  Field{" "}
                  <select
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                  >
                    {(numeric.length ? numeric : keys).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {chartType === "scatter" && (
                <label>
                  Y{" "}
                  <select
                    value={fieldY}
                    onChange={(e) => setFieldY(e.target.value)}
                  >
                    {(numeric.length ? numeric : keys).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(chartType === "bar" || chartType === "pie") && (
                <>
                  <label>
                    Category{" "}
                    <select
                      value={categoryField}
                      onChange={(e) => setCategoryField(e.target.value)}
                    >
                      {(categorical.length ? categorical : keys).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Aggregation{" "}
                    <select
                      value={aggregation}
                      onChange={(e) =>
                        setAggregation(e.target.value as BarAggregation)
                      }
                    >
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="mean">Mean</option>
                    </select>
                  </label>
                </>
              )}
              {chartType === "histogram" && (
                <label>
                  Bins{" "}
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={bins}
                    onChange={(e) => setBins(Number(e.target.value) || 10)}
                  />
                </label>
              )}
            </div>
            {chartBody}
          </div>
          <div className={Styles.dialogActions}>
            {onAddToDashboard && (
              <Button
                type="button"
                onClick={() =>
                  onAddToDashboard({
                    type: chartType,
                    field,
                    fieldY,
                    categoryField,
                    aggregation,
                    bins,
                    title: `${chartType}: ${field || categoryField}`
                  })
                }
              >
                {t(($) => $.attributeTable.addToDashboard)}
              </Button>
            )}
            <Button primary type="button" onClick={onClose}>
              {t(($) => $.attributeTable.close)}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default AttributeChartDialog;
