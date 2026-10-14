import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import Terria from "../../../lib/Models/Terria";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import { StandardUserInterface } from "../../../lib/ReactViews/StandardUserInterface/StandardUserInterface";
import CustomComponent from "../../../lib/ReactViews/Custom/CustomComponent";
import parseCustomMarkdownToReact from "../../../lib/ReactViews/Custom/parseCustomMarkdownToReact";
import registerCustomComponentTypes from "../../../lib/ReactViews/Custom/registerCustomComponentTypes";
import { worker } from "../../mocks/browser";
import { normalizeFontesDocument } from "../../../lib/ReactViews/Fontes/Fontes";
import { FontesDocumentDetails } from "../../../lib/ReactViews/Fontes/FontesDocumentWindow";
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
