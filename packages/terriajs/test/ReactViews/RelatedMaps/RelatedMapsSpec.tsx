import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import Terria from "../../../lib/Models/Terria";
import { RelatedMap } from "../../../lib/Models/RelatedMaps";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import RelatedMaps from "../../../lib/ReactViews/RelatedMaps/RelatedMaps";
import { worker } from "../../mocks/browser";
import { renderWithContexts } from "../withContext";

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b
]);

const relatedMaps: RelatedMap[] = [
  {
    imageUrl: "https://example.com/moka.png",
    url: "https://example.com/moka",
    title: "Moka",
    description: "The **Emilia-Romagna** cartographic portal."
  },
  {
    imageUrl: "https://example.com/geoportale.png",
    url: "https://example.com/geoportale",
    title: "Geoportale",
    description: "Regional geoportal."
  }
];

describe("RelatedMaps", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
    worker.use(
      http.get("https://example.com/*.png", () =>
        HttpResponse.arrayBuffer(PIXEL.buffer as ArrayBuffer, {
          headers: { "Content-Type": "image/gif" }
        })
      )
    );
  });

  async function openPanel(maps: RelatedMap[]) {
    const user = userEvent.setup({ delay: null });
    renderWithContexts(<RelatedMaps relatedMaps={maps} />, viewState);
    await user.click(
      screen.getByRole("button", { name: "relatedMaps.buttonText" })
    );
    return user;
  }

  it("shows the panel heading and blurb", async function () {
    await openPanel(relatedMaps);
    expect(screen.getByText("relatedMaps.panelHeading")).toBeVisible();
    expect(screen.getByText("relatedMaps.panelText")).toBeVisible();
  });

  it("lists one entry per configured map", async function () {
    await openPanel(relatedMaps);
    expect(screen.getByText("Moka")).toBeVisible();
    expect(screen.getByText("Geoportale")).toBeVisible();
  });

  it("links each map to its url in a new tab", async function () {
    await openPanel(relatedMaps);
    const links = screen
      .getAllByRole("link")
      .filter(
        (link) => link.getAttribute("href") === "https://example.com/moka"
      );

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("target")).toEqual("_blank");
      expect(link.getAttribute("rel")).toEqual("noreferrer");
    }
  });

  it("shows each map's thumbnail with its title as alt text", async function () {
    await openPanel(relatedMaps);
    const image = screen.getByAltText("Moka");
    expect(image.getAttribute("src")).toEqual("https://example.com/moka.png");
  });

  it("renders the description as markdown", async function () {
    await openPanel(relatedMaps);
    const emphasised = screen.getByText("Emilia-Romagna");
    expect(emphasised.tagName).toEqual("STRONG");
  });

  it("shows just the heading when no maps are configured", async function () {
    await openPanel([]);
    expect(screen.getByText("relatedMaps.panelHeading")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
