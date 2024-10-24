import { runInAction } from "mobx";
import React from "react";
import AugmentedVirtuality from "../../../Models/AugmentedVirtuality";
import ViewerMode from "../../../Models/ViewerMode";
import ViewState from "../../../ReactViewModels/ViewState";
import { GLYPHS } from "../../../Styled/Icon";
import { GenericMapNavigationItemController } from "../../../ViewModels/MapNavigation/MapNavigationItemController";
import {
  FeedbackButtonController,
  FEEDBACK_TOOL_ID
} from "../../Feedback/FeedbackButtonController";
import PedestrianMode, {
  PEDESTRIAN_MODE_ID
} from "../../Tools/PedestrianMode/PedestrianMode";
import { ToolButtonController } from "../../Tools/Tool";
import {
  AR_TOOL_ID,
  AugmentedVirtualityController,
  AugmentedVirtualityHoverController,
  AugmentedVirtualityRealign,
  AugmentedVirtualityRealignController
} from "./Items/AugmentedVirtualityTool";
import CloseToolButton from "./Items/CloseToolButton";
import Compass, { COMPASS_TOOL_ID } from "./Items/Compass";
import MeasureTool from "./Items/MeasureTool";
import MeasureAreaTool from "./Items/MeasureAreaTool";
import { ToggleInfoController } from "./Items/ToggleInfoTool";
import MyLocation from "./Items/MyLocation";
import { ToggleSplitterController } from "./Items/ToggleSplitterTool";
import ZoomControl, { ZOOM_CONTROL_ID } from "./Items/ZoomControl";

export const CLOSE_TOOL_ID = "close-tool";

