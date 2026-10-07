import { runInAction, when } from "mobx";
import GeoJsonCatalogItem from "../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import { AutoStartData } from "../../lib/Models/InitSource";
import Terria from "../../lib/Models/Terria";
import ViewerMode from "../../lib/Models/ViewerMode";
import ViewState from "../../lib/ReactViewModels/ViewState";
import SimpleCatalogItem from "../Helpers/SimpleCatalogItem";
import TerriaReference from "../../lib/Models/Catalog/CatalogReferences/TerriaReference";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import CatalogIndexReference from "../../lib/Models/Catalog/CatalogReferences/CatalogIndexReference";
import SplitItemReference from "../../lib/Models/Catalog/CatalogReferences/SplitItemReference";

describe("ViewState", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria();
    viewState = new ViewState({
      terria,
      catalogSearchProvider: undefined
    });
  });

  describe("viewCatalogMember", function () {
    it("handle nested references", async function () {
      // Test nested reference
      // CatalogIndexReference -> TerriaReference -> CatalogGroup
      terria = new Terria();

      const terriaReference = new TerriaReference("test", terria);
      terriaReference.setTrait(
        CommonStrata.user,
        "url",
        "test/init/wms-v8.json"
      );
      terriaReference.setTrait(CommonStrata.user, "isGroup", true);
      terria.addModel(terriaReference);

      const catalogIndexReference = new CatalogIndexReference("test", terria);

      await viewState.viewCatalogMember(catalogIndexReference);

      expect(viewState.previewedItem).toBeDefined();
      expect(viewState.previewedItem?.type).toBe("group");
    });
  });

  describe("removeModelReferences", function () {
    it("unsets the previewedItem if it matches the model", async function () {
      const item = new SimpleCatalogItem("testId", terria);
      await viewState.viewCatalogMember(item);
      viewState.removeModelReferences(item);
      expect(viewState.previewedItem).toBeUndefined();
    });

    it("unsets the userDataPreviewedItem if it matches the model", function () {
      const item = new SimpleCatalogItem("testId", terria);
      viewState.userDataPreviewedItem = item;
      viewState.removeModelReferences(item);
      expect(viewState.userDataPreviewedItem).toBeUndefined();
    });
  });

  describe("error provider", function () {
    it("creates an empty error provider by default", function () {
      expect(viewState.errorProvider).toBeNull();
    });
  });

  describe("tourPointsWithValidRefs", function () {
    it("returns tourPoints ordered by priority", function () {
      runInAction(() => {
        viewState.setTourIndex(0);
        viewState.setShowTour(true);
        (viewState as any).updateAppRef("TestRef", { current: true });
        (viewState as any).updateAppRef("TestRef2", { current: true });
        (viewState as any).updateAppRef("TestRef3", { current: true });
        viewState.tourPoints = [
          {
            appRefName: "TestRef2",
            priority: 20,
            content: "## Motivated by food\n\nNeko loves food"
          },
          {
            appRefName: "TestRef3",
            priority: 30,
            content: "## Lazy\n\nThey like to lounge around all day"
          },
          {
            appRefName: "TestRef",
            priority: 10,
            content: "## Best friends\n\nMochi and neko are best friends"
          }
        ];
      });
      expect(viewState.tourPointsWithValidRefs).toBeDefined();
      expect(viewState.tourPointsWithValidRefs[0].priority).toEqual(10);
      expect(viewState.tourPointsWithValidRefs[1].priority).toEqual(20);
      expect(viewState.tourPointsWithValidRefs[2].priority).toEqual(30);
      expect(viewState.tourPointsWithValidRefs[0].appRefName).toEqual(
        "TestRef"
      );
    });
  });
  describe("tour and trainer interaction", function () {
    it("disables trainer bar if turning on tour", function () {
      runInAction(() => {
        viewState.setTrainerBarExpanded(true);
        viewState.setTrainerBarShowingAllSteps(true);
      });
      expect(viewState.trainerBarExpanded).toEqual(true);
      expect(viewState.trainerBarShowingAllSteps).toEqual(true);
      expect(viewState.showTour).toEqual(false);

      runInAction(() => {
        viewState.setShowTour(true);
      });
      expect(viewState.trainerBarExpanded).toEqual(false);
      expect(viewState.trainerBarShowingAllSteps).toEqual(false);
      expect(viewState.showTour).toEqual(true);
    });
  });

  describe("share link autoStart", function () {
    let container: HTMLElement;
    let item: GeoJsonCatalogItem;

    const start = (autoStart: Partial<AutoStartData> = {}) =>
      runInAction(() => {
        terria.autoStart = {
          itemId: "path-layer",
          feature: "playPath",
          play: true,
          tour: true,
          ...autoStart
        };
      });

    beforeEach(async function () {
      container = document.createElement("div");
      document.body.appendChild(container);
      terria.mainViewer.attach(container);
      runInAction(() => (terria.mainViewer.viewerMode = ViewerMode.Leaflet));
      await when(() => terria.leaflet !== undefined);

      item = new GeoJsonCatalogItem("path-layer", terria);
      item.setTrait(CommonStrata.user, "geoJsonData", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [11, 44],
                [11.1, 44.1]
              ]
            }
          }
        ]
      });
      terria.addModel(item, ["old-path-id"]);
      (await terria.workbench.add(item)).throwIfError();
      spyOn(item, "computePath");
    });

    afterEach(function () {
      terria.mainViewer.destroy();
      document.body.removeChild(container);
    });

    it("opens the PlayPath panel once the app is ready", function () {
      start();
      expect(viewState.playPathPanelIsVisible).toBe(true);
      expect(viewState.playPathPanelSourceItemId).toBe("path-layer");
      expect(item.computePath).toHaveBeenCalled();
      expect(viewState.autoStartPlay).toBe(true);
      expect(viewState.autoStartTour).toBe("playPath");
      expect(terria.autoStart).toBeUndefined();
    });

    it("opens the Measures panel for the measure feature", function () {
      start({ feature: "measure" });
      expect(viewState.measurablePanelSourceItemId).toBe("path-layer");
      expect(item.computePath).toHaveBeenCalled();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      expect(viewState.autoStartPlay).toBe(false);
      expect(viewState.autoStartTour).toBe("measure");
    });

    it("waits until the story prompt is declined", function () {
      runInAction(() => {
        terria.stories = [
          {
            id: "s1",
            title: "Scene",
            text: "",
            shareData: { version: "8.0.0", initSources: [] }
          }
        ];
      });
      start();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      runInAction(() => (viewState.storyShown = true));
      expect(viewState.playPathPanelIsVisible).toBe(false);
      runInAction(() => (viewState.storyShown = false));
      expect(viewState.playPathPanelIsVisible).toBe(true);
    });

    it("waits for the welcome message", function () {
      viewState.setShowWelcomeMessage(true);
      start();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      viewState.setShowWelcomeMessage(false);
      expect(viewState.playPathPanelIsVisible).toBe(true);
    });

    it("skips the tour on small screens", function () {
      runInAction(() => (viewState.useSmallScreenInterface = true));
      start();
      expect(viewState.autoStartTour).toBeUndefined();
      expect(viewState.autoStartPlay).toBe(true);
    });

    it("resolves the item through a share key", function () {
      start({ itemId: "old-path-id" });
      expect(viewState.playPathPanelSourceItemId).toBe("path-layer");
    });

    it("is consumed once, even when the layer is missing", async function () {
      runInAction(() => terria.workbench.remove(item));
      start();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      expect(terria.autoStart).toBeUndefined();
      (await terria.workbench.add(item)).throwIfError();
      expect(viewState.playPathPanelIsVisible).toBe(false);
    });

    it("opens the target of a referenced layer", async function () {
      const ref = new SplitItemReference("split-layer", terria);
      ref.setTrait(CommonStrata.user, "splitSourceItemId", "path-layer");
      terria.addModel(ref);
      (await ref.loadReference()).throwIfError();
      (await terria.workbench.add(ref)).throwIfError();
      const target = ref.target as GeoJsonCatalogItem;
      spyOn(target, "computePath");
      start({ itemId: "split-layer" });
      expect(viewState.playPathPanelSourceItemId).toBe("split-layer");
      expect(target.computePath).toHaveBeenCalled();
    });

    it("waits while a notification is shown", function () {
      terria.notificationState.addNotificationToQueue({
        title: "Error",
        message: "A layer failed to load"
      });
      start();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      terria.notificationState.dismissCurrentNotification();
      expect(viewState.playPathPanelIsVisible).toBe(true);
    });

    it("waits for the camera to stop zooming", function () {
      runInAction(() => (terria.currentViewer.isMapZooming = true));
      start();
      expect(viewState.playPathPanelIsVisible).toBe(false);
      runInAction(() => (terria.currentViewer.isMapZooming = false));
      expect(viewState.playPathPanelIsVisible).toBe(true);
    });

    it("deactivates an active measure tool before opening the panel", function () {
      const controller = {
        active: true,
        deactivate: jasmine.createSpy("deactivate")
      };
      spyOn(terria.mapNavigationModel, "findItem").and.callFake((id: string) =>
        id === "measure-line-tool" ? ({ controller } as any) : undefined
      );
      start();
      expect(controller.deactivate).toHaveBeenCalled();
      expect(viewState.playPathPanelIsVisible).toBe(true);
    });

    it("closing the PlayPath panel cancels a pending flight", function () {
      start();
      viewState.closePlayPathPanel();
      expect(viewState.autoStartPlay).toBe(false);
    });

    it("hiding the PlayPath panel by any path cancels a pending flight", function () {
      start();
      runInAction(() => (viewState.playPathPanelIsVisible = false));
      expect(viewState.autoStartPlay).toBe(false);
    });
  });
});
