import {
  action,
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction
} from "mobx";
import { BaseModel } from "../../Models/Definition/Model";
import Terria from "../../Models/Terria";
import {
  applyColumnAdd,
  applyColumnDelete,
  applyColumnRename,
  applyColumnReorder,
  applyDraftsToRows,
  CellDrafts,
  commitGeoJsonAttributeEdits
} from "./attributeEditing";
import {
  applyDashboardCrossFilters,
  AttributeDashboardState,
  createWidgetId,
  DashboardWidget,
  emptyDashboardState,
  loadDashboardState,
  saveDashboardState,
  selectionsFromWidgets
} from "./attributeDashboard";
import { downloadTextFile, rowsToCsv } from "./attributeExport";
import {
  calculateField,
  coerceDraftValue,
  compileExpression
} from "./attributeExpression";
import { computeRowSelection } from "./attributeSelection";
import {
  canOpenAttributeTable,
  getAttributeTableCapabilities,
  snapshotAttributeTable
} from "./canOpenAttributeTable";
import MappableMixin from "../../ModelMixins/MappableMixin";
import {
  filterAttributeRows,
  filterRowsBySelectedIds,
  sortAttributeRows
} from "./attributeTableRows";
import {
  featureIdsFromMapSelection,
  syncSelectionToMap,
  zoomToAttributeSelection
} from "./mapSync";
import {
  AttributeTableCapabilities,
  AttributeTableColumn,
  AttributeTableRow,
  AttributeTableRowFilterMode,
  AttributeTableSort
} from "./types";

/**
 * Observable controller for Attribute Table state.
 * Independent of the modal/dock presentation shell.
 */
export default class AttributeTableController {
  @observable isOpen = false;
  @observable activeItem: BaseModel | undefined = undefined;
  @observable search = "";
  @observable sort: AttributeTableSort | undefined = undefined;
  @observable selectedIds: string[] = [];
  @observable selectionAnchor: string | null = null;
  @observable rowFilterMode: AttributeTableRowFilterMode = "all";
  @observable zoomToSelection = false;
  @observable isEditing = false;
  @observable drafts: CellDrafts = new Map();
  @observable workingRows: AttributeTableRow[] = [];
  @observable workingColumns: AttributeTableColumn[] = [];
  @observable dashboard: AttributeDashboardState = emptyDashboardState();
  @observable activeTab: "table" | "dashboard" = "table";
  @observable errorMessage: string | undefined = undefined;

  private disposeMapSync: (() => void) | undefined;
  private terria: Terria;

  constructor(terria: Terria) {
    this.terria = terria;
    makeObservable(this);
  }

  @computed
  get capabilities(): AttributeTableCapabilities {
    return getAttributeTableCapabilities(this.activeItem);
  }

  @computed
  get baseRows(): AttributeTableRow[] {
    if (this.isEditing || this.drafts.size > 0) {
      return applyDraftsToRows(this.workingRows, this.drafts);
    }
    return this.workingRows;
  }

  @computed
  get visibleColumns(): AttributeTableColumn[] {
    return this.workingColumns.filter((c) => !c.hidden);
  }

  @computed
  get dashboardFilteredRows(): AttributeTableRow[] {
    return applyDashboardCrossFilters(this.baseRows, this.dashboard.selections);
  }

  @computed
  get searchFilteredRows(): AttributeTableRow[] {
    return filterAttributeRows(this.dashboardFilteredRows, this.search);
  }

  @computed
  get displayRows(): AttributeTableRow[] {
    let rows = this.searchFilteredRows;
    if (this.rowFilterMode === "selected") {
      rows = filterRowsBySelectedIds(rows, new Set(this.selectedIds));
    }
    return sortAttributeRows(
      rows,
      this.sort?.key,
      this.sort?.direction ?? "asc"
    );
  }

  @computed
  get statusCounts(): {
    total: number;
    shown: number;
    selected: number;
  } {
    return {
      total: this.baseRows.length,
      shown: this.displayRows.length,
      selected: this.selectedIds.length
    };
  }

  @action
  open(item: BaseModel): void {
    this.activeItem = item;
    this.isOpen = true;
    this.errorMessage = undefined;
    this.isEditing = false;
    this.drafts = new Map();
    this.search = "";
    this.sort = undefined;
    this.selectedIds = [];
    this.selectionAnchor = null;
    this.rowFilterMode = "all";
    this.activeTab = "table";
    this.dashboard = loadDashboardState(item.uniqueId ?? item.type);
    this.dashboard = {
      ...this.dashboard,
      selections: selectionsFromWidgets(this.dashboard.widgets)
    };
    this.bindMapSync();

    if (canOpenAttributeTable(item)) {
      this.reloadFromItem();
      return;
    }

    // Data may still be loading (common for freshly imported GeoJSON).
    this.workingRows = [];
    this.workingColumns = [];
    void this.ensureLoadedAndReload(item);
  }

