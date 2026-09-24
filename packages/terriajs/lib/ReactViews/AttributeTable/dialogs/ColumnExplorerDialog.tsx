import React, { useMemo, useState } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import Button from "../../../Styled/Button";
import { coerceNumericStringRows } from "../attributeCharts";
import { formatStatValue } from "../attributeStats";
import { populatedCount, summarizeColumns } from "../columnExplorer";
import AttributeTableController from "../AttributeTableController";
import Styles from "../attribute-table.scss";

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
}

const ColumnExplorerDialog: React.FC<Props> = observer(
  function ColumnExplorerDialog({ controller, onClose }) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState("");
    const rows = useMemo(
      () => coerceNumericStringRows(controller.baseRows),
      [controller.baseRows]
    );
    const keys = controller.workingColumns.map((c) => c.key);
    const summaries = useMemo(() => summarizeColumns(rows, keys), [rows, keys]);
    const filtered = summaries.filter((s) =>
      s.key.toLowerCase().includes(filter.trim().toLowerCase())
    );

    return (
      <div
        className={Styles.dialogBackdrop}
        role="presentation"
        onClick={onClose}
      >
        <div
          className={Styles.dialog}
          role="dialog"
          aria-label={t(($) => $.attributeTable.explore)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={Styles.dialogHeader}>
            <h3>{t(($) => $.attributeTable.columnExplorer)}</h3>
          </div>
          <div className={Styles.dialogBody}>
            <input
              type="search"
              placeholder={t(($) => $.attributeTable.filterColumns)}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: "100%", marginBottom: 12 }}
            />
            <div>
              {filtered.map((summary) => {
                const column = controller.workingColumns.find(
                  (c) => c.key === summary.key
                );
                const isHidden = !!column?.hidden;
                return (
                  <div
                    key={summary.key}
                    className={classNames(Styles.columnExplorerRow, {
                      [Styles.columnExplorerRowHidden]: isHidden
                    })}
                  >
                    <strong>{summary.key}</strong>{" "}
                    <span style={{ opacity: 0.7 }}>
                      ({summary.stats.kind}) · populated{" "}
                      {populatedCount(summary)}/{summary.total} · unique{" "}
                      {summary.stats.unique}
                    </span>
                    {summary.stats.kind === "numeric" ? (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        min {formatStatValue(summary.stats.min)} · mean{" "}
                        {formatStatValue(summary.stats.mean)} · max{" "}
                        {formatStatValue(summary.stats.max)}
                        {summary.histogram && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: 2,
                              height: 32,
                              marginTop: 4
                            }}
                          >
                            {summary.histogram.bins.map((bin, i) => (
                              <div
                                key={i}
                                title={`${bin.count}`}
                                style={{
                                  width: 8,
                                  height: `${Math.max(
                                    2,
                                    (bin.count /
                                      (summary.histogram!.maxCount || 1)) *
                                      100
                                  )}%`,
                                  background: "#4ca2f9"
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <ul
                        style={{
                          fontSize: 12,
                          margin: "4px 0 0",
                          paddingLeft: 16
                        }}
                      >
                        {summary.stats.top.slice(0, 5).map((entry) => (
                          <li key={entry.value}>
                            {entry.value}: {entry.count}
                          </li>
                        ))}
                      </ul>
                    )}
                    {controller.capabilities.canManageColumns && (
                      <div style={{ marginTop: 4 }}>
                        <Button
                          type="button"
                          onClick={() =>
                            controller.setColumnHidden(summary.key, !isHidden)
                          }
                        >
                          {isHidden
                            ? t(($) => $.attributeTable.showColumn)
                            : t(($) => $.attributeTable.hideColumn)}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={Styles.dialogActions}>
            <Button primary type="button" onClick={onClose}>
              {t(($) => $.attributeTable.close)}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

export default ColumnExplorerDialog;
