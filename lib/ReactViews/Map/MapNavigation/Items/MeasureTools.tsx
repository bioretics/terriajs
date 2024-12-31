import React, { useState } from "react";
import { MeasureLineTool } from "./MeasureLineTool";
import { MeasurePolygonTool } from "./MeasurePolygonTool";
import { GLYPHS, Icon } from "../../../../Styled/Icon";
import { Box } from "../../../../Styled/Box";
import styled from "styled-components";
import MapIconButton from "../../../MapIconButton/MapIconButton";

interface MeasureToolsProps {
  controller: {
    toggleDropdown: () => void;
    activateTool: (toolId: string) => void;
  };
}

const MeasureTools: React.FC<MeasureToolsProps> = ({ controller }) => {
  const [isOpen, setIsOpen] = useState(false);

  const options = [
    {
      id: MeasureLineTool.id,
      name: MeasureLineTool.name,
      glyph: GLYPHS.measure
    },
    {
      id: MeasurePolygonTool.id,
      name: MeasurePolygonTool.name,
      glyph: GLYPHS.measurePolygon
    }
  ];

  const toggleList = () => {
    setIsOpen(!isOpen);
    controller.toggleDropdown();
  };

  return (
    <Control>
      <MapIconButton
        expandInPlace={true}
        noExpand={false}
        iconElement={() => <Icon glyph={GLYPHS.map} />}
        title="Open Measure Tools"
        onClick={toggleList}
        disabled={false}
        primary={isOpen}
      >
        Measure Tools
      </MapIconButton>

      {isOpen && (
        <StyledList>
          {options.map((option) => (
            <StyledLi key={option.id}>
              <MapIconButton
                iconElement={() => <Icon glyph={option.glyph} />}
                title={option.name}
                onClick={() => {
                  controller.activateTool(option.id);
                }}
                disabled={false}
              >
                {option.name}
              </MapIconButton>
            </StyledLi>
          ))}
        </StyledList>
      )}
    </Control>
  );
};

const StyledList = styled(Box)`
  list-style-type: none;
  padding: 0;
  margin: 0;
  position: absolute;
  top: -10px;
  right: 150px;
  width: 100px;
  z-index: 1000;
`;

const StyledLi = styled(Box)`
  padding: 10px;
  cursor: pointer;
  background: #fff;
  button {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    font-size: 14px;
    color: #333;

    &:hover {
      background-color: #f0f0f0;
    }
  }
`;

const Control = styled(Box).attrs({
  centered: true,
  column: true
})`
  pointer-events: auto;
  text-align: center;
`;

export default MeasureTools;
