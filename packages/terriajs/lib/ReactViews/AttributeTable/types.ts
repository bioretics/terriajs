/**
 * Shared types for the Attribute Table feature.
 * Kept free of React/MobX so adapters and helpers stay unit-testable.
 */

export interface AttributeTableRow {
  /** Stable string id for selection / map sync (row index or feature `_id_`). */
  featureId: string;
  /** Numeric TableMixin row index. */
  rowId: number;
  properties: Record<string, unknown>;
}

export interface AttributeTableColumn {
  key: string;
  title: string;
  /** When true the column is hidden from the default grid. */
  hidden: boolean;
}

export interface AttributeTableCapabilities {
  canOpen: boolean;
  canEdit: boolean;
  canExport: boolean;
  canSelectOnMap: boolean;
  canZoomToSelection: boolean;
  canManageColumns: boolean;
}

export type AttributeTableSortDirection = "asc" | "desc";

export interface AttributeTableSort {
  key: string;
  direction: AttributeTableSortDirection;
}

export type AttributeTableRowFilterMode = "all" | "selected";

export const ATTRIBUTE_TABLE_ELEMENT_NAME = "AttributeTable";
