import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { runInAction } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Terria from "../../../../lib/Models/Terria";
import ViewState from "../../../../lib/ReactViewModels/ViewState";
import CoordsPanel from "../../../../lib/ReactViews/Map/Panels/CoordsPanel/CoordsPanel";
import { worker } from "../../../mocks/browser";
import { renderWithContexts } from "../../withContext";

const CONVERTER_URL = "https://example.com/coords/project";

function waitUntil(condition: () => boolean, message: string) {
  return waitFor(() => {
    if (!condition()) throw new Error(message);
  });
}

describe("CoordsPanel", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
    terria.configParameters.coordsConverterUrl = CONVERTER_URL;
  });

  async function openPanel() {
    const user = userEvent.setup({ delay: null });
    renderWithContexts(
      <CoordsPanel terria={terria} viewState={viewState} />,
      viewState
    );
    await user.click(
      screen.getByRole("button", { name: "coordsPanel.header" })
    );
    return user;
  }

  function coordsFields() {
    const [input, output] = screen.getAllByRole("textbox");
    return {
      input: input as HTMLInputElement,
      output: output as HTMLInputElement
    };
  }

  function convertButton() {
    return screen.getByRole("button", { name: "coordsPanel.btnConvert" });
  }

  it("shows a button that opens the panel", async function () {
    await openPanel();
    expect(screen.getByText("coordsPanel.coordsTitle")).toBeVisible();
    expect(screen.getByText("coordsPanel.resultTitle")).toBeVisible();
  });

  it("makes only the result field read-only", async function () {
    await openPanel();
    const { input, output } = coordsFields();
    expect(input.readOnly).toBe(false);
    expect(output.readOnly).toBe(true);
  });

  describe("the reference system list", function () {
    it("offers conversions to the Emilia-Romagna reference systems", async function () {
      await openPanel();
      const select = screen.getByRole("combobox");

      expect(
        within(select).getByRole("option", {
          name: "EPSG:4326 WGS84 → EPSG:3003 Monte Mario / Italy zone 1"
        })
      ).toBeDefined();
      expect(
        within(select).getByRole("option", {
          name: "EPSG:4326 WGS84 → EPSG:5659 UTMRER"
        })
      ).toBeDefined();
    });

    it("offers the reverse conversion for each system", async function () {
      await openPanel();
      const select = screen.getByRole("combobox");

      expect(
        within(select).getByRole("option", {
          name: "EPSG:5659 UTMRER → EPSG:4326 WGS84"
        })
      ).toBeDefined();
    });

    it("starts on a conversion out of WGS84", async function () {
      await openPanel();
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.selectedOptions[0].textContent).toContain(
        "EPSG:4326 WGS84 →"
      );
    });

    it("hides the conversions out of WGS84 once the input is clearly projected", async function () {
      const user = await openPanel();

      await user.type(coordsFields().input, "686000, 931000");

      await waitUntil(
        () =>
          within(screen.getByRole("combobox")).queryByRole("option", {
            name: "EPSG:4326 WGS84 → EPSG:5659 UTMRER"
          }) === null,
        "conversions out of WGS84 are still offered"
      );
      expect(
        within(screen.getByRole("combobox")).getByRole("option", {
          name: "EPSG:5659 UTMRER → EPSG:4326 WGS84"
        })
      ).toBeDefined();
    });
  });

  describe("converting", function () {
    it("sends the input coordinates and the chosen systems to the converter", async function () {
      let params: URLSearchParams | undefined;
      worker.use(
        http.get(CONVERTER_URL, ({ request }) => {
          params = new URL(request.url).searchParams;
          return HttpResponse.json({ geometries: [{ x: 686123, y: 931456 }] });
        })
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());

      await waitUntil(() => params !== undefined, "no request was made");
      expect(params?.get("inSR")).toEqual("4326");
      expect(params?.get("outSR")).toEqual("3003");
      expect(params?.get("f")).toEqual("json");
      expect(params?.get("geometries")).toEqual("11.34,44.49");
    });

    it("shows the projected result as easting then northing", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({ geometries: [{ x: 686123.25, y: 931456.5 }] })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());

      expect(
        await screen.findByDisplayValue("686123.2500, 931456.5000")
      ).toBeVisible();
    });

    it("shows a geographic result as latitude then longitude", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({ geometries: [{ x: 11.34, y: 44.49 }] })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "686000, 931000");
      await user.click(convertButton());

      expect(
        await screen.findByDisplayValue("44.490000, 11.340000")
      ).toBeVisible();
    });

    it("reads a result returned as a bare geometry object", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({ geometry: { x: 686123.25, y: 931456.5 } })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());

      expect(
        await screen.findByDisplayValue("686123.2500, 931456.5000")
      ).toBeVisible();
    });

    it("reads a result whose numbers came back as strings", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({
            geometries: [{ x: "686123,25", y: "931456,50" }]
          })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());

      expect(
        await screen.findByDisplayValue("686123.2500, 931456.5000")
      ).toBeVisible();
    });

    it("reports the converter's error message when it cannot convert", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({ error: { message: "Unknown spatial reference" } })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());

      expect(
        await screen.findByDisplayValue("Unknown spatial reference")
      ).toBeVisible();
    });

    it("does not call the converter when no url is configured", async function () {
      const unusedUrl = "https://example.com/coords/never-called";
      terria.configParameters.coordsConverterUrl = undefined;
      let called = false;
      worker.use(
        http.get(unusedUrl, () => {
          called = true;
          return HttpResponse.json({});
        })
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(called).toBe(false);
      expect(coordsFields().output.value).toEqual("");
    });
  });

  describe("reset", function () {
    it("clears both coordinate fields", async function () {
      worker.use(
        http.get(CONVERTER_URL, () =>
          HttpResponse.json({ geometries: [{ x: 686123, y: 931456 }] })
        )
      );

      const user = await openPanel();
      await user.type(coordsFields().input, "44.49, 11.34");
      await user.click(convertButton());
      await screen.findByDisplayValue("686123.0000, 931456.0000");

      await user.click(
        screen.getByRole("button", { name: "coordsPanel.btnReset" })
      );

      await waitUntil(
        () =>
          coordsFields().input.value === "" &&
          coordsFields().output.value === "",
        "the coordinate fields were not cleared"
      );
    });
  });

  describe("picking a position on the map", function () {
    it("fills the input with the picked latitude and longitude", async function () {
      await openPanel();

      runInAction(() => {
        terria.pickedPosition = Cartographic.fromDegrees(11.34, 44.49);
      });

      expect(
        await screen.findByDisplayValue("44.490000, 11.340000")
      ).toBeVisible();
    });
  });
});
