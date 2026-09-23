import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Button from "../../Styled/Button";
import {
  categoricalColumns,
  coerceNumericStringRows,
  computeBar,
  computeHistogram,
  computePie,
  distinctCategoryValues,
  numericColumns,
  numericValues
} from "./attributeCharts";
import {
  ChartDashboardWidget,
  SelectorDashboardWidget
} from "./attributeDashboard";
import AttributeTableController from "./AttributeTableController";
import Styles from "./attribute-table.scss";

const COLORS = [
  "#63b598",
  "#ce7d78",
  "#ea9e70",
  "#0d5ac1",
  "#4ca2f9",
  "#a4e43f"
];

interface Props {
  controller: AttributeTableController;
}

const AttributeDashboard: React.FC<Props> = observer(
  function AttributeDashboard({ controller }) {
    const { t } = useTranslation();
    const rows = useMemo(
      () => coerceNumericStringRows(controller.dashboardFilteredRows),
      [controller.dashboardFilteredRows]
    );
    const keys = controller.visibleColumns.map((c) => c.key);
    const [selectorField, setSelectorField] = useState(
      categoricalColumns(rows, keys)[0] ?? keys[0] ?? ""
    );

    const addSelector = () => {
      if (!selectorField) return;
      controller.addDashboardWidget({
        type: "selector",
        title: `Filter: ${selectorField}`,
        field: selectorField,
        selectedValues: []
      });
    };

    if (controller.dashboard.widgets.length === 0) {
      return (
        <div className={Styles.emptyState}>
          <p>{t(($) => $.attributeTable.dashboardEmpty)}</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <select
              value={selectorField}
              onChange={(e) => setSelectorField(e.target.value)}
            >
              {keys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <Button primary type="button" onClick={addSelector}>
              {t(($) => $.attributeTable.addSelector)}
            </Button>
            <Button
              type="button"
              onClick={() => controller.setActiveTab("table")}
            >
              {t(($) => $.attributeTable.backToTable)}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0
        }}
      >
        <div className={Styles.toolbar}>
          <select
            value={selectorField}
            onChange={(e) => setSelectorField(e.target.value)}
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Button type="button" onClick={addSelector}>
            {t(($) => $.attributeTable.addSelector)}
          </Button>
          <Button
            type="button"
            onClick={() => controller.setActiveTab("table")}
          >
            {t(($) => $.attributeTable.backToTable)}
          </Button>
          <span className={Styles.toolbarSpacer} />
          <span>
            {controller.dashboardFilteredRows.length} /{" "}
            {controller.baseRows.length} {t(($) => $.attributeTable.records)}
          </span>
        </div>
        <div className={Styles.dashboardGrid}>
          {controller.dashboard.widgets.map((widget) => (
            <div key={widget.id} className={Styles.dashboardWidget}>
              <div className={Styles.dashboardWidgetHeader}>
                <span>{widget.title}</span>
                <Button
                  type="button"
                  onClick={() => controller.removeDashboardWidget(widget.id)}
                >
                  ×
                </Button>
              </div>
              {widget.type === "selector" ? (
                <SelectorWidget
                  widget={widget as SelectorDashboardWidget}
                  rows={rows}
                  onChange={(next) => controller.updateDashboardWidget(next)}
                />
              ) : (
                <ChartWidget
                  widget={widget as ChartDashboardWidget}
                  rows={rows}
                  keys={keys}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

const SelectorWidget: React.FC<{
  widget: SelectorDashboardWidget;
  rows: { properties: Record<string, unknown> }[];
  onChange: (w: SelectorDashboardWidget) => void;
}> = ({ widget, rows, onChange }) => {
  const values = distinctCategoryValues(rows, widget.field);
  const selected = new Set(widget.selectedValues);
  return (
    <div style={{ overflow: "auto", maxHeight: 180 }}>
      {values.map((value) => (
        <label key={value} style={{ display: "block", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={selected.has(value)}
            onChange={() => {
              const next = selected.has(value)
                ? widget.selectedValues.filter((v) => v !== value)
                : [...widget.selectedValues, value];
              onChange({ ...widget, selectedValues: next });
            }}
          />{" "}
          {value}
        </label>
      ))}
    </div>
  );
};

const ChartWidget: React.FC<{
  widget: ChartDashboardWidget;
  rows: { properties: Record<string, unknown> }[];
  keys: string[];
}> = ({ widget, rows, keys }) => {
  if (widget.type === "histogram" && widget.field) {
    const result = computeHistogram(
      numericValues(rows, widget.field),
      widget.bins ?? 10
    );
    if (!result) return <p>No data</p>;
    const data = result.bins.map((b) => ({
      name: `${b.x0.toFixed(1)}`,
      count: b.count
    }));
    return (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <Bar dataKey="count" fill={COLORS[0]} />
          <Tooltip />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (widget.type === "bar" && widget.categoryField) {
    const result = computeBar(
      rows,
      widget.categoryField,
      widget.aggregation ?? "count",
      widget.aggregation === "count" ? null : (widget.field ?? null)
    );
    if (!result) return <p>No data</p>;
    return (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={result.bars}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" hide />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={COLORS[1]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (widget.type === "pie" && widget.categoryField) {
    const result = computePie(
      rows,
      widget.categoryField,
      widget.aggregation ?? "count",
      widget.aggregation === "count" ? null : (widget.field ?? null)
    );
    if (!result) return <p>No data</p>;
    return (
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={result.slices}
            dataKey="value"
            nameKey="label"
            outerRadius={60}
          >
            {result.slices.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  // Fallback: show numeric field histogram if possible
  const numeric = numericColumns(rows, keys);
  if (numeric[0]) {
    const result = computeHistogram(numericValues(rows, numeric[0]), 10);
    if (result) {
      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={result.bins.map((b) => ({
              name: String(b.x0),
              count: b.count
            }))}
          >
            <Bar dataKey="count" fill={COLORS[2]} />
            <Tooltip />
          </BarChart>
        </ResponsiveContainer>
      );
    }
  }
  return <p>Unsupported widget</p>;
};

export default AttributeDashboard;
