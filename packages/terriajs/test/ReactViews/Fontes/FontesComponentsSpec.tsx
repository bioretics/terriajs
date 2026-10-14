import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import GeoJsonCatalogItem from "../../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import Terria from "../../../lib/Models/Terria";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import { StandardUserInterface } from "../../../lib/ReactViews/StandardUserInterface/StandardUserInterface";
import CustomComponent from "../../../lib/ReactViews/Custom/CustomComponent";
import parseCustomMarkdownToReact from "../../../lib/ReactViews/Custom/parseCustomMarkdownToReact";
import registerCustomComponentTypes from "../../../lib/ReactViews/Custom/registerCustomComponentTypes";
import { worker } from "../../mocks/browser";
import { normalizeFontesDocument } from "../../../lib/ReactViews/Fontes/Fontes";
import { FontesDocumentDetails } from "../../../lib/ReactViews/Fontes/FontesDocumentWindow";
import FontesPanel from "../../../lib/ReactViews/Fontes/FontesPanel";
import { RESULTS_LAYER_ID } from "../../../lib/ReactViews/Fontes/fontesMap";
import { renderWithContexts, TerriaThemeProvider } from "../withContext";

const colorno = normalizeFontesDocument({
  type: "Feature",
  geometry: null,
  properties: {
    id: "ASPR_MD0351",
    segnatura: "ASPR, Mappe e disegni, 68/41",
    documento_testuale: false,
    titolo_schedatore: "Colorno",
    larghezza_documento: 403,
    autori: ["Smeraldi Smeraldo", "Rossi Carlo"],
    luoghi: [{ nome: "Colorno", prov: "PR", nome_storico: "Colurni" }]
  }
});

describe("FontesDocumentDetails", function () {
  const show = () =>
    render(
      <TerriaThemeProvider>
        <FontesDocumentDetails doc={colorno} />
      </TerriaThemeProvider>
    );

  it("shows the catalogued fields under their plugin tab", function () {
    show();
    expect(screen.getByText("Collocazione")).toBeVisible();
    expect(screen.getByText("Segnatura")).toBeVisible();
    expect(screen.getByText("ASPR, Mappe e disegni, 68/41")).toBeVisible();
  });

  it("leaves out tabs and fields that were not catalogued", function () {
    show();
    expect(screen.queryByText("Annotazioni")).toBeNull();
    expect(screen.queryByText("Note collocazione")).toBeNull();
  });

  it("opens a tab to show its values, with units", function () {
    show();
    expect(screen.queryByText("403 mm")).toBeNull();
    fireEvent.click(screen.getByText("Dimensioni"));
    expect(screen.getByText("403 mm")).toBeVisible();
  });

  it("shows yes/no fields and lists the values of a dictionary", function () {
    show();
    expect(screen.getByText("fontes.no")).toBeVisible();
    fireEvent.click(screen.getByText("Autori"));
    expect(screen.getByText("Smeraldi Smeraldo, Rossi Carlo")).toBeVisible();
  });

  it("shows records such as places as a small table", function () {
    show();
    fireEvent.click(screen.getByText("Luoghi"));
    expect(
      screen.getByRole("columnheader", { name: "Nome storico" })
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: "Colurni" })).toBeVisible();
  });
});

