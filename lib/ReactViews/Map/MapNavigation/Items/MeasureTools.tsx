import React from "react";
import { runInAction } from "mobx";
import { MeasureLineTool } from "./MeasureLineTool";
import { MeasurePolygonTool } from "./MeasurePolygonTool";
import { Box } from "../../../../Styled/Box";
import styled from "styled-components";
import { MeasureToolsController } from "./MeasureToolsController";
import ViewState from "../../../../ReactViewModels/ViewState";
import { MapNavigationItem } from "./MapNavigationItem";
import { IMapNavigationItem } from "../../../../ViewModels/MapNavigation/MapNavigationModel";

interface MeasureToolsProps {
  viewState: ViewState;
}

const MeasureTools: React.FC<MeasureToolsProps> = ({ viewState }) => {
  const measureLineTool = new MeasureLineTool({
    terria: viewState.terria,
    onClose: () => {
      runInAction(() => {
        viewState.terria.mapNavigationModel.enable(MeasurePolygonTool.id);
        viewState.panel = undefined;
        viewState.measurablePanelIsVisible = false;
        viewState.measurableChartIsVisible = false;
      });
    },
    onOpen: () => {
      runInAction(() => {
        const item = viewState.terria.mapNavigationModel.findItem(
          MeasurePolygonTool.id
        )?.controller;
        if (item && item.active) {
          item.deactivate();
        }
        viewState.terria.mapNavigationModel.disable(MeasurePolygonTool.id);
      });
    }
  });
  measureLineTool.setVisible(false);
  const measureLineToolItem: IMapNavigationItem = {
    id: MeasureLineTool.id,
    name: "translate#measure.measureLineToolTitle",
    title: "translate#measure.measureDistance",
    location: "TOP",
    controller: measureLineTool,
    screenSize: undefined,
    order: 6
  };

  const measurePolygonTool = new MeasurePolygonTool({
    terria: viewState.terria,
    onClose: () => {
      runInAction(() => {
        viewState.terria.mapNavigationModel.enable(MeasureLineTool.id);
        viewState.panel = undefined;
        viewState.measurablePanelIsVisible = false;
        viewState.measurableChartIsVisible = false;
      });
    },
    onOpen: () => {
      runInAction(() => {
        const item = viewState.terria.mapNavigationModel.findItem(
          MeasureLineTool.id
        )?.controller;
        if (item && item.active) {
          item.deactivate();
        }
        viewState.terria.mapNavigationModel.disable(MeasureLineTool.id);
      });
    }
  });
  measurePolygonTool.setVisible(false);
  const measurePolygonToolItem: IMapNavigationItem = {
    id: MeasurePolygonTool.id,
    name: "translate#measure.measurePolygonToolTitle",
    title: "translate#measure.measureArea",
    location: "TOP",
    controller: measurePolygonTool,
    screenSize: undefined,
    order: 6
  };

  viewState.terria.mapNavigationModel.addItem(measureLineToolItem);
  viewState.terria.mapNavigationModel.addItem(measurePolygonToolItem);

  const measureToolsController = new MeasureToolsController();

  return (
    <MapNavigationItem
      terria={viewState.terria}
      item={{
        id: MeasureToolsController.id,
        name: "translate#measure.measureToolTitle",
        title: "translate#measure.measureTool",
        location: "TOP",
        screenSize: undefined,
        controller: measureToolsController,
        order: 6,
        childrenItems: [measureLineToolItem, measurePolygonToolItem]
      }}
    />
  );
};

export default MeasureTools;
