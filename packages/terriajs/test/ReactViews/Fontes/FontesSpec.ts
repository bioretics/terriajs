import { http, HttpResponse } from "msw";
import {
  getFontesDocuments,
  normalizeFontesDocument,
  parseFontesDate
} from "../../../lib/ReactViews/Fontes/Fontes";
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
