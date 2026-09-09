import ViewingControls from "../../../../lib/ReactViews/Workbench/Controls/ViewingControls";
import Terria from "../../../../lib/Models/Terria";
import ViewState from "../../../../lib/ReactViewModels/ViewState";
import SimpleCatalogItem from "../../../Helpers/SimpleCatalogItem";
import * as ViewingControlsMenu from "../../../../lib/ViewModels/ViewingControlsMenu";
import Icon from "../../../../lib/Styled/Icon";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileSaver from "file-saver";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import GeoJsonCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";

describe("ViewingControls", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria();
    viewState = new ViewState({
      terria
    });
  });

  it("renders the viewing controls buttons", () => {
    const simpleItem = new SimpleCatalogItem("simple", terria);
    render(<ViewingControls viewState={viewState} item={simpleItem} />);

    expect(
      screen.getByRole("button", { name: "workbench.zoomTo" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "workbench.previewItem" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "workbench.showMoreActionsTitle" })
    ).toBeVisible();
  });

  it("shows viewing controls added through `viewState.globalViewingControls`", async () => {
    const simpleItem = new SimpleCatalogItem("simple", terria);

    ViewingControlsMenu.addMenuItem(viewState, () => ({
      name: "View details",
      icon: Icon.GLYPHS.eye,
      iconTitle: "View more details",
      onClick: () => {}
    }));
    render(<ViewingControls viewState={viewState} item={simpleItem} />);

    await userEvent.click(
      screen.getByRole("button", { name: "workbench.showMoreActionsTitle" })
    );

    expect(screen.getByText("View details")).toBeVisible();
    expect(screen.getByTitle("View more details")).toBeVisible();
  });

  it("should close menu on click outside", async () => {
    const simpleItem = new SimpleCatalogItem("simple", terria);

    ViewingControlsMenu.addMenuItem(viewState, () => ({
      name: "View details",
      icon: Icon.GLYPHS.eye,
      iconTitle: "View more details",
      onClick: () => {}
    }));

    render(<ViewingControls viewState={viewState} item={simpleItem} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: "workbench.showMoreActionsTitle"
      })
    );

    expect(screen.getByText("View details")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", {
        name: "workbench.previewItem"
      })
    );

    expect(screen.queryByText("View details")).not.toBeInTheDocument();
  });

  describe("exporting an item built in code rather than loaded from a file", () => {
    async function myLocationMarker() {
      const marker = new GeoJsonCatalogItem(createGuid(), terria);
      marker.setTrait(CommonStrata.user, "name", "My location");
      marker.setTrait(CommonStrata.user, "geoJsonData", {
        type: "Feature",
        properties: { title: "Location" },
        geometry: { type: "Point", coordinates: [11.34, 44.49] }
      } as any);
      await marker.loadMapItems();
      return marker;
    }

    async function clickExport(item: GeoJsonCatalogItem) {
      render(<ViewingControls viewState={viewState} item={item} />);
      await userEvent.click(
        screen.getByRole("button", { name: "workbench.showMoreActionsTitle" })
      );
      await userEvent.click(
        screen.getByRole("button", { name: "workbench.exportData" })
      );
    }

    it("downloads the file instead of doing nothing", async () => {
      const saveAs = spyOn(FileSaver, "saveAs");
      const marker = await myLocationMarker();

      expect(marker.canSampleMeasurableGeometry).toBe(true);
      expect(marker.canUseAsPath).toBe(false);

      await clickExport(marker);

      await waitFor(() => expect(saveAs).toHaveBeenCalled());
    });

    it("does not leave the download panel open on an empty geometry", async () => {
      spyOn(FileSaver, "saveAs");
      const marker = await myLocationMarker();

      await clickExport(marker);

      await waitFor(() =>
        expect(viewState.measurableDownloadPanelIsVisible).toBe(false)
      );
      expect(viewState.measurableDownloadPanelSourceItemId).toBeUndefined();
    });
  });
});
