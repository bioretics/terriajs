import React, { createRef, useEffect } from "react";
import styled from "styled-components";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Scene from "terriajs-cesium/Source/Scene/Scene";

const Text: any = require("../../../Styled/Text").default;

type MouseTooltipProps = {
  scene: Scene;
  text: string;
};

const MouseTooltip: React.FC<MouseTooltipProps> = props => {
  const { scene, text } = props;
  const tooltipText = createRef<typeof TooltipText>();

  useEffect(function tooltipFollowMouse() {
    const setTooltipPosition = (position: { x: number; y: number }) => {
      if (tooltipText.current) {
        const width = tooltipText.current.clientWidth;
        const height = tooltipText.current.clientHeight;
        tooltipText.current.style.left = `${position.x - width / 2}px`;
        tooltipText.current.style.top = `${position.y - height - 10}px`;
      }
    };
    setTooltipPosition({
      x: scene.canvas.width / 2,
      y: scene.canvas.height / 2
    });
    scene.canvas.addEventListener("mousemove", setTooltipPosition);

    return () => document.removeEventListener("mousemove", setTooltipPosition);
  });

  useEffect(function setCursor() {
    scene.canvas.style.cursor = `crosshair`;
    return () => {
      scene.canvas.style.cursor = `auto`;
    };
  });

  return (
    <TooltipText ref={tooltipText} dangerouslySetInnerHTML={{ __html: text }} />
  );
};

const TooltipText = styled(Text).attrs({
  small: true,
  textDarker: true,
  textAlignCenter: true
})<{ position: Cartesian2 }>`
  position: absolute;
  width: 200px;
  padding: 0.7em;
  border-radius: ${p => p.theme.radiusSmall};
  border: 1px solid grey;
  background-color: #ffffff;
`;

export default MouseTooltip;
