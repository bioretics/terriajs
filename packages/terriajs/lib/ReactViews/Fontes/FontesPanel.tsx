import { observer } from "mobx-react";
import { FC, useEffect, useMemo, useRef, useState } from "react";
import DataTable, { TableColumn } from "react-data-table-component";
import { useTranslation } from "react-i18next";
import styled, { useTheme } from "styled-components";
import triggerResize from "../../Core/triggerResize";
import Box from "../../Styled/Box";
import Button, { RawButton } from "../../Styled/Button";
import Checkbox from "../../Styled/Checkbox";
import Icon, { StyledIcon } from "../../Styled/Icon";
import Input from "../../Styled/Input";
import Select from "../../Styled/Select";
import Text, { TextSpan } from "../../Styled/Text";
import { useViewState } from "../Context";
import {
  ALL_FIELDS,
  filterDocuments,
  FontesCondition,
  FontesDocument,
  FontesLogic,
  getFontesDocuments,
  OPERATORS,
  parseFontesDate,
  distinctValues
} from "./Fontes";
import {
  FONTES_FIELDS,
  FONTES_SECTIONS,
  FontesFieldType
} from "./fontesFields";
import {
  RESULTS_LAYER_ID,
  showResultsOnMap,
  zoomToDocument
} from "./fontesMap";

const PANEL_WIDTH = 480;
const ALL_GROUPS = "";
const LOGICS: FontesLogic[] = ["AND", "OR", "AND NOT"];

interface Row extends FontesCondition {
  key: number;
  group: string;
}

const fieldType = (field: string): FontesFieldType =>
  FONTES_FIELDS.find((f) => f.key === field)?.type ?? "text";

const sectionFields = (group: string) =>
  FONTES_SECTIONS.find((s) => s.title === group)?.fields;

const newRow = (key: number): Row => ({
  key,
  group: ALL_GROUPS,
  field: ALL_FIELDS,
  operator: "contains",
  value: "",
  logic: "AND"
});

const ConditionRow: FC<{
  row: Row;
  documents: FontesDocument[];
  onChange: (row: Row) => void;
  onRemove: () => void;
}> = ({ row, documents, onChange, onRemove }) => {
  const { t } = useTranslation();
  const fields = sectionFields(row.group) ?? FONTES_FIELDS;
  const type = fieldType(row.field);
  const isDate = type === "date";
  const invalidDate =
    isDate && row.value.trim() !== "" && !parseFontesDate(row.value);
  const suggestions = useMemo(
    () =>
      type === "date" || type === "number" || type === "bool"
        ? []
        : distinctValues(documents, row.field),
    [documents, row.field, type]
  );
  const listId = `fontes-values-${row.key}`;

  const setField = (field: string, group = row.group) =>
    onChange({
      ...row,
      group,
      field,
      operator: OPERATORS[fieldType(field)][0],
      value: ""
    });

  return (
    <Box column gap={1} styledMargin="0 0 10px 0">
      <Box gap={1}>
        <Select
          light
          aria-label={t(($) => $.fontes.group)}
          value={row.group}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setField(
              sectionFields(e.target.value)?.[0].key ?? ALL_FIELDS,
              e.target.value
            )
          }
        >
          <option value={ALL_GROUPS}>{t(($) => $.fontes.allGroups)}</option>
          {FONTES_SECTIONS.map((section) => (
            <option key={section.title} value={section.title}>
              {section.title}
            </option>
          ))}
        </Select>
        <Select
          light
          aria-label={t(($) => $.fontes.field)}
          value={row.field}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setField(e.target.value)
          }
        >
          {row.group === ALL_GROUPS && (
            <option value={ALL_FIELDS}>{t(($) => $.fontes.allFields)}</option>
          )}
          {fields.map((field) => (
            <option key={field.key} value={field.key}>
              {field.label}
            </option>
          ))}
        </Select>
      </Box>
      <Box gap={1} verticalCenter>
        <Select
          light
          aria-label={t(($) => $.fontes.operator)}
          value={row.operator}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange({
              ...row,
              operator: e.target.value as FontesCondition["operator"]
            })
          }
        >
          {OPERATORS[type].map((operator) => (
            <option key={operator} value={operator}>
              {t(($) => $.fontes.operators[operator])}
            </option>
          ))}
        </Select>
        {type !== "bool" && (
          <>
            <Input
              light
              type={type === "number" ? "number" : "text"}
              aria-label={t(($) => $.fontes.value)}
              aria-invalid={invalidDate}
              invalidValue={invalidDate}
              title={isDate ? t(($) => $.fontes.dateHelp) : undefined}
              placeholder={isDate ? "1600/1650" : undefined}
              list={suggestions.length > 0 ? listId : undefined}
              value={row.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...row, value: e.target.value })
              }
            />
            {suggestions.length > 0 && (
              <datalist id={listId}>
                {suggestions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            )}
          </>
        )}
        <Box css={"width: 110px; flex-shrink: 0;"}>
          <Select
            light
            aria-label={t(($) => $.fontes.logic)}
            value={row.logic}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...row, logic: e.target.value as FontesLogic })
            }
          >
            {LOGICS.map((logic) => (
              <option key={logic} value={logic}>
                {logic}
              </option>
            ))}
          </Select>
        </Box>
        <RawButton
          aria-label={t(($) => $.fontes.removeCondition)}
          title={t(($) => $.fontes.removeCondition)}
          onClick={onRemove}
        >
          <StyledIcon styledWidth="12px" light glyph={Icon.GLYPHS.close} />
        </RawButton>
      </Box>
      {invalidDate && (
        <Text small textLight>
          {t(($) => $.fontes.invalidDate)}
        </Text>
      )}
    </Box>
  );
};

