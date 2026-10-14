import { fireEvent, render, screen } from "@testing-library/react";
import { normalizeFontesDocument } from "../../../lib/ReactViews/Fontes/Fontes";
import { FontesDocumentDetails } from "../../../lib/ReactViews/Fontes/FontesDocumentWindow";
import { TerriaThemeProvider } from "../withContext";

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
