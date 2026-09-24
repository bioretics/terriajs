import React, { useMemo, useState } from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { type ChartRow } from "../attributeCharts";
import {
  computeFieldStats,
  formatStatValue,
  resolveStatsScope,
  statsScopeAvailability,
  type FieldStats,
  type StatsScope
} from "../attributeStats";
import Icon, { StyledIcon } from "../../../Styled/Icon";
import AttributeTableDialog from "../AttributeTableDialog";
import {
  DialogButton,
  DialogField,
  DialogLabel,
  DialogMutedText,
  DialogSelect,
  MonoText
} from "../AttributeTableStyles";

interface PropsType {
  /** Every row of the layer. */
  rows: ChartRow[];
  /** Rows matching the table's current search filter (a subset of `rows`). */
  filteredRows: ChartRow[];
  /** Rows matching the table's current selection (a subset of `rows`). */
  selectedRows: ChartRow[];
  columns: string[];
  layerName: string;
  onClose: () => void;
}

const Controls = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
`;

const StatGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 6px 16px;
  margin: 0;
  padding: 12px;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};

  dt {
    font-size: 11px;
    color: ${(p) => p.theme.textDark};
  }

  dd {
    margin: 0;
    font-size: 13px;
  }
`;

const TopValues = styled.ul`
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 10px;
    font-size: 13px;
    border-bottom: 1px solid ${(p) => p.theme.greyLighter};

    &:last-child {
      border-bottom: none;
    }
  }
`;

