import bbox from "@turf/bbox";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import { JsonObject } from "../../Core/Json";
import MappableMixin from "../../ModelMixins/MappableMixin";
import addUserCatalogMember from "../../Models/Catalog/addUserCatalogMember";
import CatalogMemberFactory from "../../Models/Catalog/CatalogMemberFactory";
import CommonStrata from "../../Models/Definition/CommonStrata";
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
    geoJsonData: toResultsGeoJson(docs) as unknown as JsonObject,
    featureInfoTemplate: { template: RESULTS_TEMPLATE },
    defaultStyle: {
      color: { colorColumn: "tipo" },
      time: animate
        ? { timeColumn: "data_da", endTimeColumn: "data_a" }
        : { timeColumn: null }
    }
  };
}

async function showOnMap(terria: Terria, json: JsonObject) {
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
  await showOnMap(terria, resultsLayerJson(docs, name, animate));
}
