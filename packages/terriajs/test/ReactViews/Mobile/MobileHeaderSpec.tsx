import { screen } from "@testing-library/react";
import i18next from "i18next";
import Terria from "../../../lib/Models/Terria";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import MobileHeader from "../../../lib/ReactViews/Mobile/MobileHeader";
import processCustomElements from "../../../lib/ReactViews/StandardUserInterface/processCustomElements";
import { renderWithContexts } from "../withContext";

describe("MobileHeader", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeAll(async function () {
    await i18next.changeLanguage("en");
  });
  beforeEach(function () {
    terria = new Terria({
      baseUrl: "./"
    });
    viewState = new ViewState({
      terria: terria
    });
  });

  afterAll(async function () {
    await i18next.changeLanguage("cimode");
  });

  it("should render search for locations for small screen", function () {
    const isSmallScreen = true;
    const customElements = processCustomElements(isSmallScreen, undefined);

    viewState.searchState.showMobileLocationSearch = true;

    renderWithContexts(
      <MobileHeader
        menuItems={customElements.menu}
        menuLeftItems={customElements.menuLeft}
      />,
      viewState
    );

    const searchInputs = screen.getAllByRole("textbox");
    expect(searchInputs.length).toBe(1);
    expect(searchInputs[0]).toHaveAttribute(
      "placeholder",
      "Search for locations"
    );
  });

  it("should render search for catalogue for small screen", function () {
    const isSmallScreen = true;
    const customElements = processCustomElements(isSmallScreen, undefined);

    viewState.searchState.showMobileCatalogSearch = true;

    renderWithContexts(
      <MobileHeader
        menuItems={customElements.menu}
        menuLeftItems={customElements.menuLeft}
      />,
      viewState
    );

    const searchInputs = screen.getAllByRole("textbox");
    expect(searchInputs.length).toBe(1);
    expect(searchInputs[0]).toHaveAttribute(
      "placeholder",
      "Search the catalogue"
    );
  });

  it("labels the header buttons", function () {
    const customElements = processCustomElements(true, undefined);

    renderWithContexts(
      <MobileHeader
        menuItems={customElements.menu}
        menuLeftItems={customElements.menuLeft}
      />,
      viewState
    );

    expect(
      screen.getByRole("button", { name: "toggle navigation" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Data Catalogue" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "My Data" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Search for locations" })
    ).toBeVisible();
  });

  it("marks the open view as pressed", function () {
    const customElements = processCustomElements(true, undefined);

    viewState.explorerPanelIsVisible = true;
    viewState.mobileView = viewState.mobileViewOptions.data;

    renderWithContexts(
      <MobileHeader
        menuItems={customElements.menu}
        menuLeftItems={customElements.menuLeft}
      />,
      viewState
    );

    expect(
      screen.getByRole("button", { name: "Data Catalogue" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "My Data" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("renders without workbench items", function () {
    const customElements = processCustomElements(true, undefined);

    renderWithContexts(
      <MobileHeader
        menuItems={customElements.menu}
        menuLeftItems={customElements.menuLeft}
      />,
      viewState
    );

    expect(
      screen.queryByRole("button", { name: /^Explore Datasets/ })
    ).toBeNull();
  });
});
