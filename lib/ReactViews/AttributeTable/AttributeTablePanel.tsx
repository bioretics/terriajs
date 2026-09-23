import FileSaver from "file-saver";
import { reaction, runInAction } from "mobx";
import { observer } from "mobx-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useTranslation } from "react-i18next";
import { useVirtual } from "react-virtual";
import styled from "styled-components";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import {
  coerceNumericStringRows,
  pickAnalysisRows,
  type ChartRow
} from "../../Core/AttributeTable/attributeCharts";
import {
  attributeRowsToCsv,
  attributeRowsToGeoJson,
  sanitizeExportFileName
} from "../../Core/AttributeTable/attributeExport";
import { formatAttributeValue } from "../../Core/AttributeTable/attributeValue";
import { computeRowSelection } from "../../Core/AttributeTable/attributeSelection";
import { compareAttributeValues } from "../../Core/AttributeTable/attributeSort";
import filterOutUndefined from "../../Core/filterOutUndefined";
import { JsonObject } from "../../Core/Json";
import AttributeTableSource, {
  attributeRowIdOfFeature,
  unionRectangles,
  type AttributeTableRow
} from "../../Models/AttributeTable/AttributeTableSource";
import { BaseModel } from "../../Models/Definition/Model";
import TerriaFeature from "../../Models/Feature/Feature";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import Icon, { StyledIcon } from "../../Styled/Icon";
import AttributeChartDialog from "./AttributeChartDialog";
import ColumnExplorerDialog from "./ColumnExplorerDialog";
import FieldStatisticsDialog from "./FieldStatisticsDialog";
import {
  PanelButton,
  PanelCheckboxLabel,
  PanelIconButton,
  PanelInput,
  PanelMutedText,
  PanelSelect,
  ROW_HEIGHT
} from "./AttributeTableStyles";

interface PropsType {
  terria: Terria;
  viewState: ViewState;
}

/** Sort key standing for the leading feature-id column. */
const FEATURE_ID_KEY = "__featureId";

const DEFAULT_PANEL_HEIGHT = 260;
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 700;
const FEATURE_ID_COLUMN_WIDTH = 80;
const ATTRIBUTE_COLUMN_WIDTH = 170;
/** How long the camera takes to fly to the selected features, in seconds. */
const ZOOM_DURATION = 1.5;

/** Stable empty values, so a missing layer does not churn the memos below. */
const NO_ROWS: AttributeTableRow[] = [];
const NO_COLUMNS: string[] = [];
const NO_CHART_ROWS: ChartRow[] = [];

type SortState = { key: string; direction: "asc" | "desc" };

/** Which analysis dialog is open over the table, if any. */
type AnalysisDialog = "explorer" | "statistics" | "chart";

