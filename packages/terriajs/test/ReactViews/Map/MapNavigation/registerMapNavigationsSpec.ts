import { runInAction } from "mobx";
import Terria from "../../../../lib/Models/Terria";
import ViewState from "../../../../lib/ReactViewModels/ViewState";
import {
  MeasureLineTool,
  MeasurePointTool
} from "../../../../lib/ReactViews/Map/MapNavigation/Items/MeasureTools";
import { registerMapNavigations } from "../../../../lib/ReactViews/Map/MapNavigation/registerMapNavigations";

describe("registerMapNavigations", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
    registerMapNavigations(viewState);
  });

  function controllerFor(id: string) {
    const item = terria.mapNavigationModel.findItem(id);
    expect(item).toBeDefined();
    return item!.controller;
  }

  it("registers the measure tools", function () {
    expect(controllerFor(MeasureLineTool.id)).toBeDefined();
    expect(controllerFor(MeasurePointTool.id)).toBeDefined();
  });

  describe("when a measure tool is opened", function () {
    it("closes the play path panel", function () {
      runInAction(() => {
        viewState.playPathPanelIsVisible = true;
      });

      const tool = controllerFor(MeasureLineTool.id);
      tool.activate();

      expect(viewState.playPathPanelIsVisible).toBe(false);

      tool.deactivate();
    });

    it("closes the download panel", function () {
      runInAction(() => {
        viewState.measurableDownloadPanelIsVisible = true;
      });

      const tool = controllerFor(MeasurePointTool.id);
      tool.activate();

      expect(viewState.measurableDownloadPanelIsVisible).toBe(false);

      tool.deactivate();
    });

    it("leaves the map picking for that tool alone when it is closed again", function () {
      const tool = controllerFor(MeasureLineTool.id);
      tool.activate();
      expect(terria.mapInteractionModeStack.length).toEqual(1);

      tool.deactivate();

      expect(terria.mapInteractionModeStack.length).toEqual(0);
    });
  });
});
