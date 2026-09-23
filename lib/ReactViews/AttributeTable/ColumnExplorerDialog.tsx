import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import {
  formatAxisValue,
  type ChartRow
} from "../../Core/AttributeTable/attributeCharts";
import { formatStatValue } from "../../Core/AttributeTable/attributeStats";
import {
  populatedCount,
  summarizeColumns,
  type ColumnSummary
} from "../../Core/AttributeTable/columnExplorer";
import AttributeTableDialog from "./AttributeTableDialog";
import {
  BarFill,
  BarTrack,
  DialogField,
  DialogInput,
  DialogLabel,
  DialogMutedText,
  DialogSelect,
  MonoText
} from "./AttributeTableStyles";

interface PropsType {
  /** Every row of the layer. */
  rows: ChartRow[];
  /** Rows matching the table's current search filter (a subset of `rows`). */
  filteredRows: ChartRow[];
  columns: string[];
  layerName: string;
  onClose: () => void;
}

type ExplorerScope = "all" | "filtered";

const Controls = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldName = styled(MonoText)`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
`;

const TypeBadge = styled.span`
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${(p) => p.theme.textDark};
  background: ${(p) => p.theme.greyLightest};
  border-radius: 2px;
`;

const Completeness = styled(BarTrack)`
  /* BarTrack grows to fill a row of top values; in this column-stacked card
     "flex: 1" would instead stretch it vertically into a solid block. */
  flex: none;
  height: 5px;
  border-radius: 3px;
`;

const Counts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 11px;
  color: ${(p) => p.theme.textDark};
`;

const NumericStats = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 12px;
  margin: 0;
  font-size: 11px;

  dt {
    color: ${(p) => p.theme.textDark};
  }

  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const TopValueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
`;

const TopValueLabel = styled(MonoText)`
  width: 96px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TopValueCount = styled.span`
  width: 40px;
  flex-shrink: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${(p) => p.theme.textDark};
`;

const Sparkline = styled.svg`
  display: block;
  width: 100%;
  height: 44px;
  /* The bars paint with currentColor, so one rule colors them all. */
  color: ${(p) => p.theme.colorPrimary};
