import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import AttributeChartView from "./AttributeChartView";
import {
  ChartDashboardWidget,
  SelectorDashboardWidget,
  widgetToChartSpec
} from "./attributeDashboard";
import {
  categoricalColumns,
  coerceNumericStringRows,
  distinctCategoryValues,
  type ChartRow
} from "./attributeCharts";
import { computeChart } from "./chartSpec";
import AttributeTableController from "./AttributeTableController";
import { PanelButton, PanelSelect } from "./AttributeTableStyles";
import Styles from "./attribute-table.scss";

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
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap"
            }}
          >
            <PanelSelect
              value={selectorField}
              onChange={(e) => setSelectorField(e.target.value)}
            >
              {keys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </PanelSelect>
            <PanelButton type="button" onClick={addSelector}>
              {t(($) => $.attributeTable.addSelector)}
            </PanelButton>
            <PanelButton
              type="button"
              onClick={() => controller.setActiveTab("table")}
            >
              {t(($) => $.attributeTable.backToTable)}
            </PanelButton>
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
          <PanelSelect
            value={selectorField}
            onChange={(e) => setSelectorField(e.target.value)}
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </PanelSelect>
          <PanelButton type="button" onClick={addSelector}>
            {t(($) => $.attributeTable.addSelector)}
          </PanelButton>
          <PanelButton
            type="button"
            onClick={() => controller.setActiveTab("table")}
          >
            {t(($) => $.attributeTable.backToTable)}
          </PanelButton>
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
                <PanelButton
                  type="button"
                  onClick={() => controller.removeDashboardWidget(widget.id)}
                  aria-label={t(($) => $.general.close)}
                >
                  ×
                </PanelButton>
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
  rows: ChartRow[];
  onChange: (w: SelectorDashboardWidget) => void;
}> = ({ widget, rows, onChange }) => {
  const values = distinctCategoryValues(rows, widget.field);
  const selected = new Set(widget.selectedValues);
  return (
    <div style={{ overflow: "auto", maxHeight: 180, fontSize: 13 }}>
      {values.map((value) => (
        <label key={value} style={{ display: "block" }}>
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
  rows: ChartRow[];
}> = ({ widget, rows }) => {
  const spec = widgetToChartSpec(widget);
  const result = useMemo(
    () => (spec ? computeChart(rows, spec) : undefined),
    [rows, spec]
  );
  if (!result) {
    return <p style={{ opacity: 0.7, fontSize: 12 }}>No data</p>;
  }
  return (
    <div className={Styles.dashboardChartWrap}>
      <AttributeChartView result={result} />
    </div>
  );
};

export default AttributeDashboard;
