import React, { useState } from "react";
import { runInAction } from "mobx";
import { MeasureLineTool } from "./MeasureLineTool";
import { MeasurePolygonTool } from "./MeasurePolygonTool";
import { GLYPHS, Icon } from "../../../../Styled/Icon";
import { Box } from "../../../../Styled/Box";
import styled from "styled-components";
import MapIconButton from "../../../MapIconButton/MapIconButton";
import i18next from "i18next";
import { MeasureToolsController } from "./MeasureToolsController";
import ViewState from "../../../../ReactViewModels/ViewState";

interface MeasureToolsProps {
  controller: MeasureToolsController;
  viewState: ViewState;
}

const MeasureTools: React.FC<MeasureToolsProps> = ({
  controller,
  viewState
}) => {
  const [isOpen, setIsOpen] = useState(false);

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

  const options = [
    {
      id: MeasureLineTool.id,
      name: i18next.t("measure.measureLineToolTitle"),
      glyph: GLYPHS.measure
    },
    {
      id: MeasurePolygonTool.id,
      name: i18next.t("measure.measurePolygonToolTitle"),
      glyph: GLYPHS.measurePolygon
    }
  ];

  const toggleList = () => setIsOpen(!isOpen);

  return (
    <Control onClick={toggleList}>
      <MapIconButton
        expandInPlace={true}
        noExpand={false}
        iconElement={() => <Icon glyph={GLYPHS.map} />}
        title={i18next.t("measure.measureTool")}
        disabled={false}
        primary={isOpen}
      >
        {i18next.t("measure.measureToolTitle")}
      </MapIconButton>
      <StyledList isOpen={isOpen}>
        {options.map((option) => (
          <StyledLi key={option.id}>
            <MapIconButton
              iconElement={() => <Icon glyph={option.glyph} />}
              title={option.name}
              onClick={() => controller.activateTool(option.id)}
              disabled={false}
            >
              {option.name}
            </MapIconButton>
          </StyledLi>
        ))}
      </StyledList>
    </Control>
  );
};

const Control = styled(Box).attrs({
  centered: true,
  column: true
})`
  pointer-events: auto;
  text-align: center;
  cursor: pointer;
`;

const StyledList = styled(Box)<{ isOpen: boolean }>`
  list-style-type: none;
  padding: 0;
  margin: 0;
  position: absolute;
  top: 100%;
  right: 0;
  display: flex;
  flex-direction: row-reverse;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  opacity: ${(props) => (props.isOpen ? 1 : 0)};
  visibility: ${(props) => (props.isOpen ? "visible" : "hidden")};
  transform: translateY(${(props) => (props.isOpen ? "0" : "-10px")});
  transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;

  ${Control}:hover & {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    top: auto;
    bottom: 100%;
    right: 0;
    flex-direction: column;
    transform: translateY(${(props) => (props.isOpen ? "0" : "10px")});
  }
`;

const StyledLi = styled(Box)`
  padding: 10px 15px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  background-color: white;
  border-left: 1px solid #ccc;
  color: #333;

  &:hover {
    background-color: #f0f0f0;
    color: #000;
  }

  &:first-child {
    border-left: none;
  }

  button {
    width: 100%;
    text-align: center;
    background: none;
    border: none;
    padding: 0;
    font-size: 14px;
    color: inherit;
    cursor: pointer;
    outline: none;

    &:hover {
      text-decoration: underline;
    }
  }

  @media (max-width: 768px) {
    border-left: none;
    border-bottom: 1px solid #ccc;
    &:last-child {
      border-bottom: none;
    }
  }
`;

export default MeasureTools;
