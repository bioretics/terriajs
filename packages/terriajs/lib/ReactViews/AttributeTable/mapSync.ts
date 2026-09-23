/**
 * Map ↔ attribute table selection synchronization.
 */

import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import GeoJsonMixin, { FEATURE_ID_PROP } from "../../ModelMixins/GeojsonMixin";
import MappableMixin from "../../ModelMixins/MappableMixin";
import TableMixin from "../../ModelMixins/TableMixin";
import { isTerriaFeatureData } from "../../Models/Feature/FeatureData";
import TerriaFeature from "../../Models/Feature/Feature";
import { BaseModel } from "../../Models/Definition/Model";
import Terria from "../../Models/Terria";
import PickedFeatures from "../../Map/PickedFeatures/PickedFeatures";
import { AttributeTableRow } from "./types";

/**
 * Resolve featureIds selected on the map from Terria's picked/selected features.
 */
export function featureIdsFromMapSelection(
  terria: Terria,
  item: BaseModel
): string[] {
  const features: TerriaFeature[] = [];
  if (terria.selectedFeature) features.push(terria.selectedFeature);
  if (terria.pickedFeatures?.features) {
    for (const f of terria.pickedFeatures.features) {
      if (!features.includes(f as TerriaFeature)) {
        features.push(f as TerriaFeature);
      }
    }
  }

  const ids: string[] = [];
  for (const feature of features) {
    if (!featureBelongsToItem(feature, item)) continue;
    const id = featureIdFromTerriaFeature(feature);
    if (id !== undefined) ids.push(id);
  }
  return [...new Set(ids)];
}

function featureBelongsToItem(
  feature: TerriaFeature,
  item: BaseModel
): boolean {
  // Match by catalog item reference when present.
  const owner = (feature as any).catalogItem ?? (feature as any)._catalogItem;
  if (owner && owner === item) return true;
  // Fallback: if this is the only table item or properties look related.
  if (TableMixin.isMixedInto(item) && isTerriaFeatureData(feature.data)) {
    return true;
  }
  return false;
}

export function featureIdFromTerriaFeature(
  feature: TerriaFeature
): string | undefined {
  if (isTerriaFeatureData(feature.data) && feature.data.rowIds?.length) {
    return String(feature.data.rowIds[0]);
  }
  const props = feature.properties;
  if (props) {
    const idProp = props[FEATURE_ID_PROP];
    if (idProp !== undefined) {
      const v =
        typeof idProp.getValue === "function" ? idProp.getValue() : idProp;
      if (v !== undefined && v !== null) return String(v);
    }
    const id = props.id;
    if (id !== undefined) {
      const v = typeof id.getValue === "function" ? id.getValue() : id;
      if (v !== undefined && v !== null) return String(v);
    }
  }
  if (feature.id !== undefined) return String(feature.id);
  return undefined;
}

/**
 * Find Cesium/Leaflet entities on the item that match selected feature ids.
 */
export function findEntitiesForFeatureIds(
  item: BaseModel,
  featureIds: ReadonlySet<string>
): TerriaFeature[] {
  if (!MappableMixin.isMixedInto(item)) return [];
  const matches: TerriaFeature[] = [];

  for (const mapItem of item.mapItems) {
    const entities = (mapItem as any)?.entities?.values as
      | TerriaFeature[]
      | undefined;
    if (!entities) continue;
    for (const entity of entities) {
      const id = featureIdFromTerriaFeature(entity);
      if (id !== undefined && featureIds.has(id)) {
        matches.push(entity);
      }
    }
  }

  // GeoJSON readyData fallback: synthesize features for pick panel.
  if (
    matches.length === 0 &&
    GeoJsonMixin.isMixedInto(item) &&
    item.readyData?.features
  ) {
    for (const f of item.readyData.features) {
      const propId = f.properties?.[FEATURE_ID_PROP];
      const id =
        propId !== undefined && propId !== null
          ? String(propId)
          : f.id !== undefined
            ? String(f.id)
            : undefined;
      if (id === undefined || !featureIds.has(id)) continue;
      // Skip synthesis here — zoom uses geometry bounds below.
    }
  }

  return matches;
}

