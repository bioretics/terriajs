import bbox from "@turf/bbox";
import type { Polygon } from "geojson";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import { JsonObject } from "../../Core/Json";
import MappableMixin from "../../ModelMixins/MappableMixin";
import TimeVarying from "../../ModelMixins/TimeVarying";
import addUserCatalogMember from "../../Models/Catalog/addUserCatalogMember";
import CatalogMemberFactory from "../../Models/Catalog/CatalogMemberFactory";
import CommonStrata from "../../Models/Definition/CommonStrata";
import { BaseModel } from "../../Models/Definition/Model";
import upsertModelFromJson from "../../Models/Definition/upsertModelFromJson";
import { FontesConfig } from "../../Models/InitSource";
import Terria from "../../Models/Terria";
import { FontesDocument, toResultsGeoJson } from "./Fontes";

export const RESULTS_LAYER_ID = "fontes-risultati";

const ZOOM_PADDING_DEGREES = 0.02;

const RESULTS_TEMPLATE =
  "<p><strong>{{titolo}}</strong></p>" +
  "<p>{{segnatura}}</p>" +
  "<p>{{data_produzione}}</p>" +
  '<p><fontes-document id="{{id}}"></fontes-document></p>';

export function rectoMapItemJson(
  doc: FontesDocument,
  config: FontesConfig
): JsonObject | undefined {
  const { recto_georef, recto_wms_layer, recto_cog_url } = doc.properties;
  if (recto_georef !== true) return undefined;
  const item = {
    id: `fontes-${doc.id}-recto`,
    name: `${doc.id} – ${doc.title}`
  };
  if (config.wmsUrl && typeof recto_wms_layer === "string") {
    return {
      ...item,
      type: "wms",
      url: config.wmsUrl,
      layers: recto_wms_layer
    };
  }
  if (typeof recto_cog_url === "string") {
    return { ...item, type: "cog", url: recto_cog_url };
  }
  return undefined;
}

export function resultsLayerJson(
  docs: FontesDocument[],
  name: string,
  animate: boolean
): JsonObject {
  return {
    id: RESULTS_LAYER_ID,
    type: "geojson",
    name,
    geoJsonData: toResultsGeoJson(
      animate ? docs.filter((doc) => doc.date) : docs
    ) as unknown as JsonObject,
    featureInfoTemplate: { template: RESULTS_TEMPLATE },
    columns: [
      { name: "data_da", type: "time" },
      { name: "data_a", type: "time" }
    ],
    activeStyle: "tipo",
    defaultStyle: {
      color: {
        colorColumn: "tipo",
        enumColors: [
          { value: "Mappa", color: "#e6550d" },
          { value: "Documento testuale", color: "#3182bd" }
        ]
      },
      time: animate
        ? {
            timeColumn: "data_da",
            endTimeColumn: "data_a",
            idColumns: ["id"]
          }
        : { timeColumn: null }
    },
    initialTimeSource: "start"
  };
}

async function showOnMap(terria: Terria, json: JsonObject): Promise<BaseModel> {
  const item = upsertModelFromJson(
    CatalogMemberFactory,
    terria,
    "",
    CommonStrata.user,
    json,
    {}
  ).throwIfUndefined();
  await addUserCatalogMember(terria, item, { enable: true });
  if (MappableMixin.isMixedInto(item)) terria.currentViewer.zoomTo(item, 1.5);
  return item;
}

export function zoomToDocument(terria: Terria, doc: FontesDocument) {
  if (!doc.geometry) return;
  const [west, south, east, north] = bbox(doc.geometry);
  terria.currentViewer.zoomTo(
    Rectangle.fromDegrees(
      west - ZOOM_PADDING_DEGREES,
      south - ZOOM_PADDING_DEGREES,
      east + ZOOM_PADDING_DEGREES,
      north + ZOOM_PADDING_DEGREES
    ),
    1.5
  );
}

export async function addRectoToMap(
  terria: Terria,
  doc: FontesDocument,
  config: FontesConfig
) {
  const json = rectoMapItemJson(doc, config);
  if (json) await showOnMap(terria, json);
}

export async function showResultsOnMap(
  terria: Terria,
  docs: FontesDocument[],
  name: string,
  animate: boolean
) {
  const item = await showOnMap(terria, resultsLayerJson(docs, name, animate));
  if (TimeVarying.is(item)) {
    if (animate) terria.timelineStack.addToTop(item);
    else terria.timelineStack.remove(item);
  }
}

export function rectangleToPolygon(rectangle: Rectangle): Polygon {
  const [west, south, east, north] = [
    rectangle.west,
    rectangle.south,
    rectangle.east,
    rectangle.north
  ].map(CesiumMath.toDegrees);
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south]
      ]
    ]
  };
}

export function pointsToPolygon(points: Cartesian3[]): Polygon | undefined {
  if (points.length < 3) return undefined;
  const ring = points.map((point) => {
    const { longitude, latitude } =
      Ellipsoid.WGS84.cartesianToCartographic(point);
    return [CesiumMath.toDegrees(longitude), CesiumMath.toDegrees(latitude)];
  });
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return { type: "Polygon", coordinates: [ring] };
}
