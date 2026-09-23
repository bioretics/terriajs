/**
 * Persistent Attribute Dashboard state: widgets that cross-filter the table.
 */

import {
  BarAggregation,
  CategorySelection,
  ChartType,
  filterRowsBySelections
} from "./attributeCharts";
import { AttributeTableRow } from "./types";

export type DashboardWidgetType = ChartType | "selector";

export interface DashboardWidgetBase {
  id: string;
  title: string;
  type: DashboardWidgetType;
}

export interface ChartDashboardWidget extends DashboardWidgetBase {
  type: ChartType;
  field?: string;
  fieldY?: string;
  categoryField?: string;
  aggregation?: BarAggregation;
  bins?: number;
}

export interface SelectorDashboardWidget extends DashboardWidgetBase {
  type: "selector";
  field: string;
  selectedValues: string[];
}

export type DashboardWidget = ChartDashboardWidget | SelectorDashboardWidget;

export interface AttributeDashboardState {
  widgets: DashboardWidget[];
  /** Cross-filter selections produced by selector widgets. */
  selections: CategorySelection[];
}

const STORAGE_PREFIX = "terriajs.attributeDashboard.";

export function emptyDashboardState(): AttributeDashboardState {
  return { widgets: [], selections: [] };
}

export function loadDashboardState(
  catalogItemId: string
): AttributeDashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + catalogItemId);
    if (!raw) return emptyDashboardState();
    const parsed = JSON.parse(raw) as AttributeDashboardState;
    if (!parsed || !Array.isArray(parsed.widgets)) return emptyDashboardState();
    return {
      widgets: parsed.widgets,
      selections: Array.isArray(parsed.selections) ? parsed.selections : []
    };
  } catch {
    return emptyDashboardState();
  }
}

export function saveDashboardState(
  catalogItemId: string,
  state: AttributeDashboardState
): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + catalogItemId, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function selectionsFromWidgets(
  widgets: DashboardWidget[]
): CategorySelection[] {
  return widgets
    .filter((w): w is SelectorDashboardWidget => w.type === "selector")
    .map((w) => ({ field: w.field, values: w.selectedValues }));
}

/**
 * Apply dashboard selector cross-filters to attribute rows.
 */
export function applyDashboardCrossFilters(
  rows: AttributeTableRow[],
  selections: CategorySelection[]
): AttributeTableRow[] {
  if (!selections.length) return rows;
  const active = selections.filter((s) => s.values.length > 0);
  if (active.length === 0) return rows;
  // AttributeTableRow is structurally compatible with ChartRow.
  return filterRowsBySelections(rows, active) as AttributeTableRow[];
}

export function createWidgetId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