  private async ensureLoadedAndReload(item: BaseModel): Promise<void> {
    try {
      if (MappableMixin.isMixedInto(item)) {
        await item.loadMapItems();
      }
    } catch {
      // Fall through to canOpen check below.
    }
    if (this.activeItem !== item) return;
    runInAction(() => {
      if (canOpenAttributeTable(item)) {
        this.errorMessage = undefined;
        this.reloadFromItem();
      } else {
        this.errorMessage =
          "This layer does not have attribute records available yet.";
        this.workingRows = [];
        this.workingColumns = [];
      }
    });
  }

  @action
  close(): void {
    this.isOpen = false;
    this.activeItem = undefined;
    this.isEditing = false;
    this.drafts = new Map();
    this.workingRows = [];
    this.workingColumns = [];
    this.selectedIds = [];
    this.disposeMapSync?.();
    this.disposeMapSync = undefined;
  }

  @action
  reloadFromItem(): void {
    const snap = snapshotAttributeTable(this.activeItem);
    if (!snap) {
      this.workingRows = [];
      this.workingColumns = [];
      return;
    }
    this.workingRows = snap.rows;
    this.workingColumns = snap.columns;
  }

  @action
  setSearch(value: string): void {
    this.search = value;
  }

  @action
  toggleSort(key: string): void {
    if (this.sort?.key === key) {
      this.sort =
        this.sort.direction === "asc" ? { key, direction: "desc" } : undefined;
    } else {
      this.sort = { key, direction: "asc" };
    }
  }

  @action
  setSort(key: string, direction: "asc" | "desc"): void {
    this.sort = { key, direction };
  }

  @action
  setRowFilterMode(mode: AttributeTableRowFilterMode): void {
    this.rowFilterMode = mode;
  }

  @action
  setZoomToSelection(enabled: boolean): void {
    this.zoomToSelection = enabled;
    if (enabled) this.zoomToCurrentSelection();
  }

  @action
  handleRowClick(
    featureId: string,
    modifiers: { additive: boolean; range: boolean }
  ): void {
    const sortedIds = this.displayRows.map((r) => r.featureId);
    const result = computeRowSelection({
      featureId,
      sortedIds,
      selectedIds: this.selectedIds,
      anchorId: this.selectionAnchor,
      additive: modifiers.additive,
      range: modifiers.range
    });
    this.selectedIds = result.ids;
    this.selectionAnchor = result.anchor;

    if (this.capabilities.canSelectOnMap && this.activeItem) {
      syncSelectionToMap(this.terria, this.activeItem, this.selectedIds);
    }
    if (this.zoomToSelection) {
      this.zoomToCurrentSelection();
    }
  }

  @action
  zoomToCurrentSelection(): void {
    if (!this.activeItem || !this.capabilities.canZoomToSelection) return;
    const rows = this.baseRows.filter((r) =>
      this.selectedIds.includes(r.featureId)
    );
    zoomToAttributeSelection(this.terria, this.activeItem, rows);
  }

  @action
  setSelectedFromMap(ids: string[]): void {
    this.selectedIds = ids;
    this.selectionAnchor = ids[0] ?? null;
  }

  @action
  startEditing(): void {
    if (!this.capabilities.canEdit) return;
    this.isEditing = true;
    this.drafts = new Map();
  }

  @action
  cancelEditing(): void {
    this.isEditing = false;
    this.drafts = new Map();
    this.reloadFromItem();
  }

  @action
  setCellDraft(featureId: string, columnKey: string, rawValue: string): void {
    const col = this.workingColumns.find((c) => c.key === columnKey);
    // Prefer number when existing values look numeric.
    const sample = this.workingRows.find(
      (r) => typeof r.properties[columnKey] === "number"
    );
    const value = coerceDraftValue(rawValue, !!sample);
    let rowDrafts = this.drafts.get(featureId);
    if (!rowDrafts) {
      rowDrafts = new Map();
      this.drafts.set(featureId, rowDrafts);
    }
    rowDrafts.set(columnKey, value);
    // Trigger observability
    this.drafts = new Map(this.drafts);
    void col;
  }

