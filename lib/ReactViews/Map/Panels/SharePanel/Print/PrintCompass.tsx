import React, { FC, useEffect, useState } from "react";
import styled from "styled-components";
import CesiumEvent from "terriajs-cesium/Source/Core/Event";
import isDefined from "../../../../../Core/isDefined";
import Terria from "../../../../../Models/Terria";
import {
  BASE_COMPASS_SIZE,
  COMPASS_INNER_DATA_URI,
  COMPASS_OUTER_DATA_URI
} from "./printCompassAssets";
import { getMapHeading } from "./getDistanceLegendMetrics";

interface IPrintCompassProps {
  terria: Terria;
  scale?: number;
}

const PrintCompassContainer = styled.div<{ $size: number }>`
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  background: white;
  padding: 5px;
  box-sizing: content-box;
`;

const CompassRing = styled.div`
  position: absolute;
  top: 5px;
  left: 5px;
  width: 100%;
  height: 100%;
`;

const CompassInner = styled.img`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
  height: 70%;
  pointer-events: none;
`;

const CompassOuter = styled.img`
  display: block;
  width: 100%;
  height: 100%;
`;

const PrintCompass: FC<IPrintCompassProps> = ({ terria, scale = 1 }) => {
  const [heading, setHeading] = useState(() => getMapHeading(terria));
  const size = BASE_COMPASS_SIZE * scale;

  useEffect(() => {
    if (isDefined(terria.cesium)) {
      const scene = terria.cesium.scene;
      setHeading(scene.camera.heading);
      const removeSubscription = scene.postRender.addEventListener(() => {
        setHeading(scene.camera.heading);
      });
      return () => {
        removeSubscription();
      };
    }
    setHeading(0);
  }, [terria.cesium]);

  const rotationStyle = {
    transform: `rotate(-${heading}rad)`,
    WebkitTransform: `rotate(-${heading}rad)`
  };

  return (
    <PrintCompassContainer $size={size} className="tjs-print__compass">
      <CompassRing style={rotationStyle}>
        <CompassOuter src={COMPASS_OUTER_DATA_URI} alt="" />
      </CompassRing>
      <CompassInner src={COMPASS_INNER_DATA_URI} alt="North" />
    </PrintCompassContainer>
  );
};

export default PrintCompass;
