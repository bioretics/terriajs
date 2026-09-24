import React, { useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Icon, { StyledIcon } from "../../../Styled/Icon";
import AttributeChartView, { CHART_H, CHART_W } from "../AttributeChartView";
import AttributeTableDialog from "../AttributeTableDialog";
import {
  DialogButton,
  DialogField,
  DialogInput,
  DialogLabel,
  DialogSelect
} from "../AttributeTableStyles";
import {
  categoryColumnOptions,
  coerceNumericStringRows,
  DEFAULT_HISTOGRAM_BINS,
  MAX_HISTOGRAM_BINS,
  MIN_HISTOGRAM_BINS,
  numericColumns,
  type BarAggregation,
  type ChartRow,
  type ChartType
} from "../attributeCharts";
import { sanitizeExportFileName } from "../attributeExport";
import { chartResultHasData, computeChart, type ChartSpec } from "../chartSpec";
import AttributeTableController from "../AttributeTableController";
import { downloadChartPng, downloadChartSvg } from "../downloadChart";

const Controls = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
`;

const ChartArea = styled.div`
  padding: 8px;
  border: 1px solid ${(p) => p.theme.greyLighter};
  border-radius: ${(p) => p.theme.radiusSmall};
`;

const Message = styled.p`
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: ${(p) => p.theme.textDark};
`;

const ErrorText = styled.span`
  margin-right: auto;
  font-size: 12px;
  color: ${(p) => p.theme.colorSecondary};
`;

interface ChartDialogProps {
  rows: ChartRow[];
  columns: string[];
  layerName: string;
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

const AttributeChartDialogInner: React.FC<ChartDialogProps> = (props) => {
  const { rows, columns, layerName, onClose, onAddToDashboard } = props;
  const { t } = useTranslation();

  const numericCols = useMemo(
    () => numericColumns(rows, columns),
    [rows, columns]
  );
  const categoryCols = useMemo(
    () => categoryColumnOptions(rows, columns),
    [rows, columns]
  );
  const hasNumeric = numericCols.length > 0;
  const hasCategory = categoryCols.length > 0;

  const [chartType, setChartType] = useState<ChartType>(
    hasNumeric ? "histogram" : "bar"
  );
  const [field, setField] = useState(numericCols[0] ?? "");
  const [xField, setXField] = useState(numericCols[0] ?? "");
  const [yField, setYField] = useState(numericCols[1] ?? numericCols[0] ?? "");
  const [bins, setBins] = useState(DEFAULT_HISTOGRAM_BINS);
  const [category, setCategory] = useState(categoryCols[0] ?? "");
  const [aggregation, setAggregation] = useState<BarAggregation>("count");
  const [valueField, setValueField] = useState(numericCols[0] ?? "");
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  const chartRef = useRef<HTMLDivElement>(null);

  const spec = useMemo<ChartSpec>(
    () => ({
      type: chartType,
      field,
      xField,
      yField,
      bins,
      category,
      aggregation,
      valueField
    }),
    [chartType, field, xField, yField, bins, category, aggregation, valueField]
  );
  const chartResult = useMemo(() => computeChart(rows, spec), [rows, spec]);
  const canDownload = chartResultHasData(chartResult);
  const showsValueField = aggregation !== "count";

  const download = (format: "svg" | "png") => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    setExportError(undefined);
    const baseName = `${sanitizeExportFileName(
      layerName,
      "chart"
    )}-${chartType}`;
    const onError = (error: unknown) =>
      setExportError(
        error instanceof Error
          ? error.message
          : t(($) => $.attributeTable.chart.exportError)
      );
    if (format === "svg") {
      try {
        downloadChartSvg(svg, CHART_W, CHART_H, `${baseName}.svg`);
      } catch (error) {
        onError(error);
      }
    } else {
      downloadChartPng(svg, CHART_W, CHART_H, `${baseName}.png`).catch(onError);
    }
  };

  const addTitle = `${chartType}: ${field || category || ""}`;

  return (
    <AttributeTableDialog
      title={t(($) => $.attributeTable.chart.title)}
      description={t(($) => $.attributeTable.chart.description, {
        layer: layerName
      })}
      maxWidth="720px"
      onClose={onClose}
      footer={
        <>
          {onAddToDashboard && (hasNumeric || hasCategory) ? (
            <DialogButton
              type="button"
              onClick={() =>
                onAddToDashboard({
                  type: chartType,
                  field:
                    chartType === "scatter"
                      ? xField
                      : chartType === "bar" || chartType === "pie"
                        ? showsValueField
                          ? valueField
                          : field
                        : field,
                  fieldY: chartType === "scatter" ? yField : undefined,
                  categoryField:
                    chartType === "bar" || chartType === "pie"
                      ? category
                      : undefined,
                  aggregation,
                  bins,
                  title: addTitle
                })
              }
            >
              {t(($) => $.attributeTable.addToDashboard)}
            </DialogButton>
          ) : null}
          {canDownload ? (
            <>
              {exportError ? <ErrorText>{exportError}</ErrorText> : null}
              <DialogButton type="button" onClick={() => download("png")}>
                <StyledIcon glyph={Icon.GLYPHS.download} styledWidth="14px" />
                {t(($) => $.attributeTable.chart.downloadPng)}
              </DialogButton>
              <DialogButton type="button" onClick={() => download("svg")}>
                <StyledIcon glyph={Icon.GLYPHS.download} styledWidth="14px" />
                {t(($) => $.attributeTable.chart.downloadSvg)}
              </DialogButton>
            </>
          ) : null}
        </>
      }
    >
      {!hasNumeric && !hasCategory ? (
        <Message>{t(($) => $.attributeTable.chart.noChartableFields)}</Message>
      ) : (
        <>
          <Controls>
            <DialogField>
              <DialogLabel htmlFor="attribute-chart-type">
                {t(($) => $.attributeTable.chart.chartType)}
              </DialogLabel>
              <DialogSelect
                id="attribute-chart-type"
                value={chartType}
                onChange={(event) =>
                  setChartType(event.target.value as ChartType)
                }
              >
                <option value="histogram" disabled={!hasNumeric}>
                  {t(($) => $.attributeTable.chart.typeHistogram)}
                </option>
                <option value="scatter" disabled={!hasNumeric}>
                  {t(($) => $.attributeTable.chart.typeScatter)}
                </option>
                <option value="bar" disabled={!hasCategory}>
                  {t(($) => $.attributeTable.chart.typeBar)}
                </option>
                <option value="line" disabled={!hasNumeric}>
                  {t(($) => $.attributeTable.chart.typeLine)}
                </option>
                <option value="box" disabled={!hasNumeric}>
                  {t(($) => $.attributeTable.chart.typeBox)}
                </option>
                <option value="pie" disabled={!hasCategory}>
                  {t(($) => $.attributeTable.chart.typePie)}
                </option>
              </DialogSelect>
            </DialogField>

            {(chartType === "histogram" ||
              chartType === "line" ||
              chartType === "box") && (
              <FieldSelect
                id="attribute-chart-field"
                label={t(($) => $.attributeTable.chart.field)}
                value={field}
                options={numericCols}
                onChange={setField}
              />
            )}

            {chartType === "histogram" && (
              <DialogField>
                <DialogLabel htmlFor="attribute-chart-bins">
                  {t(($) => $.attributeTable.chart.bins)}
                </DialogLabel>
                <DialogInput
                  id="attribute-chart-bins"
                  type="number"
                  min={MIN_HISTOGRAM_BINS}
                  max={MAX_HISTOGRAM_BINS}
                  value={bins}
                  style={{ width: 80 }}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setBins(
                      Number.isFinite(next)
                        ? Math.max(
                            MIN_HISTOGRAM_BINS,
                            Math.min(MAX_HISTOGRAM_BINS, Math.trunc(next))
                          )
                        : DEFAULT_HISTOGRAM_BINS
                    );
                  }}
                />
              </DialogField>
            )}

            {chartType === "scatter" && (
              <>
                <FieldSelect
                  id="attribute-chart-x"
                  label={t(($) => $.attributeTable.chart.xAxis)}
                  value={xField}
                  options={numericCols}
                  onChange={setXField}
                />
                <FieldSelect
                  id="attribute-chart-y"
                  label={t(($) => $.attributeTable.chart.yAxis)}
                  value={yField}
                  options={numericCols}
                  onChange={setYField}
                />
              </>
            )}

            {(chartType === "bar" || chartType === "pie") && (
              <>
                <FieldSelect
                  id="attribute-chart-category"
                  label={t(($) => $.attributeTable.chart.category)}
                  value={category}
                  options={categoryCols}
                  onChange={setCategory}
                />
                <DialogField>
                  <DialogLabel htmlFor="attribute-chart-aggregation">
                    {t(($) => $.attributeTable.chart.aggregate)}
                  </DialogLabel>
                  <DialogSelect
                    id="attribute-chart-aggregation"
                    value={aggregation}
                    onChange={(event) =>
                      setAggregation(event.target.value as BarAggregation)
                    }
                  >
                    <option value="count">
                      {t(($) => $.attributeTable.chart.aggCount)}
                    </option>
                    <option value="sum" disabled={!hasNumeric}>
                      {t(($) => $.attributeTable.chart.aggSum)}
                    </option>
                    <option value="mean" disabled={!hasNumeric}>
                      {t(($) => $.attributeTable.chart.aggMean)}
                    </option>
                  </DialogSelect>
                </DialogField>
                {showsValueField && hasNumeric && (
                  <FieldSelect
                    id="attribute-chart-value"
                    label={t(($) => $.attributeTable.chart.value)}
                    value={valueField}
                    options={numericCols}
                    onChange={setValueField}
                  />
                )}
              </>
            )}
          </Controls>

          <ChartArea ref={chartRef}>
            <AttributeChartView result={chartResult} />
          </ChartArea>
        </>
      )}
    </AttributeTableDialog>
  );
};

function FieldSelect(props: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <DialogField>
      <DialogLabel htmlFor={props.id}>{props.label}</DialogLabel>
      <DialogSelect
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </DialogSelect>
    </DialogField>
  );
}

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
  onAddToDashboard?: ChartDialogProps["onAddToDashboard"];
}

const AttributeChartDialog = observer(function AttributeChartDialog({
  controller,
  onClose,
  onAddToDashboard
}: Props) {
  const rows = useMemo(
    () => coerceNumericStringRows(controller.displayRows),
    [controller.displayRows]
  );
  const columns = controller.visibleColumns.map((c) => c.key);
  const layerName =
    (controller.activeItem as { nameInCatalog?: string; name?: string })
      ?.nameInCatalog ??
    (controller.activeItem as { name?: string })?.name ??
    "";

  return (
    <AttributeChartDialogInner
      rows={rows}
      columns={columns}
      layerName={layerName}
      onClose={onClose}
      onAddToDashboard={onAddToDashboard}
    />
  );
});

export default AttributeChartDialog;