const Wrapper = styled.div<{ styledHeight: number; isCollapsed: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  height: ${(p) => (p.isCollapsed ? "auto" : `${p.styledHeight}px`)};
  color: ${(p) => p.theme.textLight};
  background: ${(p) => p.theme.dark};
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  font-family: ${(p) => p.theme.fontBase};
`;

const ResizeHandle = styled.div`
  height: 6px;
  flex-shrink: 0;
  cursor: ns-resize;
  background: rgba(255, 255, 255, 0.08);

  &:hover {
    background: ${(p) => p.theme.colorPrimary};
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px;
  flex-shrink: 0;
`;

const Title = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-right: 6px;
  font-size: 13px;
  font-weight: 600;
`;

const Spacer = styled.div`
  flex: 1;
`;

/** Anchors the export dropdown to its button. */
const ExportMenuWrapper = styled.div`
  position: relative;
`;

const TableScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const Table = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  min-width: 100%;
  font-size: 12px;
`;

const HeaderCell = styled.th<{ columnWidth: number }>`
  position: sticky;
  top: 0;
  z-index: 1;
  width: ${(p) => p.columnWidth}px;
  min-width: ${(p) => p.columnWidth}px;
  max-width: ${(p) => p.columnWidth}px;
  box-sizing: border-box;
  padding: 0;
  text-align: left;
  background: ${(p) => p.theme.charcoalGrey};
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
`;

const HeaderButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: ${ROW_HEIGHT}px;
  padding: 0 8px;
  box-sizing: border-box;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${(p) => p.theme.textLight};
  background: transparent;
  border: none;

  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover,
  &:focus {
    color: ${(p) => p.theme.colorPrimary};
  }
`;

const Row = styled.tr<{ isSelected: boolean }>`
  height: ${ROW_HEIGHT}px;
  cursor: pointer;
  background: ${(p) => (p.isSelected ? p.theme.colorPrimary : "transparent")};

  &:nth-child(even) {
    background: ${(p) =>
      p.isSelected ? p.theme.colorPrimary : "rgba(255, 255, 255, 0.04)"};
  }

  &:hover {
    background: ${(p) =>
      p.isSelected ? p.theme.colorPrimary : "rgba(255, 255, 255, 0.12)"};
  }
`;

const Cell = styled.td<{ columnWidth: number }>`
  width: ${(p) => p.columnWidth}px;
  min-width: ${(p) => p.columnWidth}px;
  max-width: ${(p) => p.columnWidth}px;
  box-sizing: border-box;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const IdCell = styled(Cell)`
  color: ${(p) => p.theme.textLightDimmed};
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 4px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
`;

const EmptyState = styled.div`
  padding: 16px;
  font-size: 12px;
  color: ${(p) => p.theme.textLightDimmed};
`;

const ExportMenu = styled.div`
  position: absolute;
  z-index: 2;
  margin-top: 4px;
  min-width: 120px;
  background: ${(p) => p.theme.charcoalGrey};
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${(p) => p.theme.radiusSmall};

  & > button {
    display: block;
    width: 100%;
    padding: 6px 10px;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: ${(p) => p.theme.textLight};
    background: transparent;
    border: none;

    &:hover,
    &:focus {
      background: ${(p) => p.theme.colorPrimary};
    }
  }
`;

/** The position of a row, when it has one that a selection indicator can use. */
function pointPositionOf(row: AttributeTableRow): Cartesian3 | undefined {
  const geometry = row.geoJsonFeature?.geometry;
  if (geometry?.type === "Point") {
    const [longitude, latitude, height] = geometry.coordinates as number[];
    return Cartesian3.fromDegrees(longitude, latitude, height ?? 0);
  }
  // A table row has no geometry of its own, only the rectangle built around
  // its longitude/latitude - whose centre is that point.
  if (!geometry && row.rectangle) {
    return Cartesian3.fromRadians(
      (row.rectangle.west + row.rectangle.east) / 2,
      (row.rectangle.south + row.rectangle.north) / 2
    );
  }
  return undefined;
}

/**
 * The attribute table of one workbench layer, docked at the bottom of the map:
 * every feature as a row, every property as a column, with search, sorting and
 * a selection that is mirrored on the map (the picked feature is highlighted,
 * and optionally zoomed to). The rows it reads come from `AttributeTableSource`,
 * which supports GeoJSON-backed and table-backed items alike.
 */
const AttributeTablePanel = observer((props: PropsType) => {
  const { terria, viewState } = props;
  const { t } = useTranslation();

  const item: BaseModel | undefined = terria.workbench.items.find(
    (workbenchItem) =>
      workbenchItem.uniqueId === viewState.attributeTableSourceItemId
  );
  const itemId = item?.uniqueId;

  const source = useMemo(
    () => (item ? new AttributeTableSource(item) : undefined),
    [item]
  );
  const rows = source?.rows ?? NO_ROWS;
  const columns = source?.columns ?? NO_COLUMNS;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({
    key: FEATURE_ID_KEY,
    direction: "asc"
  });
  const [featureView, setFeatureView] = useState<"all" | "selected">("all");
  const [zoomToSelection, setZoomToSelection] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | undefined>(undefined);
  const [collapsed, setCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [openDialog, setOpenDialog] = useState<AnalysisDialog | undefined>(
    undefined
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  /** The feature this panel last put on the map, so it can ignore its own echo. */
  const ownFeature = useRef<TerriaFeature | undefined>(undefined);

  // Start afresh on another layer: a search, a sort or a selection made on the
  // previous one means nothing here.
  useEffect(() => {
    setSearch("");
    setSort({ key: FEATURE_ID_KEY, direction: "asc" });
    setFeatureView("all");
    setSelectedIds([]);
    setAnchorId(undefined);
    setOpenDialog(undefined);
  }, [itemId]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.featureId, row])),
    [rows]
  );

  // One lowercased haystack per row, so typing in the search box does not
  // re-stringify every feature on each keystroke.
  const haystacks = useMemo(
    () =>
      rows.map((row) =>
        `${row.featureId} ${JSON.stringify(row.properties)}`.toLowerCase()
      ),
    [rows]
  );

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter((row, index) => {
        if (featureView === "selected" && !selectedIdSet.has(row.featureId))
          return false;
        if (!query) return true;
        return haystacks[index].includes(query);
      }),
    [rows, haystacks, query, featureView, selectedIdSet]
  );

  // The analysis dialogs read numbers, but most sources hand every property
  // over as text; the rows they see are coerced (only while one is open, and
  // without touching the table or the layer itself). Both subsets are picked
  // out of those same coerced rows, so a field keeps one numeric/text reading
  // whichever scope a dialog is showing.
  const analysisOpen = openDialog !== undefined;
  const analysisRows = useMemo(
    () => (analysisOpen ? coerceNumericStringRows(rows) : rows),
    [analysisOpen, rows]
  );
  const analysisFilteredRows = useMemo(() => {
    if (!analysisOpen) return filtered;
    if (filtered.length === rows.length) return analysisRows;
    const filteredIds = new Set(filtered.map((row) => row.featureId));
    return pickAnalysisRows(analysisRows, rows, filteredIds);
  }, [analysisOpen, analysisRows, rows, filtered]);
  const analysisSelectedRows = useMemo(() => {
    if (!analysisOpen || selectedIdSet.size === 0) return NO_CHART_ROWS;
    return pickAnalysisRows(analysisRows, rows, selectedIdSet);
  }, [analysisOpen, analysisRows, rows, selectedIdSet]);

  const sorted = useMemo(() => {
    const ordered = [...filtered];
    ordered.sort((a, b) => {
      const aValue =
        sort.key === FEATURE_ID_KEY ? a.featureId : a.properties[sort.key];
      const bValue =
        sort.key === FEATURE_ID_KEY ? b.featureId : b.properties[sort.key];
      const result = compareAttributeValues(aValue, bValue);
      return sort.direction === "asc" ? result : -result;
    });
    return ordered;
  }, [filtered, sort]);

  // Only the rows in (and just around) the viewport are mounted, so a layer
  // with tens of thousands of features does not build that many DOM nodes.
  // Sorting and filtering above still run over every row.
  const rowVirtualizer = useVirtual({
    size: sorted.length,
    parentRef: scrollRef,
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 8
  });
  const virtualRows = rowVirtualizer.virtualItems;
  // Spacer rows reserve the scroll height of the rows that are not mounted,
  // keeping the native table column layout intact.
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.totalSize - virtualRows[virtualRows.length - 1].end
      : 0;

  const highlightOnMap = useCallback(
    (row: AttributeTableRow | undefined) => {
      runInAction(() => {
        if (!row || !item) {
          // Only drop a highlight this panel is responsible for.
          if (terria.selectedFeature === ownFeature.current) {
            terria.selectedFeature = undefined;
          }
          ownFeature.current = undefined;
          return;
        }
        const feature = new TerriaFeature({
          id: `attribute-table-${item.uniqueId}-${row.featureId}`,
          properties: { ...row.properties }
        });
        feature._catalogItem = item;
        // The GeoJSON geometry is what Terria turns into the line/polygon
        // highlight overlay; points are shown by the selection indicator, which
        // needs a position instead.
        if (row.geoJsonFeature) {
          feature.data = row.geoJsonFeature as unknown as JsonObject;
        }
        const position = pointPositionOf(row);
        if (position) {
          feature.position = new ConstantPositionProperty(position);
        }
        ownFeature.current = feature;
        terria.selectedFeature = feature;
      });
    },
    [item, terria]
  );

  const zoomToRows = useCallback(
    (rowsToZoom: AttributeTableRow[]) => {
      const rectangle = unionRectangles(rowsToZoom.map((row) => row.rectangle));
      if (rectangle) {
        terria.currentViewer.zoomTo(rectangle, ZOOM_DURATION);
      }
    },
    [terria]
  );

  const applySelection = useCallback(
    (ids: string[], anchor: string | undefined) => {
      setSelectedIds(ids);
      setAnchorId(anchor);
      highlightOnMap(anchor ? rowById.get(anchor) : undefined);
      if (zoomToSelection && ids.length > 0) {
        zoomToRows(filterOutUndefined(ids.map((id) => rowById.get(id))));
      }
    },
    [highlightOnMap, rowById, zoomToRows, zoomToSelection]
  );

  const handleRowClick = (
    featureId: string,
    event: React.MouseEvent<HTMLTableRowElement>
  ) => {
    const additive = event.ctrlKey || event.metaKey;
    const range = event.shiftKey;
    const { ids, anchor } = computeRowSelection({
      featureId,
      sortedIds: sorted.map((row) => row.featureId),
      selectedIds,
      anchorId,
      additive,
      range
    });
    // A plain click means "make this the only selection"; in the selected-only
    // view that would shrink the table to that single row, so drop back to
    // showing everything. Modifier clicks are deliberate refinements and stay.
    if (!additive && !range && featureView === "selected") {
      setFeatureView("all");
    }
    applySelection(ids, anchor);
  };

  // A feature picked on the map selects its row, so the two stay in step. Our
  // own highlight is ignored, otherwise it would fight the table's selection.
  useEffect(() => {
    if (!item) return undefined;
    return reaction(
      () => terria.selectedFeature,
      (feature) => {
        if (!feature || feature === ownFeature.current) return;
        const rowId = attributeRowIdOfFeature(
          feature,
          item,
          terria.timelineClock.currentTime
        );
        if (rowId === undefined) return;
        setSelectedIds([rowId]);
        setAnchorId(rowId);
      }
    );
  }, [item, terria]);

  // Bring the anchor row into view: with virtualization it may not be mounted
  // at all (it can be picked on the map, or pushed away by a sort), so a CSS
  // highlight alone would be invisible. "auto" leaves an already visible row
  // alone, keeping this unobtrusive.
  useEffect(() => {
    if (!anchorId || collapsed) return;
    const index = sorted.findIndex((row) => row.featureId === anchorId);
    if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: "auto" });
    // `sorted` and `rowVirtualizer` are rebuilt on every render and are
    // intentionally left out; these are the inputs that actually change which
    // row the anchor occupies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId, collapsed, sorted.length, sort, query]);

  // "Show selected" over an empty selection is a blank table; fall back to
  // showing everything once the selection is gone.
  useEffect(() => {
    if (selectedIds.length === 0) setFeatureView("all");
  }, [selectedIds.length]);

  // Drop the map highlight when the panel goes away, so closing the table does
  // not leave a feature highlighted with nothing pointing at it.
  useEffect(
    () => () => {
      runInAction(() => {
        if (terria.selectedFeature === ownFeature.current) {
          terria.selectedFeature = undefined;
        }
      });
    },
    [terria]
  );

  // Close the export menu when the click lands anywhere else.
  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const close = () => setExportMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [exportMenuOpen]);

  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = panelHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const next = startHeight + (startY - moveEvent.clientY);
      setPanelHeight(
        Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, next))
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const toggleSort = (key: string) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const exportRows = (format: "csv" | "geojson") => {
    const baseName = sanitizeExportFileName(source?.name ?? "");
    if (format === "csv") {
      const csv = attributeRowsToCsv(sorted, columns);
      FileSaver.saveAs(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `${baseName}.csv`
      );
    } else {
      const geojson = attributeRowsToGeoJson(sorted);
      if (!geojson) return;
      FileSaver.saveAs(
        new Blob([JSON.stringify(geojson)], {
          type: "application/geo+json;charset=utf-8"
        }),
        `${baseName}.geojson`
      );
    }
  };

  if (!item || !source) return null;

  const hasRows = rows.length > 0;
  const sortIndicator = (key: string) =>
    sort.key === key ? (sort.direction === "asc" ? " ▲" : " ▼") : "";

  return (
    <Wrapper styledHeight={panelHeight} isCollapsed={collapsed}>
      {!collapsed && (
        <ResizeHandle
          onMouseDown={startResize}
          role="separator"
          aria-orientation="horizontal"
          title={t("attributeTable.resize")}
        />
      )}
      <Toolbar>
        <Title>
          {t("attributeTable.title")}
          <PanelMutedText>{source.name}</PanelMutedText>
        </Title>
        <PanelButton
          type="button"
          disabled={!hasRows}
          active={openDialog === "explorer"}
          title={t("attributeTable.columnExplorer.buttonTitle")}
          onClick={() => setOpenDialog("explorer")}
        >
          <StyledIcon glyph={Icon.GLYPHS.data} styledWidth="13px" light />
          {t("attributeTable.columnExplorer.button")}
        </PanelButton>
        <PanelButton
          type="button"
          disabled={!hasRows}
          active={openDialog === "statistics"}
          title={t("attributeTable.statistics.buttonTitle")}
          onClick={() => setOpenDialog("statistics")}
        >
          <StyledIcon
            glyph={Icon.GLYPHS.oneTwoThree}
            styledWidth="13px"
            light
          />
          {t("attributeTable.statistics.button")}
        </PanelButton>
        <PanelButton
          type="button"
          disabled={!hasRows}
          active={openDialog === "chart"}
          title={t("attributeTable.chart.buttonTitle")}
          onClick={() => setOpenDialog("chart")}
        >
          <StyledIcon glyph={Icon.GLYPHS.barChart} styledWidth="13px" light />
          {t("attributeTable.chart.button")}
        </PanelButton>
        <PanelInput
          type="text"
          value={search}
          placeholder={t("attributeTable.searchPlaceholder")}
          aria-label={t("attributeTable.searchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
        <PanelCheckboxLabel>
          <input
            type="checkbox"
            checked={zoomToSelection}
            onChange={(event) => setZoomToSelection(event.target.checked)}
          />
          {t("attributeTable.zoomToSelection")}
        </PanelCheckboxLabel>
        <PanelSelect
          value={featureView}
          aria-label={t("attributeTable.featureView")}
          onChange={(event) =>
            setFeatureView(event.target.value as "all" | "selected")
          }
        >
          <option value="all">{t("attributeTable.showAllFeatures")}</option>
          <option value="selected" disabled={selectedIds.length === 0}>
            {t("attributeTable.showSelectedFeatures", {
              count: selectedIds.length
            })}
          </option>
        </PanelSelect>
        <Spacer />
        <ExportMenuWrapper>
          <PanelButton
            type="button"
            disabled={!hasRows}
            title={t("attributeTable.exportTitle")}
            onClick={(event) => {
              event.stopPropagation();
              setExportMenuOpen((open) => !open);
            }}
          >
            <StyledIcon glyph={Icon.GLYPHS.download} styledWidth="13px" light />
            {t("attributeTable.export")}
          </PanelButton>
          {exportMenuOpen && (
            <ExportMenu>
              <button type="button" onClick={() => exportRows("csv")}>
                CSV
              </button>
              <button type="button" onClick={() => exportRows("geojson")}>
                GeoJSON
              </button>
            </ExportMenu>
          )}
        </ExportMenuWrapper>
        <PanelIconButton
          type="button"
          disabled={selectedIds.length === 0}
          title={t("attributeTable.clearSelection")}
          aria-label={t("attributeTable.clearSelection")}
          onClick={() => applySelection([], undefined)}
        >
          <StyledIcon glyph={Icon.GLYPHS.cancel} styledWidth="13px" light />
        </PanelIconButton>
        <PanelIconButton
          type="button"
          title={
            collapsed
              ? t("attributeTable.expand")
              : t("attributeTable.collapse")
          }
          aria-label={
            collapsed
              ? t("attributeTable.expand")
              : t("attributeTable.collapse")
          }
          onClick={() => setCollapsed((value) => !value)}
        >
          <StyledIcon
            glyph={collapsed ? Icon.GLYPHS.showMore : Icon.GLYPHS.showLess}
            styledWidth="13px"
            light
          />
        </PanelIconButton>
        <PanelIconButton
          type="button"
          title={t("attributeTable.close")}
          aria-label={t("attributeTable.close")}
          onClick={() => viewState.closeAttributeTable()}
        >
          <StyledIcon glyph={Icon.GLYPHS.close} styledWidth="13px" light />
        </PanelIconButton>
      </Toolbar>

      {!collapsed && (
        <>
          {!hasRows ? (
            <EmptyState>
              {source.isLoading
                ? t("attributeTable.loading")
                : t("attributeTable.noAttributes")}
            </EmptyState>
          ) : (
            <TableScroll ref={scrollRef}>
              <Table>
                <thead>
                  <tr>
                    <HeaderCell columnWidth={FEATURE_ID_COLUMN_WIDTH}>
                      <HeaderButton
                        type="button"
                        onClick={() => toggleSort(FEATURE_ID_KEY)}
                      >
                        <span>#{sortIndicator(FEATURE_ID_KEY)}</span>
                      </HeaderButton>
                    </HeaderCell>
                    {columns.map((column) => (
                      <HeaderCell
                        key={column}
                        columnWidth={ATTRIBUTE_COLUMN_WIDTH}
                      >
                        <HeaderButton
                          type="button"
                          title={column}
                          onClick={() => toggleSort(column)}
                        >
                          <span>
                            {column}
                            {sortIndicator(column)}
                          </span>
                        </HeaderButton>
                      </HeaderCell>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={columns.length + 1}
                        style={{ height: paddingTop }}
                      />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = sorted[virtualRow.index];
                    return (
                      <Row
                        key={row.featureId}
                        isSelected={selectedIdSet.has(row.featureId)}
                        onClick={(event) =>
                          handleRowClick(row.featureId, event)
                        }
                      >
                        <IdCell columnWidth={FEATURE_ID_COLUMN_WIDTH}>
                          {row.featureId}
                        </IdCell>
                        {columns.map((column) => {
                          const value = formatAttributeValue(
                            row.properties[column]
                          );
                          return (
                            <Cell
                              key={column}
                              columnWidth={ATTRIBUTE_COLUMN_WIDTH}
                              title={value}
                            >
                              {value}
                            </Cell>
                          );
                        })}
                      </Row>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={columns.length + 1}
                        style={{ height: paddingBottom }}
                      />
                    </tr>
                  )}
                </tbody>
              </Table>
            </TableScroll>
          )}
          <StatusBar>
            <PanelMutedText>
              {t("attributeTable.statusFeatures", { count: rows.length })}
            </PanelMutedText>
            {filtered.length !== rows.length && (
              <PanelMutedText>
                {t("attributeTable.statusShown", { count: filtered.length })}
              </PanelMutedText>
            )}
            <PanelMutedText>
              {t("attributeTable.statusSelected", {
                count: selectedIds.length
              })}
            </PanelMutedText>
          </StatusBar>
        </>
      )}

      {openDialog === "explorer" && (
        <ColumnExplorerDialog
          rows={analysisRows}
          filteredRows={analysisFilteredRows}
          columns={columns}
          layerName={source.name}
          onClose={() => setOpenDialog(undefined)}
        />
      )}
      {openDialog === "statistics" && (
        <FieldStatisticsDialog
          rows={analysisRows}
          filteredRows={analysisFilteredRows}
          selectedRows={analysisSelectedRows}
          columns={columns}
          layerName={source.name}
          onClose={() => setOpenDialog(undefined)}
        />
      )}
      {openDialog === "chart" && (
        <AttributeChartDialog
          rows={analysisRows}
          columns={columns}
          layerName={source.name}
          onClose={() => setOpenDialog(undefined)}
        />
      )}
    </Wrapper>
  );
});

export default AttributeTablePanel;