const FontesPanel: FC<{ isVisible: boolean }> = observer(({ isVisible }) => {
  const viewState = useViewState();
  const terria = viewState.terria;
  const config = terria.configParameters.fontesConfig;
  const theme = useTheme();
  const { t } = useTranslation();

  const [documents, setDocuments] = useState<FontesDocument[]>();
  const [loadError, setLoadError] = useState(false);
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>([newRow(0)]);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [results, setResults] = useState<FontesDocument[]>();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!isVisible || !config || documents) return;
    let current = true;
    setLoadError(false);
    getFontesDocuments(config.documentsUrl, terria.corsProxy)
      .then((docs) => current && setDocuments(docs))
      .catch(() => current && setLoadError(true));
    return () => {
      current = false;
    };
  }, [isVisible, config, documents, terria]);

  const resultsOnMap = () =>
    terria.workbench.items.some((item) => item.uniqueId === RESULTS_LAYER_ID);

  const showOnMap = (docs: FontesDocument[], animateInTime: boolean) =>
    showResultsOnMap(
      terria,
      docs,
      t(($) => $.fontes.resultsLayerName),
      animateInTime
    ).catch((error) => terria.raiseErrorToUser(error));

  const search = () => {
    if (!documents) return;
    const found = filterDocuments(documents, {
      conditions: rows,
      period: {
        from: yearFrom ? Number(yearFrom) : undefined,
        to: yearTo ? Number(yearTo) : undefined
      }
    });
    setResults(found);
    if (resultsOnMap()) showOnMap(found, animate);
  };

  const clear = () => {
    setRows([newRow(nextKey.current++)]);
    setYearFrom("");
    setYearTo("");
    setResults(undefined);
  };

  const close = () => {
    viewState.toggleFontesPanel();
    terria.currentViewer.notifyRepaintRequired();
    setTimeout(triggerResize, 1);
  };

  const columns: TableColumn<FontesDocument>[] = [
    {
      name: t(($) => $.fontes.id),
      selector: (d) => d.id,
      sortable: true,
      wrap: true,
      width: "135px"
    },
    {
      name: t(($) => $.fontes.title),
      selector: (d) => d.title,
      sortable: true,
      wrap: true,
      grow: 2
    },
    {
      name: t(($) => $.fontes.date),
      selector: (d) => String(d.properties.data_produzione ?? ""),
      sortable: true,
      sortFunction: (a, b) =>
        (a.date?.start ?? "").localeCompare(b.date?.start ?? "")
    },
    {
      name: "",
      button: true,
      cell: (d) => (
        <Button
          primary
          css={"min-height: 26px; padding: 0 8px;"}
          onClick={() => viewState.openFontesDocument(d.id)}
        >
          {t(($) => $.fontes.open)}
        </Button>
      )
    }
  ];

  if (!config) return null;

  return (
    <Panel column isVisible={isVisible} charcoalGreyBg>
      <Box right>
        <RawButton
          css={"padding: 15px;"}
          aria-label={t(($) => $.fontes.close)}
          onClick={close}
        >
          <StyledIcon
            styledWidth="16px"
            fillColor={theme.textLightDimmed}
            opacity={0.5}
            glyph={Icon.GLYPHS.closeLight}
          />
        </RawButton>
      </Box>
      <Box
        column
        paddedHorizontally={2}
        styledHeight="100%"
        overflowY="auto"
        scroll
      >
        <Text bold extraExtraLarge textLight>
          {t(($) => $.fontes.panelTitle)}
        </Text>
        <Text medium color={theme.textLightDimmed}>
          {t(($) => $.fontes.panelBody)}
        </Text>
        {!documents && !loadError && (
          <Text textLight medium css={"margin: 10px 0;"}>
            {t(($) => $.fontes.loading)}
          </Text>
        )}
        {loadError && (
          <Text medium color={theme.colorSecondary} css={"margin: 10px 0;"}>
            {t(($) => $.fontes.loadError)}
          </Text>
        )}

        <SectionTitle>{t(($) => $.fontes.period)}</SectionTitle>
        <Box gap={1}>
          <Input
            light
            type="number"
            min={1000}
            max={2999}
            aria-label={t(($) => $.fontes.yearFrom)}
            placeholder={t(($) => $.fontes.yearFrom)}
            value={yearFrom}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setYearFrom(e.target.value)
            }
          />
          <Input
            light
            type="number"
            min={1000}
            max={2999}
            aria-label={t(($) => $.fontes.yearTo)}
            placeholder={t(($) => $.fontes.yearTo)}
            value={yearTo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setYearTo(e.target.value)
            }
          />
        </Box>

        <SectionTitle>{t(($) => $.fontes.conditions)}</SectionTitle>
        {rows.map((row) => (
          <ConditionRow
            key={row.key}
            row={row}
            documents={documents ?? []}
            onChange={(changed) =>
              setRows(rows.map((r) => (r.key === changed.key ? changed : r)))
            }
            onRemove={() =>
              setRows(
                rows.length > 1
                  ? rows.filter((r) => r.key !== row.key)
                  : [newRow(nextKey.current++)]
              )
            }
          />
        ))}
        <Box>
          <Button
            secondary
            onClick={() => setRows([...rows, newRow(nextKey.current++)])}
          >
            {t(($) => $.fontes.addCondition)}
          </Button>
        </Box>

        <Box gap={1} styledMargin="15px 0">
          <Button primary disabled={!documents} onClick={search}>
            {t(($) => $.fontes.search)}
          </Button>
          <Button secondary onClick={clear}>
            {t(($) => $.fontes.clear)}
          </Button>
        </Box>

        {results && (
          <>
            <Text textLight medium css={"margin: 0 0 6px 0;"}>
              {results.length > 0
                ? t(($) => $.fontes.results, { count: results.length })
                : t(($) => $.fontes.noResults)}
            </Text>
            {results.length > 0 && (
              <Box gap={2} verticalCenter css={"margin-bottom: 8px;"}>
                <Button secondary onClick={() => showOnMap(results, animate)}>
                  {t(($) => $.fontes.showOnMap)}
                </Button>
                <Checkbox
                  isChecked={animate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAnimate(e.target.checked);
                    if (resultsOnMap()) showOnMap(results, e.target.checked);
                  }}
                >
                  <TextSpan textLight>
                    {t(($) => $.fontes.animateTime)}
                  </TextSpan>
                </Checkbox>
              </Box>
            )}
            {results.length > 0 && (
              <DataTable
                columns={columns}
                data={results}
                keyField="id"
                theme="dark"
                dense
                striped
                highlightOnHover
                pointerOnHover
                pagination
                paginationPerPage={10}
                paginationComponentOptions={{ noRowsPerPage: true }}
                onRowClicked={(d) => zoomToDocument(terria, d)}
                onRowDoubleClicked={(d) => viewState.openFontesDocument(d.id)}
              />
            )}
          </>
        )}
      </Box>
    </Panel>
  );
});

const Panel = styled(Box)<{ isVisible: boolean }>`
  display: ${(p) => (p.isVisible ? "flex" : "none")};
  width: ${PANEL_WIDTH}px;
  min-width: ${PANEL_WIDTH}px;
  height: 100vh;
`;

const SectionTitle = styled(Text).attrs({ bold: true, textLight: true })`
  margin: 15px 0 6px 0;
`;

export default FontesPanel;