export const registerMapNavigations = (viewState: ViewState) => {
  const terria = viewState.terria;
  const mapNavigationModel = terria.mapNavigationModel;

  const compassController = new GenericMapNavigationItemController({
    viewerMode: ViewerMode.Cesium,
    icon: GLYPHS.compassInnerArrows
  });
  compassController.pinned = true;
  mapNavigationModel.addItem({
    id: COMPASS_TOOL_ID,
    name: "translate#compass",
    controller: compassController,
    location: "TOP",
    order: 1,
    screenSize: "medium",
    render: <Compass terria={terria} viewState={viewState} />
  });

  const zoomToolController = new GenericMapNavigationItemController({
    viewerMode: undefined,
    icon: GLYPHS.zoomIn
  });
  zoomToolController.pinned = true;
  mapNavigationModel.addItem({
    id: ZOOM_CONTROL_ID,
    name: "translate#zoom",
    controller: zoomToolController,
    location: "TOP",
    order: 2,
    screenSize: undefined,
    render: <ZoomControl terria={terria} viewState={viewState} />
  });

  if (terria.configParameters.useMyLocationFromDesktop) {
    const myLocation = new MyLocation({ terria });
    mapNavigationModel.addItem({
      id: MyLocation.id,
      name: "translate#location.location",
      title: "translate#location.centreMap",
      location: "TOP",
      controller: myLocation,
      screenSize: "medium",
      order: 7
    });
    mapNavigationModel.addItem({
      id: MyLocation.id + "_small",
      name: "translate#location.location",
      title: "translate#location.centreMap",
      location: "TOP",
      controller: myLocation,
      screenSize: "small",
      order: 3
    });
  }

  const toggleSplitterController = new ToggleSplitterController(viewState);
  mapNavigationModel.addItem({
    id: ToggleSplitterController.id,
    name: "translate#splitterTool.toggleSplitterToolTitle",
    title: runInAction(() =>
      toggleSplitterController.disabled
        ? "translate#splitterTool.toggleSplitterToolDisabled"
        : "translate#splitterTool.toggleSplitterTool"
    ),
    location: "TOP",
    controller: toggleSplitterController,
    screenSize: undefined,
    order: 6
  });

  const measureTool = new MeasureTool({
    terria,
    onClose: () => {
      runInAction(() => {
        viewState.terria.mapNavigationModel.enable(MeasureAreaTool.id);
        viewState.panel = undefined;
      });
    },
    onOpen: () => {
      runInAction(() => {
        const item = viewState.terria.mapNavigationModel.findItem(
          MeasureAreaTool.id
        )?.controller;
        if (item && item.active) {
          item.deactivate();
        }
        viewState.terria.mapNavigationModel.disable(MeasureAreaTool.id);
      });
    }
  });
  mapNavigationModel.addItem({
    id: MeasureTool.id,
    name: "translate#measure.measureToolTitle",
    title: `:Misura la lunghezza di una linea spezzata (o percorso) definita tramite punti
    clicca sulla mappa per aggiungere un altro punto-
    clicca su un segmento esistente per spezzarlo con un nuovo punto-
    clicca su un punto esistente per rimuoverlo-
    trascina un punto per spostarlo-`,
    location: "TOP",
    controller: measureTool,
    screenSize: undefined,
    order: 4
  });

  const measureAreaTool = new MeasureAreaTool({
    terria,
    onClose: () => {
      runInAction(() => {
        viewState.terria.mapNavigationModel.enable(MeasureTool.id);
        viewState.panel = undefined;
      });
    },
    onOpen: () => {
      runInAction(() => {
        const item = viewState.terria.mapNavigationModel.findItem(
          MeasureTool.id
        )?.controller;
        if (item && item.active) {
          item.deactivate();
        }
        viewState.terria.mapNavigationModel.disable(MeasureTool.id);
      });
    }
  });
  mapNavigationModel.addItem({
    id: MeasureAreaTool.id,
    name: "Misuratore di aree",
    title: `:Misura l'area di un poligono definito tramite punti
    i poligoni sono chiusi automaticamente-
    clicca sulla mappa per aggiungere un altro punto-
    clicca su un segmento esistente per spezzarlo con un nuovo punto-
    clicca su un punto esistente per rimuoverlo-
    trascina un punto per spostarlo-`,
    location: "TOP",
    controller: measureAreaTool,
    screenSize: undefined,
    order: 5
  });

  const toggleInfoController = new ToggleInfoController(viewState);
  mapNavigationModel.addItem({
    id: ToggleInfoController.id,
    name: "Info",
    title: "Interroga la mappa cliccando in un punto",
    location: "TOP",
    controller: toggleInfoController,
    screenSize: undefined,
    order: 3
  });

  const pedestrianModeToolController = new ToolButtonController({
    toolName: PEDESTRIAN_MODE_ID,
    viewState: viewState,
    getToolComponent: () => PedestrianMode as any,
    icon: GLYPHS.pedestrian
  });
  mapNavigationModel.addItem({
    id: PEDESTRIAN_MODE_ID,
    name: "translate#pedestrianMode.toolButtonTitle",
    title: "translate#pedestrianMode.toolButtonTitle",
    location: "TOP",
    screenSize: "medium",
    controller: pedestrianModeToolController,
    order: 9
  });

  const closeToolButtonController = new GenericMapNavigationItemController({
    handleClick: () => {
      viewState.closeTool();
    },
    icon: GLYPHS.closeLight
  });
  mapNavigationModel.addItem({
    id: CLOSE_TOOL_ID,
    name: "translate#close",
    location: "TOP",
    screenSize: undefined,
    controller: closeToolButtonController,
    render: <CloseToolButton viewState={viewState} />,
    order: 7
  });
  closeToolButtonController.setVisible(false);

  const augmentedVirtuality = new AugmentedVirtuality(terria);
  const arController = new AugmentedVirtualityController({
    terria: terria,
    viewState: viewState,
    augmentedVirtuality: augmentedVirtuality
  });
  mapNavigationModel.addItem({
    id: AR_TOOL_ID,
    name: "translate#AR.arTool",
    location: "TOP",
    screenSize: "small",
    controller: arController,
    order: 0,
    noExpand: true
  });

  const arControllerHover = new AugmentedVirtualityHoverController({
    augmentedVirtuality: augmentedVirtuality
  });
  mapNavigationModel.addItem({
    id: `${AR_TOOL_ID}_hover`,
    name: "translate#AR.btnHover",
    location: "TOP",
    screenSize: "small",
    controller: arControllerHover,
    order: 1,
    noExpand: true
  });

  const arRealignController = new AugmentedVirtualityRealignController({
    terria: terria,
    viewState: viewState,
    augmentedVirtuality: augmentedVirtuality
  });
  mapNavigationModel.addItem({
    id: `${AR_TOOL_ID}_realign`,
    name: runInAction(() =>
      augmentedVirtuality.manualAlignmentSet
        ? "translate#AR.btnRealign"
        : "translate#AR.btnResetRealign"
    ),
    location: "TOP",
    screenSize: "small",
    controller: arRealignController,
    render: (
      <AugmentedVirtualityRealign arRealignController={arRealignController} />
    ),
    order: 1,
    noExpand: true
  });

  const feedbackController = new FeedbackButtonController(viewState);
  mapNavigationModel.addItem({
    id: FEEDBACK_TOOL_ID,
    name: "translate#feedback.feedbackBtnText",
    title: "translate#feedback.feedbackBtnText",
    location: "BOTTOM",
    screenSize: "medium",
    controller: feedbackController,
    order: 8
  });
};