  @action
  async saveEdits(): Promise<void> {
    if (!this.activeItem || !this.capabilities.canEdit) return;
    const rows = applyDraftsToRows(this.workingRows, this.drafts);
    try {
      const ok = await commitGeoJsonAttributeEdits(
        this.activeItem,
        rows,
        this.workingColumns
      );
      if (!ok) {
        this.errorMessage = "Unable to save attribute edits for this layer.";
        return;
      }
      runInAction(() => {
        this.isEditing = false;
        this.drafts = new Map();
        this.reloadFromItem();
      });
    } catch (e) {
      runInAction(() => {
        this.errorMessage =
          e instanceof Error ? e.message : "Failed to save attribute edits.";
      });
    }
  }

  @action
  addColumn(key: string, title?: string): void {
    if (!this.capabilities.canManageColumns) return;
    const result = applyColumnAdd(
      this.workingRows,
      this.workingColumns,
      key,
      title
    );
    this.workingRows = result.rows;
    this.workingColumns = result.columns;
  }

  @action
  deleteColumn(key: string): void {
    if (!this.capabilities.canManageColumns) return;
    const result = applyColumnDelete(
      this.workingRows,
      this.workingColumns,
      key
    );
    this.workingRows = result.rows;
    this.workingColumns = result.columns;
  }

  @action
  renameColumn(oldKey: string, newKey: string, newTitle?: string): void {
    if (!this.capabilities.canManageColumns) return;
    const result = applyColumnRename(
      this.workingRows,
      this.workingColumns,
      oldKey,
      newKey,
      newTitle
    );
    this.workingRows = result.rows;
    this.workingColumns = result.columns;
  }

  @action
  reorderColumn(fromIndex: number, toIndex: number): void {
    if (!this.capabilities.canManageColumns) return;
    this.workingColumns = applyColumnReorder(
      this.workingColumns,
      fromIndex,
      toIndex
    );
  }

  @action
  setColumnHidden(key: string, hidden: boolean): void {
    this.workingColumns = this.workingColumns.map((c) =>
      c.key === key ? { ...c, hidden } : c
    );
  }

  @action
  runFieldCalculator(expression: string, targetField: string): void {
    const fieldNames = this.workingColumns.map((c) => c.key);
    if (!fieldNames.includes(targetField)) {
      const added = applyColumnAdd(
        this.workingRows,
        this.workingColumns,
        targetField
      );
      this.workingRows = added.rows;
      this.workingColumns = added.columns;
    }
    const compiled = compileExpression(expression, fieldNames);
    this.workingRows = calculateField(this.workingRows, compiled, targetField);
    this.isEditing = true;
  }

  @action
  exportCsv(scope: "shown" | "selected" | "all" = "shown"): void {
    let rows = this.baseRows;
    if (scope === "shown") rows = this.displayRows;
    else if (scope === "selected") {
      rows = filterRowsBySelectedIds(rows, new Set(this.selectedIds));
    }
    const name =
      (this.activeItem as any)?.nameInCatalog ??
      (this.activeItem as any)?.name ??
      "attributes";
    const csv = rowsToCsv(rows, this.workingColumns);
    downloadTextFile(csv, `${name}.csv`);
  }

  @action
  setActiveTab(tab: "table" | "dashboard"): void {
    this.activeTab = tab;
  }

  @action
  addDashboardWidget(
    widget: DashboardWidget | Omit<DashboardWidget, "id">
  ): void {
    const full = {
      ...widget,
      id: "id" in widget && widget.id ? widget.id : createWidgetId()
    } as DashboardWidget;
    this.dashboard = {
      ...this.dashboard,
      widgets: [...this.dashboard.widgets, full],
      selections: selectionsFromWidgets([...this.dashboard.widgets, full])
    };
    this.persistDashboard();
  }

  @action
  updateDashboardWidget(widget: DashboardWidget): void {
    const widgets = this.dashboard.widgets.map((w) =>
      w.id === widget.id ? widget : w
    );
    this.dashboard = {
      widgets,
      selections: selectionsFromWidgets(widgets)
    };
    this.persistDashboard();
  }

  @action
  removeDashboardWidget(id: string): void {
    const widgets = this.dashboard.widgets.filter((w) => w.id !== id);
    this.dashboard = {
      widgets,
      selections: selectionsFromWidgets(widgets)
    };
    this.persistDashboard();
  }

  private persistDashboard(): void {
    const id = this.activeItem?.uniqueId ?? this.activeItem?.type;
    if (id) saveDashboardState(id, this.dashboard);
  }

  private bindMapSync(): void {
    this.disposeMapSync?.();
    this.disposeMapSync = reaction(
      () => [
        this.terria.selectedFeature,
        this.terria.pickedFeatures?.features?.length
      ],
      () => {
        if (!this.isOpen || !this.activeItem) return;
        const ids = featureIdsFromMapSelection(this.terria, this.activeItem);
        if (ids.length > 0) {
          runInAction(() => this.setSelectedFromMap(ids));
        }
      }
    );
  }
}