`;

const Message = styled.p`
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textDark};
`;

/**
 * Every field of the layer at a glance: its type, how many rows are populated
 * versus null, how many distinct values it holds, and a small distribution - a
 * histogram for numeric fields, the most frequent values for text ones. The
 * fields can be filtered by name, and when the table's search narrows the layer
 * the summaries can be read over that subset instead.
 */
const ColumnExplorerDialog: React.FC<PropsType> = (props) => {
  const { rows, filteredRows, columns, layerName, onClose } = props;
  const { t } = useTranslation();
  const [scope, setScope] = useState<ExplorerScope>("all");
  const [search, setSearch] = useState("");

  // A filter is worth offering as a scope only when it actually narrows the
  // rows; otherwise the two scopes would summarize the same population.
  const hasFilter = filteredRows.length !== rows.length;

  // Fall back to "all" when the search is cleared while the dialog is open, so
  // the scope picker never points at an option it no longer offers.
  useEffect(() => {
    if (!hasFilter) setScope("all");
  }, [hasFilter]);

  const scopedRows = scope === "filtered" && hasFilter ? filteredRows : rows;
  const summaries = useMemo<ColumnSummary[]>(
    () => summarizeColumns(scopedRows, columns),
    [scopedRows, columns]
  );

  const query = search.trim().toLowerCase();
  const shown = query
    ? summaries.filter((summary) => summary.key.toLowerCase().includes(query))
    : summaries;

  return (
    <AttributeTableDialog
      title={t("attributeTable.columnExplorer.title")}
      description={t("attributeTable.columnExplorer.description", {
        layer: layerName
      })}
      maxWidth="860px"
      onClose={onClose}
    >
      {columns.length === 0 ? (
        <Message>{t("attributeTable.columnExplorer.noFields")}</Message>
      ) : (
        <>
          <Controls>
            <DialogField>
              <DialogLabel htmlFor="attribute-explorer-search">
                {t("attributeTable.columnExplorer.findField")}
              </DialogLabel>
              <DialogInput
                id="attribute-explorer-search"
                type="text"
                value={search}
                placeholder={t(
                  "attributeTable.columnExplorer.findFieldPlaceholder"
                )}
                onChange={(event) => setSearch(event.target.value)}
              />
            </DialogField>
            {hasFilter ? (
              <DialogField>
                <DialogLabel htmlFor="attribute-explorer-scope">
                  {t("attributeTable.scope")}
                </DialogLabel>
                <DialogSelect
                  id="attribute-explorer-scope"
                  value={scope}
                  onChange={(event) =>
                    setScope(event.target.value as ExplorerScope)
                  }
                >
                  <option value="all">
                    {t("attributeTable.scopeAll", { total: rows.length })}
                  </option>
                  <option value="filtered">
                    {t("attributeTable.scopeFiltered", {
                      total: filteredRows.length
                    })}
                  </option>
                </DialogSelect>
              </DialogField>
            ) : null}
            <DialogMutedText
              css={`
                margin-left: auto;
                padding-bottom: 6px;
              `}
            >
              {t("attributeTable.columnExplorer.fieldsShown", {
                shown: shown.length,
                total: summaries.length
              })}
            </DialogMutedText>
          </Controls>

          {shown.length === 0 ? (
            <Message>
              {t("attributeTable.columnExplorer.noMatches", { search })}
            </Message>
          ) : (
            <Grid>
              {shown.map((summary) => (
                <ColumnCard key={summary.key} summary={summary} />
              ))}
            </Grid>
          )}
        </>
      )}
    </AttributeTableDialog>
  );
};

/** A single field's card: header, completeness bar, then its distribution. */
function ColumnCard({ summary }: { summary: ColumnSummary }) {
  const { t } = useTranslation();
  const { key, stats, total } = summary;
  const populated = populatedCount(summary);
  const isNumeric = stats.kind === "numeric";

  return (
    <Card>
      <CardHeader>
        <FieldName title={key}>{key}</FieldName>
        <TypeBadge>
          {isNumeric
            ? t("attributeTable.columnExplorer.typeNumeric")
            : t("attributeTable.columnExplorer.typeText")}
        </TypeBadge>
      </CardHeader>

      <Completeness
        title={t("attributeTable.columnExplorer.completenessTitle", {
          populated,
          nulls: stats.nulls
        })}
      >
        <BarFill ratio={total > 0 ? populated / total : 0} />
      </Completeness>
      <Counts>
        <span>
          {t("attributeTable.columnExplorer.populated", { total: populated })}
        </span>
        <span>
          {t("attributeTable.columnExplorer.null", { total: stats.nulls })}
        </span>
        <span>
          {t("attributeTable.columnExplorer.unique", { total: stats.unique })}
        </span>
      </Counts>

      {stats.kind === "numeric" ? (
        <>
          <NumericSparkline summary={summary} />
          <NumericStats>
            <div>
              <dt>{t("attributeTable.stat.min")}</dt>
              <dd>
                <MonoText>{formatStatValue(stats.min)}</MonoText>
              </dd>
            </div>
            <div>
              <dt>{t("attributeTable.stat.mean")}</dt>
              <dd>
                <MonoText>{formatStatValue(stats.mean)}</MonoText>
              </dd>
            </div>
            <div>
              <dt>{t("attributeTable.stat.max")}</dt>
              <dd>
                <MonoText>{formatStatValue(stats.max)}</MonoText>
              </dd>
            </div>
          </NumericStats>
        </>
      ) : (
        <TextDistribution summary={summary} />
      )}
    </Card>
  );
}

/** Histogram bars scaled to the tallest bin, as a compact inline SVG. */
function NumericSparkline({ summary }: { summary: ColumnSummary }) {
  const { t } = useTranslation();
  const histogram = summary.histogram;
  const width = 200;
  const height = 44;

  if (!histogram || histogram.maxCount === 0) {
    return (
      <DialogMutedText>
        {t("attributeTable.columnExplorer.noNumericValues")}
      </DialogMutedText>
    );
  }

  const bins = histogram.bins;
  const gap = bins.length > 1 ? 1 : 0;
  const barWidth = (width - gap * (bins.length - 1)) / bins.length;

  return (
    <Sparkline
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t("attributeTable.columnExplorer.distributionAria", {
        field: summary.key,
        total: histogram.total,
        min: formatAxisValue(histogram.min),
        max: formatAxisValue(histogram.max)
      })}
    >
      {bins.map((bin, index) => {
        const barHeight =
          bin.count === 0 ? 0 : (bin.count / histogram.maxCount) * height;
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="currentColor"
          >
            <title>{`${formatAxisValue(bin.x0)} - ${formatAxisValue(bin.x1)}: ${
              bin.count
            }`}</title>
          </rect>
        );
      })}
    </Sparkline>
  );
}

/** The most frequent values of a text field, as proportional bars. */
function TextDistribution({ summary }: { summary: ColumnSummary }) {
  const { t } = useTranslation();
  const stats = summary.stats;
  if (stats.kind !== "text") return null;

  if (stats.top.length === 0) {
    return (
      <DialogMutedText>
        {t("attributeTable.columnExplorer.noPopulated")}
      </DialogMutedText>
    );
  }

  const maxCount = stats.top[0]?.count ?? 0;
  const remaining = Math.max(0, stats.unique - stats.top.length);

  return (
    <div>
      {stats.top.map(({ value, count }) => (
        <TopValueRow key={value}>
          <TopValueLabel title={value}>{value}</TopValueLabel>
          <BarTrack>
            <BarFill ratio={maxCount > 0 ? count / maxCount : 0} />
          </BarTrack>
          <TopValueCount>{count}</TopValueCount>
        </TopValueRow>
      ))}
      {remaining > 0 ? (
        <DialogMutedText>
          {t("attributeTable.columnExplorer.moreValues", { total: remaining })}
        </DialogMutedText>
      ) : null}
    </div>
  );
}

export default ColumnExplorerDialog;
