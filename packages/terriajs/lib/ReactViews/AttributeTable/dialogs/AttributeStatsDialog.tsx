import React, { useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import Button from "../../../Styled/Button";
import { coerceNumericStringRows, pickAnalysisRows } from "../attributeCharts";
import {
  computeFieldStats,
  formatStatValue,
  resolveStatsScope,
  statsScopeAvailability,
  StatsScope
} from "../attributeStats";
import AttributeTableController from "../AttributeTableController";
import Styles from "../attribute-table.scss";

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
}

const AttributeStatsDialog: React.FC<Props> = observer(
  function AttributeStatsDialog({ controller, onClose }) {
    const { t } = useTranslation();
    const columns = controller.visibleColumns;
    const [field, setField] = useState(columns[0]?.key ?? "");
    const [scope, setScope] = useState<StatsScope>("all");

    const analysisRows = useMemo(
      () => coerceNumericStringRows(controller.baseRows),
      [controller.baseRows]
    );
    const filtered = useMemo(
      () =>
        pickAnalysisRows(
          analysisRows,
          controller.baseRows,
          new Set(controller.searchFilteredRows.map((r) => r.featureId))
        ),
      [analysisRows, controller.baseRows, controller.searchFilteredRows]
    );
    const selected = useMemo(
      () =>
        pickAnalysisRows(
          analysisRows,
          controller.baseRows,
          new Set(controller.selectedIds)
        ),
      [analysisRows, controller.baseRows, controller.selectedIds]
    );

    const availability = statsScopeAvailability(
      analysisRows,
      filtered,
      selected
    );
    const resolved = resolveStatsScope(scope, availability);
    const rowsForStats =
      resolved === "filtered"
        ? filtered
        : resolved === "selected"
          ? selected
          : analysisRows;

    const stats = field ? computeFieldStats(rowsForStats, field) : null;

    const copySummary = () => {
      if (!stats) return;
      const lines =
        stats.kind === "numeric"
          ? [
              `Field: ${field}`,
              `Count: ${stats.count}`,
              `Nulls: ${stats.nulls}`,
              `Unique: ${stats.unique}`,
              `Min: ${formatStatValue(stats.min)}`,
              `Max: ${formatStatValue(stats.max)}`,
              `Mean: ${formatStatValue(stats.mean)}`,
              `Median: ${formatStatValue(stats.median)}`,
              `Std: ${formatStatValue(stats.std)}`,
              `Sum: ${formatStatValue(stats.sum)}`
            ]
          : [
              `Field: ${field}`,
              `Count: ${stats.count}`,
              `Nulls: ${stats.nulls}`,
              `Unique: ${stats.unique}`,
              ...stats.top.map((t) => `${t.value}: ${t.count}`)
            ];
      void navigator.clipboard?.writeText(lines.join("\n"));
    };

    return (
      <div
        className={Styles.dialogBackdrop}
        role="presentation"
        onClick={onClose}
      >
        <div
          className={Styles.dialog}
          role="dialog"
          aria-label={t(($) => $.attributeTable.statistics)}
          onClick={(e) => e.stopPropagation()}
        >
          <h3>{t(($) => $.attributeTable.statistics)}</h3>
          <div className={Styles.dialogBody}>
            <label>
              {t(($) => $.attributeTable.field)}{" "}
              <select value={field} onChange={(e) => setField(e.target.value)}>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              {t(($) => $.attributeTable.scope)}{" "}
              <select
                value={resolved}
                onChange={(e) => setScope(e.target.value as StatsScope)}
              >
                <option value="all">
                  {t(($) => $.attributeTable.scopeAll)}
                </option>
                {availability.hasFilter && (
                  <option value="filtered">
                    {t(($) => $.attributeTable.scopeFiltered)}
                  </option>
                )}
                {availability.hasSelection && (
                  <option value="selected">
                    {t(($) => $.attributeTable.scopeSelected)}
                  </option>
                )}
              </select>
            </label>
            {stats && (
              <div style={{ marginTop: 12 }}>
                {stats.kind === "numeric" ? (
                  <ul>
                    <li>Count: {stats.count}</li>
                    <li>Nulls: {stats.nulls}</li>
                    <li>Unique: {stats.unique}</li>
                    <li>Min: {formatStatValue(stats.min)}</li>
                    <li>Max: {formatStatValue(stats.max)}</li>
                    <li>Mean: {formatStatValue(stats.mean)}</li>
                    <li>Median: {formatStatValue(stats.median)}</li>
                    <li>Std: {formatStatValue(stats.std)}</li>
                    <li>Sum: {formatStatValue(stats.sum)}</li>
                  </ul>
                ) : (
                  <ul>
                    <li>Count: {stats.count}</li>
                    <li>Nulls: {stats.nulls}</li>
                    <li>Unique: {stats.unique}</li>
                    {stats.top.map((entry) => (
                      <li key={entry.value}>
                        {entry.value}: {entry.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className={Styles.dialogActions}>
            <Button type="button" onClick={copySummary}>
              {t(($) => $.attributeTable.copy)}
            </Button>
            <Button primary type="button" onClick={onClose}>
              {t(($) => $.attributeTable.close)}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default AttributeStatsDialog;
