import { http, HttpResponse } from "msw";
import Papa from "papaparse";
import {
  ALL_FIELDS,
  distinctValues,
  filterDocuments,
  FontesCondition,
  FontesDocument,
  getFontesDocuments,
  normalizeFontesDocument,
  OPERATORS,
  parseFontesDate,
  toCsv,
  toResultsGeoJson
} from "../../../lib/ReactViews/Fontes/Fontes";
import {
  maxNativeZoom,
  tileRequest
} from "../../../lib/ReactViews/Fontes/FontesImageViewer";
import {
  rectoMapItemJson,
  resultsLayerJson,
  showResultsOnMap
} from "../../../lib/ReactViews/Fontes/fontesMap";
import Terria from "../../../lib/Models/Terria";
import UserDrawing from "../../../lib/Models/UserDrawing";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import { worker } from "../../mocks/browser";

const colorno = {
  type: "Feature",
  geometry: { type: "MultiPoint", coordinates: [[10.376, 44.929]] },
  properties: {
    id: "ASPR_MD0351",
    segnatura: "ASPR, Mappe e disegni, 68/41",
    titolo_originale: "N.D",
    titolo_archivista: "",
    titolo_schedatore: "Colorno",
    data_produzione: "1627-08-07?",
    autori: '["Smeraldi Smeraldo","Pinzoni Pietro"]',
    tematiche: "acque",
    luoghi: '[{"nome":"Colorno","prov":"PR","tipo":"toponimo"}]',
    note: "N.D.",
    larghezza_documento: 403
  }
};