const TopValueName = styled(MonoText)`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Message = styled.p`
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textDark};
`;

/**
 * Summary statistics for one field of the layer: count / nulls / min / max /
 * mean / median / standard deviation / sum for a numeric field, or count /
 * nulls / distinct values / most frequent values for a text one. When the
 * table's search or its selection narrows the layer, the summary can be read
 * over that subset instead, and copied to the clipboard as it reads.
 */
const FieldStatisticsDialog: React.FC<PropsType> = (props) => {
  const { rows, filteredRows, selectedRows, columns, layerName, onClose } =
    props;
  const { t } = useTranslation();
  const [field, setField] = useState(columns[0] ?? "");
  const [scope, setScope] = useState<StatsScope>("all");
  const [copied, setCopied] = useState(false);

  const { hasFilter, hasSelection } = useMemo(
    () => statsScopeAvailability(rows, filteredRows, selectedRows),
    [rows, filteredRows, selectedRows]
  );
  const activeScope = resolveStatsScope(scope, { hasFilter, hasSelection });

  const scopedRows =
    activeScope === "filtered"
      ? filteredRows
      : activeScope === "selected"
        ? selectedRows
        : rows;

  const stats = useMemo<FieldStats | undefined>(
    () =>
      field ? (computeFieldStats(scopedRows, field) ?? undefined) : undefined,
    [field, scopedRows]
  );

  const copySummary = () => {
    if (!stats || !field) return;
    const header =
      activeScope === "filtered"
        ? t(($) => $.attributeTable.statistics.copyHeaderFiltered, { field })
        : activeScope === "selected"
          ? t(($) => $.attributeTable.statistics.copyHeaderSelected, { field })
          : t(($) => $.attributeTable.statistics.copyHeader, { field });
    const body = statRows(stats, t)
      .map(([label, value]) => `${label}\t${value}`)
      .join("\n");
    navigator.clipboard
      ?.writeText(`${header}\n${body}`)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return (
    <AttributeTableDialog
      title={t(($) => $.attributeTable.statistics.title)}
      description={t(($) => $.attributeTable.statistics.description, {
        layer: layerName
      })}
      maxWidth="560px"
      onClose={onClose}
      footer={
        stats ? (
          <>
            {copied ? (
              <DialogMutedText
                css={`
                  margin-right: auto;
                `}
              >
                {t(($) => $.attributeTable.statistics.copied)}
              </DialogMutedText>
            ) : null}
            <DialogButton type="button" onClick={copySummary}>
              <StyledIcon glyph={Icon.GLYPHS.copy} styledWidth="14px" />
              {t(($) => $.attributeTable.statistics.copy)}
            </DialogButton>
          </>
        ) : undefined
      }
    >
      {columns.length === 0 ? (
        <Message>{t(($) => $.attributeTable.statistics.noFields)}</Message>
      ) : (
        <>
          <Controls>
            <DialogField>
              <DialogLabel htmlFor="attribute-stats-field">
                {t(($) => $.attributeTable.statistics.field)}
              </DialogLabel>
              <DialogSelect
                id="attribute-stats-field"
                value={field}
                onChange={(event) => {
                  setField(event.target.value);
                  setCopied(false);
                }}
              >
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </DialogSelect>
            </DialogField>
            {hasFilter || hasSelection ? (
              <DialogField>
                <DialogLabel htmlFor="attribute-stats-scope">
                  {t(($) => $.attributeTable.scope)}
                </DialogLabel>
                <DialogSelect
                  id="attribute-stats-scope"
                  value={activeScope}
                  onChange={(event) => {
                    setScope(event.target.value as StatsScope);
                    setCopied(false);
                  }}
                >
                  <option value="all">
                    {t(($) => $.attributeTable.scopeAll, {
                      total: rows.length
                    })}
                  </option>
                  {hasFilter ? (
                    <option value="filtered">
                      {t(($) => $.attributeTable.scopeFiltered, {
                        total: filteredRows.length
                      })}
                    </option>
                  ) : null}
                  {hasSelection ? (
                    <option value="selected">
                      {t(($) => $.attributeTable.scopeSelected, {
                        total: selectedRows.length
                      })}
                    </option>
                  ) : null}
                </DialogSelect>
              </DialogField>
            ) : null}
          </Controls>

          {!stats ? (
            <Message>{t(($) => $.attributeTable.statistics.noValues)}</Message>
          ) : (
            <>
              <StatGrid>
                {statRows(stats, t).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <MonoText>{value}</MonoText>
                    </dd>
                  </div>
                ))}
              </StatGrid>
              {stats.kind === "text" ? (
                <>
                  <DialogLabel
                    as="span"
                    css={`
                      display: block;
                      margin-top: 12px;
                    `}
                  >
                    {t(($) => $.attributeTable.statistics.mostFrequent)}
                  </DialogLabel>
                  {stats.top.length === 0 ? (
                    <Message>
                      {t(($) => $.attributeTable.statistics.noPopulated)}
                    </Message>
                  ) : (
                    <TopValues>
                      {stats.top.map(({ value, count }) => (
                        <li key={value}>
                          <TopValueName title={value}>{value}</TopValueName>
                          <MonoText>{count.toLocaleString()}</MonoText>
                        </li>
                      ))}
                    </TopValues>
                  )}
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </AttributeTableDialog>
  );
};

/** The label/value pairs shown for a field, in display order. */
function statRows(stats: FieldStats, t: TFunction): [string, string][] {
  if (stats.kind === "numeric") {
    return [
      [t(($) => $.attributeTable.stat.count), stats.count.toLocaleString()],
      [t(($) => $.attributeTable.stat.nulls), stats.nulls.toLocaleString()],
      ...(stats.nonNumeric > 0
        ? ([
            [
              t(($) => $.attributeTable.stat.nonNumeric),
              stats.nonNumeric.toLocaleString()
            ]
          ] as [string, string][])
        : []),
      [t(($) => $.attributeTable.stat.unique), stats.unique.toLocaleString()],
      [t(($) => $.attributeTable.stat.min), formatStatValue(stats.min)],
      [t(($) => $.attributeTable.stat.max), formatStatValue(stats.max)],
      [t(($) => $.attributeTable.stat.mean), formatStatValue(stats.mean)],
      [t(($) => $.attributeTable.stat.median), formatStatValue(stats.median)],
      [t(($) => $.attributeTable.stat.std), formatStatValue(stats.std)],
      [t(($) => $.attributeTable.stat.sum), formatStatValue(stats.sum)]
    ];
  }
  return [
    [t(($) => $.attributeTable.stat.count), stats.count.toLocaleString()],
    [t(($) => $.attributeTable.stat.nulls), stats.nulls.toLocaleString()],
    [t(($) => $.attributeTable.stat.unique), stats.unique.toLocaleString()]
  ];
}

export default FieldStatisticsDialog;
