import TableMixin from "../../ModelMixins/TableMixin";
import { BaseModel } from "../../Models/Definition/Model";
import {
  AttributeTableCapabilities,
  AttributeTableColumn,
  AttributeTableRow
} from "./types";
import {
  buildAttributeTableColumns,
  buildAttributeTableRows,
  buildRowsFromMapEntities,
  hasLoadedTableRows,
  hasReadyDataFeatures
} from "./attributeTableRows";
import GeoJsonMixin from "../../ModelMixins/GeojsonMixin";
import GeoJsonCatalogItem from "../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import MappableMixin from "../../ModelMixins/MappableMixin";

/**
 * Whether a workbench item can open the Attribute Table.
 * Accepts TableMixin rows, GeoJSON `readyData`, or loaded map entities
 * (including RER POI / Cesium primitive layers that disable table styling).
 */
export function canOpenAttributeTable(item: BaseModel | undefined): boolean {
  if (!item || !TableMixin.isMixedInto(item)) return false;
  if (hasLoadedTableRows(item)) return true;
  if (hasReadyDataFeatures(item)) return true;
  return buildRowsFromMapEntities(item).length > 0;
}

/**
 * Whether the layer is eligible for an Attribute Table menu entry.
 * Broader than canOpen: show the control as soon as TableMixin is present so
 * the menu does not depend on async load timing.
 */
export function supportsAttributeTable(item: BaseModel | undefined): boolean {
  return !!item && TableMixin.isMixedInto(item);
}

/**
 * Capability flags for the attribute table toolbar / editing.
 * Editing is enabled only for GeoJsonCatalogItem instances that expose
 * mutable in-memory GeoJSON (geoJsonData / geoJsonString / blob or readyData).
 */
export function getAttributeTableCapabilities(
  item: BaseModel | undefined
): AttributeTableCapabilities {
  const canOpen = canOpenAttributeTable(item);
  if (!canOpen || !item) {
    return {
      canOpen: false,
      canEdit: false,
      canExport: false,
      canSelectOnMap: false,
      canZoomToSelection: false,
      canManageColumns: false
    };
  }

  const canEdit = isWritableGeoJsonItem(item);
  const hasGeometry =
    (GeoJsonMixin.isMixedInto(item) &&
      !!item.readyData?.features?.length &&
      item.mapItems.length > 0) ||
    (MappableMixin.isMixedInto(item) && item.mapItems.length > 0);

  return {
    canOpen: true,
    canEdit,
    canExport: true,
    canSelectOnMap: hasGeometry,
    canZoomToSelection: hasGeometry,
    canManageColumns: canEdit
  };
}

export function isWritableGeoJsonItem(item: BaseModel): boolean {
  if (!(item instanceof GeoJsonCatalogItem)) return false;
  // Service / multi-url sources are not safely writable.
  if (item.urls && item.urls.length > 0) return false;
  // Ion resources and remote URLs without local/blob override stay read-only
  // unless the user already has an in-memory geoJsonData / geoJsonString.
  if (item.geoJsonData || item.geoJsonString) return true;
  if (item.hasLocalData) return true;
  // Allow editing when readyData is present and the item is a plain GeoJSON
  // catalog item: commits write through geoJsonData user stratum.
  return GeoJsonMixin.isMixedInto(item) && !!item.readyData;
}

export interface AttributeTableSnapshot {
  columns: AttributeTableColumn[];
  rows: AttributeTableRow[];
  capabilities: AttributeTableCapabilities;
}

export function snapshotAttributeTable(
  item: BaseModel | undefined
): AttributeTableSnapshot | undefined {
  if (!item || !canOpenAttributeTable(item) || !TableMixin.isMixedInto(item)) {
    return undefined;
  }
  return {
    columns: buildAttributeTableColumns(item),
    rows: buildAttributeTableRows(item),
    capabilities: getAttributeTableCapabilities(item)
  };
}
