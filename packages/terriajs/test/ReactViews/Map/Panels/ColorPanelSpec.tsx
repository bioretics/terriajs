import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import Terria from "../../../../lib/Models/Terria";
import ViewState from "../../../../lib/ReactViewModels/ViewState";
import ColorPanel from "../../../../lib/ReactViews/Map/Panels/ColorPanel/ColorPanel";
import { renderWithContexts } from "../../withContext";

describe("ColorPanel", function () {
  let terria: Terria;
  let viewState: ViewState;
  let container: HTMLElement;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
  });

  async function openPanel() {
    const user = userEvent.setup({ delay: null });
    const rendered = renderWithContexts(
      <ColorPanel terria={terria} viewState={viewState} />,
      viewState
    );
    container = rendered.container;
    await user.click(screen.getByRole("button", { name: "colorPanel.header" }));
    return user;
  }

  function addLayerButton() {
    return screen.getByRole("button", { name: "colorPanel.addButtonTitle" });
  }

  function removeLayerButtons() {
    return screen.queryAllByRole("button", {
      name: "colorPanel.removeButtonTitle"
    });
  }

  function elevationInputs() {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="number"]')
    ).slice(1);
  }

  function colorInputs() {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="color"]')
    );
  }

  function transparencyInput() {
    return document.querySelector<HTMLInputElement>('input[type="number"]')!;
  }

  it("shows the title, explanation and warning", async function () {
    await openPanel();
    expect(screen.getByText("colorPanel.title")).toBeVisible();
    expect(screen.getByText("colorPanel.explanation")).toBeVisible();
    expect(screen.getByText("colorPanel.warning")).toBeVisible();
  });

  it("starts with no elevation bands", async function () {
    await openPanel();
    expect(removeLayerButtons().length).toEqual(0);
    expect(elevationInputs().length).toEqual(0);
  });

  it("defaults the band transparency to a half", async function () {
    await openPanel();
    expect(transparencyInput().value).toEqual("0.5");
  });

  it("lets the transparency be changed", async function () {
    const user = await openPanel();
    await user.clear(transparencyInput());
    await user.type(transparencyInput(), "0.25");
    expect(transparencyInput().value).toEqual("0.25");
  });

  describe("adding a band", function () {
    it("adds a from/to elevation pair and a from/to colour pair", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());

      expect(elevationInputs().length).toEqual(2);
      expect(colorInputs().length).toEqual(2);
      expect(removeLayerButtons().length).toEqual(1);
    });

    it("starts the band at zero metres in blue", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());

      expect(elevationInputs().map((input) => input.value)).toEqual(["0", "0"]);
      expect(colorInputs().map((input) => input.value)).toEqual([
        "#0000ff",
        "#0000ff"
      ]);
    });

    it("adds a separate row each time", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());
      await user.click(addLayerButton());

      expect(removeLayerButtons().length).toEqual(2);
      expect(elevationInputs().length).toEqual(4);
    });

    it("keeps each row's elevations independent", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());
      await user.click(addLayerButton());

      const inputs = elevationInputs();
      await user.clear(inputs[0]);
      await user.type(inputs[0], "100");

      expect(elevationInputs()[0].value).toEqual("100");
      expect(elevationInputs()[2].value).toEqual("0");
    });
  });

  describe("removing a band", function () {
    it("removes the row that was clicked", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());
      await user.click(addLayerButton());

      const inputs = elevationInputs();
      await user.clear(inputs[2]);
      await user.type(inputs[2], "250");

      await user.click(removeLayerButtons()[0]);

      expect(removeLayerButtons().length).toEqual(1);
      expect(elevationInputs()[0].value).toEqual("250");
    });

    it("can remove every row", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());
      await user.click(removeLayerButtons()[0]);

      expect(removeLayerButtons().length).toEqual(0);
      expect(elevationInputs().length).toEqual(0);
    });
  });

  describe("applying", function () {
    it("does nothing when there is no Cesium viewer to colour", async function () {
      const user = await openPanel();
      await user.click(addLayerButton());

      await user.click(
        screen.getByRole("button", { name: "colorPanel.applyButton" })
      );

      expect(removeLayerButtons().length).toEqual(1);
      expect(container).toBeDefined();
    });
  });
});
