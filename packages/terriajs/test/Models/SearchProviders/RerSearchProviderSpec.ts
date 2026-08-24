import { http, HttpResponse } from "msw";
import { runInAction } from "mobx";
import LocationSearchProviderMixin from "../../../lib/ModelMixins/SearchProviders/LocationSearchProviderMixin";
import CommonStrata from "../../../lib/Models/Definition/CommonStrata";
import RerSearchProvider from "../../../lib/Models/SearchProviders/RerSearchProvider";
import Terria from "../../../lib/Models/Terria";
import { worker } from "../../mocks/browser";

const SERVICE_URL =
  "https://servizigis.regione.emilia-romagna.it/normalizzatore";

function record(overrides: Record<string, string> = {}) {
  return {
    sTRADARIO_ID: "1",
    cIVICO_X: "",
    cENTR_X: "11.34",
    cIVICO_Y: "",
    cENTR_Y: "44.49",
    dUG: "VIA",
    dENOMINAZIONE: "INDIPENDENZA",
    dESCRIZIONE_CIVICO: "",
    cOMUNE: "BOLOGNA",
    pROVINCIA: "BO",
    gR_AFFIDABILITA: "1",
    ...overrides
  };
}

describe("RerSearchProvider", function () {
  let terria: Terria;
  let rerSearchProvider: RerSearchProvider;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    rerSearchProvider = new RerSearchProvider("test", terria);
    runInAction(() => {
      rerSearchProvider.setTrait(CommonStrata.definition, "url", SERVICE_URL);
      rerSearchProvider.setTrait(CommonStrata.definition, "minCharacters", 3);
    });
  });

  it(" - properly mixed", function () {
    expect(
      LocationSearchProviderMixin.isMixedInto(rerSearchProvider)
    ).toBeTruthy();
  });

  it(" - has a type", function () {
    expect(RerSearchProvider.type).toEqual("rer-search-provider");
    expect(rerSearchProvider.type).toEqual("rer-search-provider");
  });

  describe("service urls", function () {
    it(" - builds the handle url from the configured url", function () {
      expect(rerSearchProvider.urlHandle).toEqual(
        `${SERVICE_URL}?serviceType=DBServices&serviceName=Normalizzatore&message=GetHandle`
      );
    });

    it(" - builds the address url from the configured url", function () {
      expect(rerSearchProvider.urlAddress).toEqual(
        `${SERVICE_URL}?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico_Area`
      );
    });
  });

  describe("parseResults", function () {
    it(" - builds a display name from street, town and province", function () {
      const results = rerSearchProvider.parseResults([record()]);
      expect(results.length).toEqual(1);
      expect(results[0].name).toEqual("VIA INDIPENDENZA, BOLOGNA, BO");
    });

    it(" - appends the house number when the record has one", function () {
      const results = rerSearchProvider.parseResults([
        record({
          cIVICO_X: "11.35",
          cIVICO_Y: "44.5",
          dESCRIZIONE_CIVICO: "10"
        })
      ]);
      expect(results[0].name).toEqual("VIA INDIPENDENZA 10, BOLOGNA, BO");
    });

    it(" - uses the street centroid when there is no house number", function () {
      const results = rerSearchProvider.parseResults([record()]);
      expect(results[0].location).toEqual({
        latitude: 44.49,
        longitude: 11.34
      });
    });

    it(" - uses the house number coordinates when present", function () {
      const results = rerSearchProvider.parseResults([
        record({ cIVICO_X: "11.35", cIVICO_Y: "44.5" })
      ]);
      expect(results[0].location).toEqual({
        latitude: 44.5,
        longitude: 11.35
      });
    });

    it(" - falls back to zero for unparseable coordinates", function () {
      const results = rerSearchProvider.parseResults([
        record({ cENTR_X: "not a number", cENTR_Y: "" })
      ]);
      expect(results[0].location).toEqual({ latitude: 0, longitude: 0 });
    });

    it(" - marks the most reliable matches as important", function () {
      const results = rerSearchProvider.parseResults([
        record({ sTRADARIO_ID: "1", gR_AFFIDABILITA: "0" }),
        record({ sTRADARIO_ID: "2", gR_AFFIDABILITA: "1" })
      ]);
      expect(results[0].isImportant).toBe(true);
      expect(results[1].isImportant).toBe(false);
    });

    it(" - sorts results by ascending reliability rank", function () {
      const results = rerSearchProvider.parseResults([
        record({
          sTRADARIO_ID: "3",
          dENOMINAZIONE: "TERZA",
          gR_AFFIDABILITA: "9"
        }),
        record({
          sTRADARIO_ID: "1",
          dENOMINAZIONE: "PRIMA",
          gR_AFFIDABILITA: "0"
        }),
        record({
          sTRADARIO_ID: "2",
          dENOMINAZIONE: "SECONDA",
          gR_AFFIDABILITA: "5"
        })
      ]);
      expect(results.map((result) => result.name)).toEqual([
        "VIA PRIMA, BOLOGNA, BO",
        "VIA SECONDA, BOLOGNA, BO",
        "VIA TERZA, BOLOGNA, BO"
      ]);
    });

    it(" - keeps only the first record for each street id", function () {
      const results = rerSearchProvider.parseResults([
        record({
          sTRADARIO_ID: "1",
          dENOMINAZIONE: "PRIMA",
          gR_AFFIDABILITA: "0"
        }),
        record({
          sTRADARIO_ID: "1",
          dENOMINAZIONE: "DUPLICATA",
          gR_AFFIDABILITA: "5"
        })
      ]);
      expect(results.length).toEqual(1);
      expect(results[0].name).toEqual("VIA PRIMA, BOLOGNA, BO");
    });

    it(" - zooms to the clicked result", function () {
      const results = rerSearchProvider.parseResults([record()]);
      const zoomTo = spyOn(terria.currentViewer, "zoomTo");

      results[0].clickAction();

      expect(zoomTo).toHaveBeenCalled();
    });

    it(" - does not zoom when the record has no usable coordinates", function () {
      const results = rerSearchProvider.parseResults([
        record({ cENTR_X: "", cENTR_Y: "" })
      ]);
      const zoomTo = spyOn(terria.currentViewer, "zoomTo");

      results[0].clickAction();

      expect(zoomTo).not.toHaveBeenCalled();
    });
  });

  describe("search", function () {
    function mockService(records: ReturnType<typeof record>[]) {
      worker.use(
        http.post(SERVICE_URL, ({ request }) => {
          const message = new URL(request.url).searchParams.get("message");
          if (message === "GetHandle") {
            return HttpResponse.json({
              getHandleOutput: {
                getHandleOutputParams: { p_Handle: "a-handle" }
              }
            });
          }
          if (message === "Norm_Indirizzo_Unico_Area") {
            return HttpResponse.json({
              norm_Indirizzo_Unico_AreaOutput: {
                norm_Indirizzo_Unico_AreaOutputRecordsetArray: records
              }
            });
          }
          return HttpResponse.error();
        })
      );
    }

    it(" - returns the parsed locations", async function () {
      mockService([
        record(),
        record({ sTRADARIO_ID: "2", dENOMINAZIONE: "RIZZOLI" })
      ]);

      await rerSearchProvider.search("indipendenza", true);

      expect(rerSearchProvider.searchResult.message).toBeUndefined();
      expect(rerSearchProvider.searchResult.results.length).toEqual(2);
      expect(rerSearchProvider.searchResult.results[0].name).toEqual(
        "VIA INDIPENDENZA, BOLOGNA, BO"
      );
    });

    it(" - reuses the handle across searches", async function () {
      let handleRequests = 0;
      worker.use(
        http.post(SERVICE_URL, ({ request }) => {
          const message = new URL(request.url).searchParams.get("message");
          if (message === "GetHandle") {
            handleRequests++;
            return HttpResponse.json({
              getHandleOutput: {
                getHandleOutputParams: { p_Handle: "a-handle" }
              }
            });
          }
          return HttpResponse.json({
            norm_Indirizzo_Unico_AreaOutput: {
              norm_Indirizzo_Unico_AreaOutputRecordsetArray: [record()]
            }
          });
        })
      );

      await rerSearchProvider.search("indipendenza", true);
      await rerSearchProvider.search("rizzoli", true);

      expect(handleRequests).toEqual(1);
    });

    it(" - sends the current camera view as the search area", async function () {
      let sentBody: any;
      worker.use(
        http.post(SERVICE_URL, async ({ request }) => {
          const message = new URL(request.url).searchParams.get("message");
          if (message === "GetHandle") {
            return HttpResponse.json({
              getHandleOutput: {
                getHandleOutputParams: { p_Handle: "a-handle" }
              }
            });
          }
          sentBody = await request.json();
          return HttpResponse.json({
            norm_Indirizzo_Unico_AreaOutput: {
              norm_Indirizzo_Unico_AreaOutputRecordsetArray: []
            }
          });
        })
      );

      await rerSearchProvider.search("indipendenza", true);

      const params = sentBody.Norm_Indirizzo_Unico_AreaInputParams;
      expect(params.p_Indirizzo).toEqual("indipendenza");
      expect(params.p_Handle).toEqual("a-handle");
      expect(params.p_Tipo_Coord).toEqual("WGS84");
      expect(parseFloat(params.p_minx)).not.toBeNaN();
      expect(parseFloat(params.p_maxy)).not.toBeNaN();
    });

    it(" - reports when nothing was found", async function () {
      mockService([]);

      await rerSearchProvider.search("nowhere", true);

      expect(rerSearchProvider.searchResult.results.length).toEqual(0);
      expect(rerSearchProvider.searchResult.message?.content).toEqual(
        "translate#viewModels.searchNoLocations"
      );
    });

    it(" - does not search for whitespace only text", async function () {
      await rerSearchProvider.search("   ", true);

      expect(rerSearchProvider.searchResult.results.length).toEqual(0);
    });
  });
});
