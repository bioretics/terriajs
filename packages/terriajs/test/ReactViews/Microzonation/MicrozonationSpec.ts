import { http, HttpResponse } from "msw";
import {
  computeGeometryBBox,
  emptyFilters,
  fetchWfsDocuments,
  fetchWfsFeatures,
  filterRecords,
  formatDate,
  formatValue,
  getDetailFromProperties,
  getRecordId,
  MicrozonationRecord,
  normalizeCleStatus,
  normalizeDetail,
  normalizeMicrozonationLevel,
  normalizeRecord,
  uniqueSorted,
  WfsConfig
} from "../../../lib/ReactViews/Microzonation/Microzonation";
import { worker } from "../../mocks/browser";

const WFS_URL = "https://example.com/geoserver/wfs";

const wfsConfig: WfsConfig = {
  url: WFS_URL,
  projectsLayerName: "rer:stato_progetti",
  documentsLayerName: "rer:documenti"
};

function record(
  overrides: Partial<MicrozonationRecord> = {}
): MicrozonationRecord {
  return {
    id: 1,
    province: "BO",
    municipality: "Bologna",
    microzonation: "3",
    cle: "done",
    ...overrides
  };
}

describe("Microzonation", function () {
  describe("formatValue", function () {
    it("shows a dash for values the service left empty", function () {
      expect(formatValue(null)).toEqual("-");
      expect(formatValue(undefined)).toEqual("-");
      expect(formatValue("")).toEqual("-");
    });

    it("stringifies anything else", function () {
      expect(formatValue("Bologna")).toEqual("Bologna");
      expect(formatValue(0)).toEqual("0");
      expect(formatValue(false)).toEqual("false");
    });
  });

  describe("formatDate", function () {
    it("shows a dash when there is no date", function () {
      expect(formatDate()).toEqual("-");
      expect(formatDate("")).toEqual("-");
    });

    it("formats an ISO date the Italian way", function () {
      expect(formatDate("2023-04-05")).toEqual(
        new Date("2023-04-05").toLocaleDateString("it-IT")
      );
    });

    it("passes through text that is not a date", function () {
      expect(formatDate("not a date")).toEqual("not a date");
    });
  });

  describe("normalizeMicrozonationLevel", function () {
    it("keeps the three known study levels", function () {
      expect(normalizeMicrozonationLevel("1")).toEqual("1");
      expect(normalizeMicrozonationLevel("2")).toEqual("2");
      expect(normalizeMicrozonationLevel(3)).toEqual("3");
    });

    it("tolerates surrounding whitespace", function () {
      expect(normalizeMicrozonationLevel(" 2 ")).toEqual("2");
    });

    it("reports anything else as no study", function () {
      expect(normalizeMicrozonationLevel(null)).toEqual("no");
      expect(normalizeMicrozonationLevel(undefined)).toEqual("no");
      expect(normalizeMicrozonationLevel("")).toEqual("no");
      expect(normalizeMicrozonationLevel("4")).toEqual("no");
    });
  });

  describe("normalizeCleStatus", function () {
    it("reads S as done, case insensitively", function () {
      expect(normalizeCleStatus("S")).toEqual("done");
      expect(normalizeCleStatus("s")).toEqual("done");
      expect(normalizeCleStatus(" s ")).toEqual("done");
    });

    it("reports anything else as not done", function () {
      expect(normalizeCleStatus("N")).toEqual("no");
      expect(normalizeCleStatus(null)).toEqual("no");
      expect(normalizeCleStatus("")).toEqual("no");
    });
  });

  describe("uniqueSorted", function () {
    it("removes duplicates and sorts alphabetically", function () {
      expect(uniqueSorted(["Rimini", "Bologna", "Rimini"])).toEqual([
        "Bologna",
        "Rimini"
      ]);
    });

    it("drops empty entries", function () {
      expect(uniqueSorted(["Bologna", undefined, ""])).toEqual(["Bologna"]);
    });

    it("sorts using Italian collation rather than code points", function () {
      expect(uniqueSorted(["Zola", "Àlbaro", "bologna"])).toEqual([
        "Àlbaro",
        "bologna",
        "Zola"
      ]);
    });
  });

  describe("getRecordId", function () {
    it("uses the service id when present", function () {
      expect(getRecordId(record({ id: 42 }))).toEqual(42);
    });

    it("falls back to a composite key when there is no id", function () {
      expect(getRecordId(record({ id: undefined }))).toEqual(
        "BO-Bologna-3-done"
      );
    });

    it("tolerates a record with no fields at all", function () {
      expect(getRecordId({})).toEqual("---");
    });
  });

  describe("filterRecords", function () {
    const records = [
      record({ id: 1, province: "BO", municipality: "Bologna" }),
      record({ id: 2, province: "BO", municipality: "Imola", cle: "no" }),
      record({
        id: 3,
        province: "RN",
        municipality: "Rimini",
        microzonation: "1"
      })
    ];

    it("returns everything when no filter is set", function () {
      expect(filterRecords(records, emptyFilters).length).toEqual(3);
    });

    it("filters by province", function () {
      const filtered = filterRecords(records, {
        ...emptyFilters,
        province: "RN"
      });
      expect(filtered.map((r) => r.id)).toEqual([3]);
    });

    it("filters by municipality", function () {
      const filtered = filterRecords(records, {
        ...emptyFilters,
        municipality: "Imola"
      });
      expect(filtered.map((r) => r.id)).toEqual([2]);
    });

    it("filters by microzonation level", function () {
      const filtered = filterRecords(records, {
        ...emptyFilters,
        microzonation: "1"
      });
      expect(filtered.map((r) => r.id)).toEqual([3]);
    });

    it("filters by CLE status", function () {
      const filtered = filterRecords(records, { ...emptyFilters, cle: "no" });
      expect(filtered.map((r) => r.id)).toEqual([2]);
    });

    it("combines filters", function () {
      const filtered = filterRecords(records, {
        ...emptyFilters,
        province: "BO",
        cle: "done"
      });
      expect(filtered.map((r) => r.id)).toEqual([1]);
    });

    it("returns nothing when the filters match no record", function () {
      const filtered = filterRecords(records, {
        ...emptyFilters,
        province: "BO",
        municipality: "Rimini"
      });
      expect(filtered).toEqual([]);
    });
  });

  describe("computeGeometryBBox", function () {
    it("returns undefined without a geometry", function () {
      expect(computeGeometryBBox(undefined)).toBeUndefined();
      expect(computeGeometryBBox({})).toBeUndefined();
    });

    it("returns a degenerate box for a point", function () {
      const bbox = computeGeometryBBox({
        type: "Point",
        coordinates: [11.34, 44.49]
      });
      expect(bbox).toEqual({
        west: 11.34,
        south: 44.49,
        east: 11.34,
        north: 44.49
      });
    });

    it("wraps every vertex of a polygon", function () {
      const bbox = computeGeometryBBox({
        type: "Polygon",
        coordinates: [
          [
            [11.0, 44.0],
            [12.0, 44.0],
            [12.0, 45.0],
            [11.0, 45.0],
            [11.0, 44.0]
          ]
        ]
      });
      expect(bbox).toEqual({ west: 11, south: 44, east: 12, north: 45 });
    });

    it("wraps every part of a multipolygon", function () {
      const bbox = computeGeometryBBox({
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [11.0, 44.0],
              [11.5, 44.5]
            ]
          ],
          [
            [
              [12.0, 43.5],
              [12.5, 45.0]
            ]
          ]
        ]
      });
      expect(bbox).toEqual({ west: 11, south: 43.5, east: 12.5, north: 45 });
    });

    it("returns undefined for an empty coordinate list", function () {
      expect(
        computeGeometryBBox({ type: "Polygon", coordinates: [] })
      ).toBeUndefined();
    });
  });

  describe("normalizeRecord", function () {
    it("maps the service field names onto the record shape", function () {
      expect(
        normalizeRecord({
          id_stato_progetto: 7,
          prov: "BO",
          comune: "Bologna",
          microzonazione: "3",
          ordinanza: "OCDPC 780/2021",
          cle_convalida: "S",
          cle_ordinanza: "OCDPC 171/2014",
          piano_prot_civile: "Approvato"
        })
      ).toEqual({
        id: 7,
        province: "BO",
        municipality: "Bologna",
        microzonation: "3",
        msOrdinance: "OCDPC 780/2021",
        cle: "done",
        cleOrdinance: "OCDPC 171/2014",
        municipalPlan: "Approvato"
      });
    });

    it("falls back to the gid when there is no project id", function () {
      expect(normalizeRecord({ gid: 99 }).id).toEqual(99);
    });

    it("defaults missing text fields to empty strings", function () {
      const normalized = normalizeRecord({});
      expect(normalized.province).toEqual("");
      expect(normalized.municipality).toEqual("");
      expect(normalized.msOrdinance).toEqual("");
      expect(normalized.microzonation).toEqual("no");
      expect(normalized.cle).toEqual("no");
    });
  });

  describe("normalizeDetail", function () {
    it("groups the service fields into the detail sections", function () {
      const detail = normalizeDetail({
        prov: "BO",
        comune: "Bologna",
        cod_istat: 37006,
        note: "some notes",
        microzonazione: "2",
        ordinanza: "OCDPC 780/2021",
        convalidato: "S",
        mzs_standard: "3.0",
        cle_convalida: "S",
        cle_ordinanza: "OCDPC 171/2014",
        cle_standard: "2.0",
        piano_prot_civile: "Approvato",
        link_ppc_comune: "https://example.com/ppc"
      });

      expect(detail.generalInfo).toEqual({
        province: "BO",
        municipality: "Bologna",
        istatCode: "37006",
        notes: "some notes"
      });
      expect(detail.microzonation.microzonation).toEqual("2");
      expect(detail.cle.cle).toEqual("done");
      expect(detail.civilProtectionPlan).toEqual({
        municipalPlan: "Approvato",
        link: "https://example.com/ppc"
      });
    });

    it("stringifies the ISTAT code so leading structure is kept", function () {
      expect(normalizeDetail({ cod_istat: 0 }).generalInfo.istatCode).toEqual(
        "0"
      );
    });

    it("leaves the ISTAT code empty when the service omits it", function () {
      expect(normalizeDetail({}).generalInfo.istatCode).toEqual("");
    });
  });

  describe("getDetailFromProperties", function () {
    it("builds the detail from the properties cached for that record", function () {
      const propertiesById = new Map<string | number, any>([
        [1, { prov: "BO", comune: "Bologna", microzonazione: "3" }]
      ]);
      const detail = getDetailFromProperties(propertiesById, record({ id: 1 }));
      expect(detail.generalInfo.municipality).toEqual("Bologna");
      expect(detail.microzonation.microzonation).toEqual("3");
    });

    it("returns an empty detail for a record with no cached properties", function () {
      const detail = getDetailFromProperties(new Map(), record({ id: 404 }));
      expect(detail.generalInfo.municipality).toEqual("");
      expect(detail.microzonation.microzonation).toEqual("no");
    });
  });

  describe("fetchWfsFeatures", function () {
    it("returns nothing when the map is not configured for microzonation", async function () {
      const result = await fetchWfsFeatures(undefined);
      expect(result.records).toEqual([]);
      expect(result.propertiesById.size).toEqual(0);
      expect(result.geometryById.size).toEqual(0);
    });

    it("requests the projects layer as GeoJSON in EPSG:4326", async function () {
      let params: URLSearchParams | undefined;
      worker.use(
        http.get(WFS_URL, ({ request }) => {
          params = new URL(request.url).searchParams;
          return HttpResponse.json({ features: [] });
        })
      );

      await fetchWfsFeatures(wfsConfig);

      expect(params?.get("service")).toEqual("WFS");
      expect(params?.get("request")).toEqual("GetFeature");
      expect(params?.get("typeName")).toEqual("rer:stato_progetti");
      expect(params?.get("outputFormat")).toEqual("application/json");
      expect(params?.get("srsName")).toEqual("EPSG:4326");
    });

    it("normalizes each feature and indexes it by record id", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [
              {
                properties: {
                  id_stato_progetto: 1,
                  prov: "BO",
                  comune: "Bologna",
                  microzonazione: "3",
                  cle_convalida: "S"
                },
                geometry: { type: "Point", coordinates: [11.34, 44.49] }
              }
            ]
          })
        )
      );

      const result = await fetchWfsFeatures(wfsConfig);

      expect(result.records.length).toEqual(1);
      expect(result.records[0].municipality).toEqual("Bologna");
      expect(result.propertiesById.get(1).prov).toEqual("BO");
      expect(result.geometryById.get(1).type).toEqual("Point");
    });

    it("keeps a record without geometry out of the geometry index", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [{ properties: { id_stato_progetto: 1 } }]
          })
        )
      );

      const result = await fetchWfsFeatures(wfsConfig);

      expect(result.records.length).toEqual(1);
      expect(result.geometryById.size).toEqual(0);
    });

    it("copes with a response that carries no features", async function () {
      worker.use(http.get(WFS_URL, () => HttpResponse.json({})));

      const result = await fetchWfsFeatures(wfsConfig);

      expect(result.records).toEqual([]);
    });
  });

  describe("fetchWfsDocuments", function () {
    it("returns nothing without a config or a project id", async function () {
      expect(await fetchWfsDocuments(undefined, 1)).toEqual([]);
      expect(await fetchWfsDocuments(wfsConfig, undefined)).toEqual([]);
    });

    it("returns nothing when no documents layer is configured", async function () {
      expect(
        await fetchWfsDocuments(
          { url: WFS_URL, projectsLayerName: "rer:stato_progetti" },
          1
        )
      ).toEqual([]);
    });

    it("filters the documents layer by project id", async function () {
      let params: URLSearchParams | undefined;
      worker.use(
        http.get(WFS_URL, ({ request }) => {
          params = new URL(request.url).searchParams;
          return HttpResponse.json({ features: [] });
        })
      );

      await fetchWfsDocuments(wfsConfig, 7);

      expect(params?.get("typeName")).toEqual("rer:documenti");
      expect(params?.get("CQL_FILTER")).toEqual("id_stato_progetto=7");
    });

    it("normalizes each document and derives its format from the link", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [
              {
                id: "doc.1",
                properties: {
                  link: "https://example.com/relazione.pdf",
                  tipo_documento: "Relazione",
                  descrizione_file: "Relazione illustrativa",
                  validita_inizio: "2021-01-01",
                  validita_fine: null
                }
              }
            ]
          })
        )
      );

      const documents = await fetchWfsDocuments(wfsConfig, 7);

      expect(documents.length).toEqual(1);
      expect(documents[0]).toEqual({
        id: "doc.1",
        url: "https://example.com/relazione.pdf",
        typeDoc: "Relazione",
        desc: "Relazione illustrativa",
        docFormat: "pdf",
        startDate: "2021-01-01",
        endDate: undefined
      });
    });

    it("keeps an end date when the document has one", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [
              {
                properties: {
                  link: "https://example.com/a.pdf",
                  validita_fine: "2024-12-31"
                }
              }
            ]
          })
        )
      );

      const documents = await fetchWfsDocuments(wfsConfig, 7);

      expect(documents[0].endDate).toEqual("2024-12-31");
    });

    it("drops documents that carry no link", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [
              { properties: { link: "" } },
              { properties: { link: null } },
              { properties: {} },
              { properties: { link: "https://example.com/a.pdf" } }
            ]
          })
        )
      );

      const documents = await fetchWfsDocuments(wfsConfig, 7);

      expect(documents.length).toEqual(1);
      expect(documents[0].url).toEqual("https://example.com/a.pdf");
    });

    it("falls back to the file description then the index for the document id", async function () {
      worker.use(
        http.get(WFS_URL, () =>
          HttpResponse.json({
            features: [
              {
                properties: {
                  link: "https://example.com/a.pdf",
                  descrizione_file: "Relazione"
                }
              },
              { properties: { link: "https://example.com/b.pdf" } }
            ]
          })
        )
      );

      const documents = await fetchWfsDocuments(wfsConfig, 7);

      expect(documents[0].id).toEqual("Relazione");
      expect(documents[1].id).toEqual("1");
    });
  });
});