describe("Fontes", function () {
  describe("normalizeFontesDocument", function () {
    it("reads the id and the first catalogued title", function () {
      const doc = normalizeFontesDocument(colorno);
      expect(doc.id).toEqual("ASPR_MD0351");
      expect(doc.title).toEqual("Colorno");
    });

    it("falls back to the id when no title was catalogued", function () {
      const doc = normalizeFontesDocument({
        type: "Feature",
        geometry: null,
        properties: { id: "ASPR_X1" }
      });
      expect(doc.title).toEqual("ASPR_X1");
    });

    it("turns list and record fields sent as JSON text into arrays", function () {
      const doc = normalizeFontesDocument(colorno);
      expect(doc.properties.autori).toEqual([
        "Smeraldi Smeraldo",
        "Pinzoni Pietro"
      ]);
      expect(doc.properties.luoghi).toEqual([
        { nome: "Colorno", prov: "PR", tipo: "toponimo" }
      ]);
    });

    it("keeps a single value of a list field as a one-item list", function () {
      expect(normalizeFontesDocument(colorno).properties.tematiche).toEqual([
        "acque"
      ]);
    });

    it("drops the values the plugin marks as not available", function () {
      const { properties } = normalizeFontesDocument(colorno);
      expect(properties.note).toBeUndefined();
      expect(properties.titolo_originale).toBeUndefined();
      expect(properties.titolo_archivista).toBeUndefined();
      expect(properties.larghezza_documento).toEqual(403);
    });

    it("resolves the production date", function () {
      expect(normalizeFontesDocument(colorno).date).toEqual({
        start: "1627-08-07",
        end: "1627-08-07"
      });
    });

    it("keeps the places geometry, or none when the document has no places", function () {
      expect(normalizeFontesDocument(colorno).geometry).toEqual(
        colorno.geometry as any
      );
      expect(
        normalizeFontesDocument({ ...colorno, geometry: null }).geometry
      ).toBeNull();
    });
  });

  describe("filterDocuments", function () {
    const point = (lon: number, lat: number) => ({
      type: "MultiPoint",
      coordinates: [[lon, lat]]
    });
    const doc = (geometry: any, properties: any) =>
      normalizeFontesDocument({ type: "Feature", geometry, properties });

    const docs: FontesDocument[] = [
      doc(point(10.376, 44.929), {
        id: "A",
        titolo_schedatore: "Colorno",
        autori: ["Smeraldi Smeraldo"],
        data_produzione: "1627-08-07?",
        documento_testuale: false,
        larghezza_documento: 403,
        luoghi: [{ nome: "Colorno", nome_storico: "Colurni" }]
      }),
      doc(point(10.0, 45.0), {
        id: "B",
        titolo_originale: "Argine del Po a Mezzano",
        autori: ["Pinzoni Pietro"],
        data_produzione: "16XX",
        documento_testuale: false,
        larghezza_documento: 250
      }),
      doc(null, {
        id: "C",
        titolo_archivista: "Lettera sul Taro",
        autori: ["Smeraldi Smeraldo", "Rossi Carlo"],
        data_produzione: "/1590",
        documento_testuale: true
      }),
      doc(point(10.33, 44.8), {
        id: "D",
        titolo_schedatore: "Pianta della Città",
        data_produzione: "1700/1750",
        documento_testuale: false
      })
    ];

    const ids = (result: FontesDocument[]) => result.map((d) => d.id);
    const condition = (
      field: string,
      operator: FontesCondition["operator"],
      value = "",
      logic: FontesCondition["logic"] = "AND"
    ): FontesCondition => ({ field, operator, value, logic });
    const search = (...conditions: FontesCondition[]) =>
      ids(filterDocuments(docs, { conditions }));

    it("keeps every document while no condition has a value", function () {
      expect(search(condition(ALL_FIELDS, "contains"))).toEqual([
        "A",
        "B",
        "C",
        "D"
      ]);
    });

    it("finds text in any field, ignoring case and accents", function () {
      expect(search(condition(ALL_FIELDS, "contains", "citta"))).toEqual(["D"]);
      expect(search(condition(ALL_FIELDS, "contains", "COLURNI"))).toEqual([
        "A"
      ]);
    });

    it("matches a list field when any of its values matches", function () {
      expect(
        search(condition("autori", "equals", "smeraldi smeraldo"))
      ).toEqual(["A", "C"]);
      expect(search(condition("autori", "contains", "pinz"))).toEqual(["B"]);
    });

    it("compares numbers", function () {
      expect(search(condition("larghezza_documento", "gt", "300"))).toEqual([
        "A"
      ]);
      expect(search(condition("larghezza_documento", "lt", "300"))).toEqual([
        "B"
      ]);
      expect(search(condition("larghezza_documento", "equals", "403"))).toEqual(
        ["A"]
      );
    });

    it("filters yes/no fields", function () {
      expect(search(condition("documento_testuale", "true"))).toEqual(["C"]);
      expect(search(condition("documento_testuale", "false"))).toEqual([
        "A",
        "B",
        "D"
      ]);
    });

    it("finds documents whose date overlaps the requested FONTES date", function () {
      expect(
        search(condition("data_produzione", "period", "1600/1650"))
      ).toEqual(["A", "B"]);
      expect(
        search(condition("data_produzione", "period", "1500/1550"))
      ).toEqual(["C"]);
      expect(search(condition("data_produzione", "period", "1740/"))).toEqual([
        "D"
      ]);
    });

    it("matches nothing for a value that is not a FONTES date", function () {
      expect(search(condition("data_produzione", "period", "16"))).toEqual([]);
    });

    it("joins each condition to the next with AND, OR or AND NOT", function () {
      const smeraldi = condition("autori", "equals", "Smeraldi Smeraldo");
      const textual = condition("documento_testuale", "true");
      expect(search({ ...smeraldi, logic: "AND" }, textual)).toEqual(["C"]);
      expect(search({ ...smeraldi, logic: "AND NOT" }, textual)).toEqual(["A"]);
      expect(
        search(
          condition("larghezza_documento", "gt", "300", "OR"),
          condition("documento_testuale", "true")
        )
      ).toEqual(["A", "C"]);
    });

    it("evaluates the conditions from left to right, without precedence", function () {
      expect(
        search(
          condition("autori", "equals", "Pinzoni Pietro", "OR"),
          condition("documento_testuale", "true", "", "AND"),
          condition("data_produzione", "period", "1500/1590")
        )
      ).toEqual(["C"]);
    });

    it("skips conditions without a value when joining the others", function () {
      expect(
        search(
          condition("autori", "equals", "Pinzoni Pietro", "OR"),
          condition("titolo_originale", "contains", "", "AND"),
          condition("documento_testuale", "true")
        )
      ).toEqual(["B", "C"]);
    });

    it("keeps the documents of the requested years", function () {
      const years = (from?: number, to?: number) =>
        ids(filterDocuments(docs, { conditions: [], period: { from, to } }));
      expect(years(1600, 1650)).toEqual(["A", "B"]);
      expect(years(undefined, 1595)).toEqual(["C"]);
      expect(years(1720)).toEqual(["D"]);
    });

    it("keeps the documents with a place inside the area", function () {
      const area = {
        type: "Polygon" as const,
        coordinates: [
          [
            [10.3, 44.9],
            [10.45, 44.9],
            [10.45, 44.96],
            [10.3, 44.96],
            [10.3, 44.9]
          ]
        ]
      };
      expect(ids(filterDocuments(docs, { conditions: [], area }))).toEqual([
        "A"
      ]);
    });

    it("lists the distinct values of a field for autocompletion", function () {
      expect(distinctValues(docs, "autori")).toEqual([
        "Pinzoni Pietro",
        "Rossi Carlo",
        "Smeraldi Smeraldo"
      ]);
      expect(distinctValues(docs, "luoghi")).toEqual(["Colorno", "Colurni"]);
      expect(distinctValues(docs, ALL_FIELDS)).toEqual([]);
    });

    it("offers the operators that make sense for each field type", function () {
      expect(OPERATORS.text).toEqual(["contains", "equals"]);
      expect(OPERATORS.list).toEqual(["contains", "equals"]);
      expect(OPERATORS.objects).toEqual(["contains", "equals"]);
      expect(OPERATORS.number).toEqual(["equals", "lt", "gt"]);
      expect(OPERATORS.bool).toEqual(["true", "false"]);
      expect(OPERATORS.date).toEqual(["period"]);
    });
  });

  describe("results export", function () {
    const doc = (geometry: any, properties: any) =>
      normalizeFontesDocument({ type: "Feature", geometry, properties });
    const mapped = doc(
      { type: "MultiPoint", coordinates: [[10.376, 44.929]] },
      {
        id: "A",
        segnatura: "ASPR, Mappe e disegni, 68/41",
        titolo_schedatore: "Colorno",
        data_produzione: "/1590",
        documento_testuale: false,
        autori: ["Smeraldi Smeraldo", "Rossi Carlo"],
        luoghi: [{ nome: "Colorno", prov: "PR" }],
        larghezza_documento: 403
      }
    );
    const textual = doc(null, {
      id: "B",
      titolo_originale: "Lettera",
      documento_testuale: true
    });
    const undated = doc(
      { type: "MultiPoint", coordinates: [[10, 45]] },
      { id: "C", titolo_originale: "Senza data" }
    );

    it("puts the documents that have places on the map", function () {
      const geojson = toResultsGeoJson([mapped, textual, undated]);
      expect(geojson.features.map((f) => f.properties?.id)).toEqual(["A", "C"]);
      expect(geojson.features[0].geometry).toEqual(mapped.geometry as any);
      expect(geojson.features[0].properties).toEqual(
        jasmine.objectContaining({
          id: "A",
          titolo: "Colorno",
          segnatura: "ASPR, Mappe e disegni, 68/41",
          data_produzione: "/1590",
          tipo: "Mappa"
        })
      );
    });

    it("closes open dates at the bounds of the FONTES calendar for the timeline", function () {
      const [feature] = toResultsGeoJson([mapped]).features;
      expect(feature.properties?.data_da).toEqual("1000-01-01");
      expect(feature.properties?.data_a).toEqual("1590-12-31");
    });

    it("leaves the timeline dates empty for undated documents", function () {
      const [feature] = toResultsGeoJson([undated]).features;
      expect(feature.properties?.data_da).toBeUndefined();
      expect(feature.properties?.data_a).toBeUndefined();
    });

    it("writes a CSV for Excel: BOM, semicolons, field labels as header", function () {
      const csv = toCsv([mapped, textual]);
      expect(csv.charAt(0)).toEqual("﻿");
      const rows = Papa.parse<string[]>(csv.slice(1), { delimiter: ";" }).data;
      expect(rows[0].slice(0, 4)).toEqual([
        "ID",
        "Documento testuale",
        "Collocazione",
        "Segnatura"
      ]);
      expect(rows.length).toEqual(3);
    });

    it("fits lists, records and yes/no values in single cells", function () {
      const [header, row] = Papa.parse<string[]>(toCsv([mapped]).slice(1), {
        delimiter: ";"
      }).data;
      const cell = (label: string) => row[header.indexOf(label)];
      expect(cell("Autori")).toEqual("Smeraldi Smeraldo, Rossi Carlo");
      expect(cell("Luoghi")).toEqual("Colorno PR");
      expect(cell("Documento testuale")).toEqual("No");
      expect(cell("Larghezza del documento")).toEqual("403");
      expect(cell("Note")).toEqual("");
    });

    it("neutralises text a spreadsheet would run as a formula", function () {
      const risky = doc(null, { id: "R", note: '=HYPERLINK("http://x")' });
      const [header, row] = Papa.parse<string[]>(toCsv([risky]).slice(1), {
        delimiter: ";"
      }).data;
      expect(row[header.indexOf("Note")]).toEqual('\'=HYPERLINK("http://x")');
    });
  });

  describe("fontesConfig", function () {
    const config = {
      documentsUrl: "test/fontes/documenti.geojson",
      wmsUrl: "https://example.com/geoserver/fontes/wms"
    };

    it("is off unless the map configures it", function () {
      expect(new Terria().configParameters.fontesConfig).toBeUndefined();
    });

    it("comes from the map config", function () {
      const terria = new Terria();
      terria.updateParameters({ fontesConfig: config });
      expect(terria.configParameters.fontesConfig).toEqual(config);
    });

    it("can come from an init file, like microzonationConfig", async function () {
      const terria = new Terria();
      await terria.applyInitData({
        initData: { parameters: { fontesConfig: config } }
      });
      expect(terria.configParameters.fontesConfig).toEqual(config);
    });
  });

  describe("view state", function () {
    let viewState: ViewState;
    beforeEach(function () {
      viewState = new ViewState({ terria: new Terria() });
    });

    it("toggles the search panel", function () {
      expect(viewState.fontesPanelShown).toBe(false);
      viewState.toggleFontesPanel();
      expect(viewState.fontesPanelShown).toBe(true);
      viewState.toggleFontesPanel();
      expect(viewState.fontesPanelShown).toBe(false);
    });

    it("opens a document window in front of the other panels", function () {
      viewState.openFontesDocument("ASPR_MD0351");
      expect(viewState.fontesDocumentId).toEqual("ASPR_MD0351");
      expect(viewState.topElement).toEqual("FontesDocument");
    });

    it("closes the document window", function () {
      viewState.openFontesDocument("ASPR_MD0351");
      viewState.closeFontesDocument();
      expect(viewState.fontesDocumentId).toBeUndefined();
    });
  });

  describe("COG tiles of the image viewer", function () {
    const levels = [
      { width: 1000, height: 600 },
      { width: 500, height: 300 },
      { width: 250, height: 150 }
    ];

    it("zooms in until one image pixel fills one screen pixel", function () {
      expect(maxNativeZoom(23647, 19689)).toEqual(7);
      expect(maxNativeZoom(256, 100)).toEqual(0);
      expect(maxNativeZoom(257, 100)).toEqual(1);
    });

    it("reads full resolution pixels at the native zoom", function () {
      expect(tileRequest({ x: 0, y: 0, z: 2 }, levels)).toEqual({
        level: 0,
        window: [0, 0, 256, 256],
        width: 256,
        height: 256
      });
    });

    it("crops the tiles on the right and bottom edges", function () {
      expect(tileRequest({ x: 3, y: 2, z: 2 }, levels)).toEqual({
        level: 0,
        window: [768, 512, 1000, 600],
        width: 232,
        height: 88
      });
    });

    it("reads the overview that matches a lower zoom", function () {
      expect(tileRequest({ x: 0, y: 0, z: 0 }, levels)).toEqual({
        level: 2,
        window: [0, 0, 250, 150],
        width: 250,
        height: 150
      });
      expect(tileRequest({ x: 1, y: 0, z: 1 }, levels)).toEqual({
        level: 1,
        window: [256, 0, 500, 256],
        width: 244,
        height: 256
      });
    });

    it("magnifies full resolution pixels beyond the native zoom", function () {
      expect(tileRequest({ x: 1, y: 0, z: 3 }, levels)).toEqual({
        level: 0,
        window: [128, 0, 256, 128],
        width: 256,
        height: 256
      });
    });

    it("requests nothing outside the image", function () {
      expect(tileRequest({ x: 4, y: 0, z: 2 }, levels)).toBeUndefined();
      expect(tileRequest({ x: 0, y: 3, z: 2 }, levels)).toBeUndefined();
      expect(tileRequest({ x: -1, y: 0, z: 2 }, levels)).toBeUndefined();
    });
  });

  describe("map layers", function () {
    const config = {
      documentsUrl: "documenti.geojson",
      wmsUrl: "https://example.com/geoserver/fontes/wms"
    };
    const georeferenced = normalizeFontesDocument({
      type: "Feature",
      geometry: { type: "MultiPoint", coordinates: [[10.376, 44.929]] },
      properties: {
        id: "A",
        titolo_schedatore: "Colorno",
        recto_georef: true,
        recto_wms_layer: "fontes:A_r",
        recto_cog_url: "https://example.com/cog/A_r.tif",
        data_produzione: "1627"
      }
    });

    it("overlays a georeferenced recto from the WMS when it is published there", function () {
      expect(rectoMapItemJson(georeferenced, config)).toEqual({
        id: "fontes-A-recto",
        type: "wms",
        name: "A – Colorno",
        url: "https://example.com/geoserver/fontes/wms",
        layers: "fontes:A_r"
      });
    });

    it("falls back to the COG of a georeferenced recto", function () {
      expect(
        rectoMapItemJson(georeferenced, { documentsUrl: "documenti.geojson" })
      ).toEqual({
        id: "fontes-A-recto",
        type: "cog",
        name: "A – Colorno",
        url: "https://example.com/cog/A_r.tif"
      });
    });

    it("has nothing to overlay for a recto that is not georeferenced", function () {
      const scan = normalizeFontesDocument({
        type: "Feature",
        geometry: null,
        properties: {
          id: "B",
          recto_cog_url: "https://example.com/cog/B_r.tif"
        }
      });
      expect(rectoMapItemJson(scan, config)).toBeUndefined();
    });

    it("shows the results as one layer coloured by document type", function () {
      const json = resultsLayerJson([georeferenced], "Risultati", false);
      expect(json.id).toEqual("fontes-risultati");
      expect(json.type).toEqual("geojson");
      expect(json.name).toEqual("Risultati");
      expect(json.geoJsonData).toEqual(
        toResultsGeoJson([georeferenced]) as any
      );
      expect((json.featureInfoTemplate as any).template).toContain(
        '<fontes-document id="{{id}}">'
      );
      expect((json.defaultStyle as any).color.colorColumn).toEqual("tipo");
      expect(json.activeStyle).toEqual("tipo");
      expect(
        (json.defaultStyle as any).color.enumColors.map((c: any) => c.value)
      ).toEqual(["Mappa", "Documento testuale"]);
    });

    it("updates the results layer of a new search instead of adding another", async function () {
      const terria = new Terria();
      await showResultsOnMap(terria, [georeferenced], "Risultati", false);
      await showResultsOnMap(terria, [georeferenced], "Risultati", true);
      expect(
        terria.workbench.items.filter((i) => i.uniqueId === "fontes-risultati")
          .length
      ).toEqual(1);
      expect(
        terria.catalog.userAddedDataGroup.members.filter(
          (id) => id === "fontes-risultati"
        ).length
      ).toEqual(1);
    });

    it("animates only the documents that have a date", function () {
      const undated = normalizeFontesDocument({
        type: "Feature",
        geometry: { type: "MultiPoint", coordinates: [[10, 45]] },
        properties: { id: "U" }
      });
      const features = (json: any) => json.geoJsonData.features.length;
      expect(
        features(resultsLayerJson([georeferenced, undated], "R", false))
      ).toEqual(2);
      expect(
        features(resultsLayerJson([georeferenced, undated], "R", true))
      ).toEqual(1);
    });

    it("leaves the timeline off unless asked to animate the results in time", function () {
      expect(
        (resultsLayerJson([georeferenced], "R", false).defaultStyle as any).time
      ).toEqual({ timeColumn: null });
      expect(
        (resultsLayerJson([georeferenced], "R", true).defaultStyle as any).time
      ).toEqual({
        timeColumn: "data_da",
        endTimeColumn: "data_a",
        idColumns: ["id"]
      });
      expect(
        resultsLayerJson([georeferenced], "R", true).initialTimeSource
      ).toEqual("start");
    });
  });

  describe("drawing a search area", function () {
    it("shows the dialog whose button finishes the drawing", function () {
      const terria = new Terria();
      new UserDrawing({ terria, allowPolygon: true }).enterDrawMode();
      expect(terria.mapInteractionModeStack.at(-1)?.invisible).toBeFalsy();
    });

    it("still hides it for tools that bring their own panel", function () {
      const terria = new Terria();
      new UserDrawing({ terria, invisible: true }).enterDrawMode();
      expect(terria.mapInteractionModeStack.at(-1)?.invisible).toBe(true);
    });
  });

  describe("getFontesDocuments", function () {
    it("loads the documents once per url", async function () {
      const url = "https://example.com/fontes/once.json";
      let requests = 0;
      worker.use(
        http.get(url, () => {
          requests++;
          return HttpResponse.json({
            type: "FeatureCollection",
            features: [colorno]
          });
        })
      );

      const first = await getFontesDocuments(url);
      const second = await getFontesDocuments(url);

      expect(first.map((doc) => doc.id)).toEqual(["ASPR_MD0351"]);
      expect(second).toBe(first);
      expect(requests).toEqual(1);
    });

    it("tries again after a failed load", async function () {
      const url = "https://example.com/fontes/retry.json";
      worker.use(
        http.get(url, () => new HttpResponse(null, { status: 500 }), {
          once: true
        }),
        http.get(url, () =>
          HttpResponse.json({ type: "FeatureCollection", features: [colorno] })
        )
      );

      await expectAsync(getFontesDocuments(url)).toBeRejected();
      expect((await getFontesDocuments(url)).length).toEqual(1);
    });
  });

  describe("parseFontesDate", function () {
    it("expands certain dates to the days they cover", function () {
      expect(parseFontesDate("1985-04-12")).toEqual({
        start: "1985-04-12",
        end: "1985-04-12"
      });
      expect(parseFontesDate("1985-04")).toEqual({
        start: "1985-04-01",
        end: "1985-04-30"
      });
      expect(parseFontesDate("1985")).toEqual({
        start: "1985-01-01",
        end: "1985-12-31"
      });
    });

    it("ends February on the right day in leap and common years", function () {
      expect(parseFontesDate("2004-02")?.end).toEqual("2004-02-29");
      expect(parseFontesDate("2000-02")?.end).toEqual("2000-02-29");
      expect(parseFontesDate("1900-02")?.end).toEqual("1900-02-28");
      expect(parseFontesDate("1627-02")?.end).toEqual("1627-02-28");
    });

    it("keeps the range of uncertain dates", function () {
      expect(parseFontesDate("1985-04-12?")).toEqual({
        start: "1985-04-12",
        end: "1985-04-12"
      });
      expect(parseFontesDate("1985-04?")).toEqual({
        start: "1985-04-01",
        end: "1985-04-30"
      });
      expect(parseFontesDate("1985?")).toEqual({
        start: "1985-01-01",
        end: "1985-12-31"
      });
    });

    it("turns imprecise years into the decade or century they cover", function () {
      expect(parseFontesDate("198X")).toEqual({
        start: "1980-01-01",
        end: "1989-12-31"
      });
      expect(parseFontesDate("19XX")).toEqual({
        start: "1900-01-01",
        end: "1999-12-31"
      });
    });

    it("completes both ends of a date interval", function () {
      expect(parseFontesDate("1964/2008")).toEqual({
        start: "1964-01-01",
        end: "2008-12-31"
      });
      expect(parseFontesDate("2004-06/2006-08")).toEqual({
        start: "2004-06-01",
        end: "2006-08-31"
      });
      expect(parseFontesDate("2004-02-01/2005-02-08")).toEqual({
        start: "2004-02-01",
        end: "2005-02-08"
      });
      expect(parseFontesDate("2004-02-01/2005-02")).toEqual({
        start: "2004-02-01",
        end: "2005-02-28"
      });
      expect(parseFontesDate("2004-02-01/2005")).toEqual({
        start: "2004-02-01",
        end: "2005-12-31"
      });
      expect(parseFontesDate("2005/2006-02")).toEqual({
        start: "2005-01-01",
        end: "2006-02-28"
      });
    });

    it("leaves the start open for ante quem dates", function () {
      expect(parseFontesDate("/1985-04-12")).toEqual({
        start: undefined,
        end: "1985-04-12"
      });
      expect(parseFontesDate("/1985-04")?.end).toEqual("1985-04-30");
      expect(parseFontesDate("/1985")?.end).toEqual("1985-12-31");
    });

    it("leaves the end open for post quem dates", function () {
      expect(parseFontesDate("1985-04-12/")).toEqual({
        start: "1985-04-12",
        end: undefined
      });
      expect(parseFontesDate("1985-04/")?.start).toEqual("1985-04-01");
      expect(parseFontesDate("1985/")?.start).toEqual("1985-01-01");
    });

    it("ignores surrounding spaces", function () {
      expect(parseFontesDate(" 1985 ")?.start).toEqual("1985-01-01");
    });

    it("rejects what the QGIS plugin rejects", function () {
      [
        "",
        "abc",
        "0985",
        "3000",
        "1985-13",
        "1985-00",
        "1985-04-32",
        "198XX",
        "1X",
        "1985?/1990",
        "/",
        "1985//1990"
      ].forEach((text) =>
        expect(parseFontesDate(text)).withContext(text).toBeUndefined()
      );
    });

    it("rejects intervals that do not move forward", function () {
      expect(parseFontesDate("1985/1984")).toBeUndefined();
      expect(parseFontesDate("1985/1985")).toBeUndefined();
      expect(parseFontesDate("2005-06/2005")).toBeUndefined();
    });

    it("rejects days that do not exist in the calendar", function () {
      expect(parseFontesDate("2004-02-30")).toBeUndefined();
      expect(parseFontesDate("1900-02-29")).toBeUndefined();
      expect(parseFontesDate("2004-04-31/2005")).toBeUndefined();
    });
  });
});