describe("FONTES in the standard user interface", function () {
  const documentsUrl = "https://example.com/fontes/sui.json";
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    worker.use(
      http.get(documentsUrl, () =>
        HttpResponse.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: null,
              properties: { id: "ASPR_MD0351", titolo_schedatore: "Colorno" }
            }
          ]
        })
      )
    );
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
    terria.updateParameters({ fontesConfig: { documentsUrl } });
  });

  const renderUi = () =>
    render(
      <StandardUserInterface
        terria={terria}
        viewState={viewState}
        version="test"
        minimumLargeScreenWidth={0}
      />
    );

  it("opens the FONTES search from the menu bar", function () {
    renderUi();
    expect(screen.queryByText("fontes.panelTitle")).not.toBeVisible();
    fireEvent.click(screen.getByText("fontes.menuButton"));
    expect(screen.getByText("fontes.panelTitle")).toBeVisible();
  });

  it("has no FONTES search without fontesConfig", function () {
    terria.updateParameters({ fontesConfig: undefined });
    renderUi();
    expect(screen.queryByText("fontes.menuButton")).toBeNull();
    expect(screen.queryByText("fontes.panelTitle")).toBeNull();
  });

  it("shows the window of the open document", async function () {
    viewState.openFontesDocument("ASPR_MD0351");
    render(
      <StandardUserInterface
        terria={terria}
        viewState={viewState}
        version="test"
      />
    );
    expect(await screen.findByText("ASPR_MD0351 · Colorno")).toBeVisible();
  });
});

describe("<fontes-document> in feature info templates", function () {
  let viewState: ViewState;

  beforeEach(function () {
    const terria = new Terria();
    viewState = new ViewState({ terria });
    registerCustomComponentTypes(terria);
  });

  const renderTemplate = (html: string) =>
    renderWithContexts(
      <div>{parseCustomMarkdownToReact(html, { viewState })}</div>,
      viewState
    );

  it("is one of the registered custom components", function () {
    expect(CustomComponent.isRegistered("fontes-document")).toBe(true);
  });

  it("opens the window of its document", function () {
    renderTemplate('<fontes-document id="ASPR_MD0351"></fontes-document>');
    fireEvent.click(screen.getByText("fontes.openDocument"));
    expect(viewState.fontesDocumentId).toEqual("ASPR_MD0351");
  });

  it("can be given its own label", function () {
    renderTemplate(
      '<fontes-document id="ASPR_MD0351">Vedi la mappa</fontes-document>'
    );
    fireEvent.click(screen.getByText("Vedi la mappa"));
    expect(viewState.fontesDocumentId).toEqual("ASPR_MD0351");
  });
});