/**
 * Push table selection to the map (highlight + pickedFeatures).
 */
export function syncSelectionToMap(
  terria: Terria,
  item: BaseModel,
  featureIds: string[]
): void {
  if (featureIds.length === 0) {
    terria.selectedFeature = undefined;
    return;
  }

  const entities = findEntitiesForFeatureIds(item, new Set(featureIds));
  if (entities.length > 0) {
    const picked = new PickedFeatures();
    picked.features = entities;
    picked.isLoading = false;
    terria.pickedFeatures = picked;
    terria.selectedFeature = entities[0];
    void terria.currentViewer._highlightFeature(entities[0]);
  }
}

/**
 * Zoom the map to the selected attribute rows' geometries.
 */
export function zoomToAttributeSelection(
  terria: Terria,
  item: BaseModel,
  rows: AttributeTableRow[]
): void {
  if (rows.length === 0) return;

  const entities = findEntitiesForFeatureIds(
    item,
    new Set(rows.map((r) => r.featureId))
  );

  if (entities.length > 0) {
    const positions = entities
      .map((e) => e.position?.getValue(terria.timelineClock.currentTime))
      .filter(Boolean);
    if (positions.length === 1) {
      void terria.currentViewer.zoomTo(
        // Mappable zoom for a single entity via rectangle around point
        rectangleFromCartographics(
          positions.map((p) => Cartographic.fromCartesian(p!))
        ),
        1.5
      );
      return;
    }
    if (positions.length > 1) {
      const cartos = positions.map((p) => Cartographic.fromCartesian(p!));
      void terria.currentViewer.zoomTo(rectangleFromCartographics(cartos), 1.5);
      return;
    }
  }

  // GeoJSON geometry fallback
  if (GeoJsonMixin.isMixedInto(item) && item.readyData?.features) {
    const idSet = new Set(rows.map((r) => r.featureId));
    const cartos: Cartographic[] = [];
    for (let i = 0; i < item.readyData.features.length; i++) {
      const f = item.readyData.features[i];
      const propId = f.properties?.[FEATURE_ID_PROP];
      const id =
        propId !== undefined && propId !== null
          ? String(propId)
          : f.id !== undefined
            ? String(f.id)
            : String(i);
      if (!idSet.has(id) && !idSet.has(String(i))) continue;
      collectCoordinates(f.geometry, cartos);
    }
    if (cartos.length > 0) {
      void terria.currentViewer.zoomTo(rectangleFromCartographics(cartos), 1.5);
    }
  }
}

function rectangleFromCartographics(cartos: Cartographic[]): Rectangle {
  const lons = cartos.map((c) => CesiumMath.toDegrees(c.longitude));
  const lats = cartos.map((c) => CesiumMath.toDegrees(c.latitude));
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const pad = 0.01;
  return Rectangle.fromDegrees(
    west - pad,
    south - pad,
    east + pad,
    north + pad
  );
}

function collectCoordinates(geometry: any, out: Cartographic[]): void {
  if (!geometry) return;
  if (geometry.type === "Point") {
    out.push(
      Cartographic.fromDegrees(geometry.coordinates[0], geometry.coordinates[1])
    );
  } else if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    for (const c of geometry.coordinates) {
      out.push(Cartographic.fromDegrees(c[0], c[1]));
    }
  } else if (
    geometry.type === "MultiLineString" ||
    geometry.type === "Polygon"
  ) {
    for (const ring of geometry.coordinates) {
      for (const c of ring) {
        out.push(Cartographic.fromDegrees(c[0], c[1]));
      }
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        for (const c of ring) {
          out.push(Cartographic.fromDegrees(c[0], c[1]));
        }
      }
    }
  }
}