describe("FontesPanel", function () {
  const documentsUrl = "https://example.com/fontes/panel.json";
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    worker.use(
      http.get(documentsUrl, () =>
        HttpResponse.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "MultiPoint", coordinates: [[10.376, 44.929]] },
              properties: {
                id: "ASPR_MD0351",
                titolo_schedatore: "Colorno",
                data_produzione: "1627"
              }
            },
            {
              type: "Feature",
              geometry: { type: "MultiPoint", coordinates: [[10.299, 44.936]] },
              properties: {
                id: "ASPR_CAVCT0232",
                titolo_schedatore: "Argine guasto di Mezzano de Rondani",
                data_produzione: "1700"
              }
            },
            {
              type: "Feature",
              geometry: null,
              properties: {
                id: "ASPR_MPS0076",
                titolo_archivista: "Carta del Po",
                data_produzione: "/1590",
                documento_testuale: true
              }
            }
          ]
        })
      )
    );
    terria = new Terria();
    viewState = new ViewState({ terria });
    terria.updateParameters({ fontesConfig: { documentsUrl } });
  });

  const showPanel = () =>
    renderWithContexts(<FontesPanel isVisible />, viewState);
  const searchWhenLoaded = async () => {
    const button = screen.getByRole("button", {
      name: "fontes.search"
    }) as HTMLButtonElement;
    await waitFor(() => {
      if (button.disabled) throw new Error("documents still loading");
    });
    fireEvent.click(button);
  };

  it("finds documents by text in any field", async function () {
    showPanel();
    fireEvent.change(screen.getByLabelText("fontes.value"), {
      target: { value: "colorno" }
    });
    await searchWhenLoaded();
    expect(screen.getByText("Colorno")).toBeVisible();
    expect(screen.queryByText("Carta del Po")).toBeNull();
  });

  it("adds and removes conditions", function () {
    showPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "fontes.addCondition" })
    );
    expect(screen.getAllByLabelText("fontes.value").length).toEqual(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "fontes.removeCondition" })[1]
    );
    expect(screen.getAllByLabelText("fontes.value").length).toEqual(1);
  });

  it("offers the fields of the chosen group", function () {
    showPanel();
    fireEvent.change(screen.getByLabelText("fontes.group"), {
      target: { value: "Dimensioni" }
    });
    const fields = within(screen.getByLabelText("fontes.field"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(fields).toContain("Altezza del documento");
    expect(fields).not.toContain("Segnatura");
  });

  it("flags a value that is not a FONTES date", function () {
    showPanel();
    fireEvent.change(screen.getByLabelText("fontes.field"), {
      target: { value: "data_produzione" }
    });
    fireEvent.change(screen.getByLabelText("fontes.value"), {
      target: { value: "16" }
    });
    expect(screen.getByLabelText("fontes.value")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("searches by years", async function () {
    showPanel();
    fireEvent.change(screen.getByLabelText("fontes.yearTo"), {
      target: { value: "1600" }
    });
    await searchWhenLoaded();
    expect(screen.getByText("Carta del Po")).toBeVisible();
    expect(screen.queryByText("Colorno")).toBeNull();
  });

  const resultsLayer = async () => {
    let layer: GeoJsonCatalogItem | undefined;
    await waitFor(() => {
      layer = terria.getModelById(GeoJsonCatalogItem, RESULTS_LAYER_ID);
      if (!layer || !terria.workbench.contains(layer)) {
        throw new Error("results not on the map yet");
      }
    });
    return layer!;
  };

  it("shows the results with places on the map as one layer", async function () {
    showPanel();
    await searchWhenLoaded();
    fireEvent.click(screen.getByRole("button", { name: "fontes.showOnMap" }));
    const layer = await resultsLayer();
    expect((layer.geoJsonData as any).features.length).toEqual(2);
    expect(layer.defaultStyle.time.timeColumn).toBeNull();
    expect(terria.timelineStack.contains(layer)).toBe(false);
  });

  it("animates the results in time on request", async function () {
    showPanel();
    await searchWhenLoaded();
    fireEvent.click(screen.getByLabelText("fontes.animateTime"));
    fireEvent.click(screen.getByRole("button", { name: "fontes.showOnMap" }));
    const layer = await resultsLayer();
    expect(layer.defaultStyle.time.timeColumn).toEqual("data_da");
    expect(layer.defaultStyle.time.endTimeColumn).toEqual("data_a");
    await waitFor(() => {
      if (terria.timelineStack.top !== layer) {
        throw new Error("results not on top of the timeline");
      }
    });
  });

  it("shows each document on the timeline during its period", async function () {
    showPanel();
    await searchWhenLoaded();
    fireEvent.click(screen.getByLabelText("fontes.animateTime"));
    fireEvent.click(screen.getByRole("button", { name: "fontes.showOnMap" }));
    const layer = await resultsLayer();
    await layer.loadMapItems();
    const points = layer.mapItems.find(
      (item) => item instanceof CustomDataSource
    ) as CustomDataSource;
    const shownOn = (date: string) =>
      points.entities.values
        .filter((entity) => entity.isAvailable(JulianDate.fromIso8601(date)))
        .map((entity) => entity.properties?.id?.getValue())
        .sort();
    expect(shownOn("1627-06-01")).toEqual(["ASPR_MD0351"]);
    expect(shownOn("1700-06-01")).toEqual(["ASPR_CAVCT0232"]);
    expect(shownOn("1650-06-01")).toEqual([]);
  });

  it("opens the window of a result", async function () {
    showPanel();
    await searchWhenLoaded();
    fireEvent.click(screen.getAllByRole("button", { name: "fontes.open" })[0]);
    expect(viewState.fontesDocumentId).toEqual("ASPR_MD0351");
  });
});
