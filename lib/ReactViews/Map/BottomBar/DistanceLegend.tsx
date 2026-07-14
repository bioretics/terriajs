"use strict";
import { observer } from "mobx-react";
import React, { FC, useEffect, useState } from "react";
import { useTheme } from "styled-components";
import isDefined from "../../../Core/isDefined";
import Box from "../../../Styled/Box";
import Text from "../../../Styled/Text";
import { useViewState } from "../../Context";
import {
  DistanceLegendMetrics,
  getDistanceLegendMetricsFromCesium,
  getDistanceLegendMetricsFromLeaflet
} from "../Panels/SharePanel/Print/getDistanceLegendMetrics";

export const DistanceLegend: FC = observer(() => {
  const [distanceLabel, setDistanceLabel] = useState<string>();
  const [barWidth, setBarWidth] = useState<number>(0);

  const { terria } = useViewState();
  const theme = useTheme();

  useEffect(() => {
    const applyMetrics = (metrics: DistanceLegendMetrics | null) => {
      setBarWidth(metrics ? metrics.barWidth : 0);
      setDistanceLabel(metrics ? metrics.label : undefined);
    };

    if (isDefined(terria.cesium)) {
      const scene = terria.cesium.scene;
      return scene.postRender.addEventListener(() => {
        applyMetrics(getDistanceLegendMetricsFromCesium(scene, terria));
      });
    } else if (isDefined(terria.leaflet)) {
      const map = terria.leaflet.map;
      const update = () => {
        applyMetrics(getDistanceLegendMetricsFromLeaflet(map, terria));
      };
      map.on("zoomend", update);
      map.on("moveend", update);
      update();
      return () => {
        map.off("zoomend", update);
        map.off("moveend", update);
      };
    }
  }, [terria, terria.cesium, terria.leaflet]);

  const barStyle = {
    width: barWidth + "px",
    left: 5 + (125 - barWidth) / 2 + "px",
    height: "2px"
  };

  return distanceLabel ? (
    <Box
      column
      centered
      css={`
        margin-top: 3px;
        margin-bottom: 3px;
        &:hover {
          background-color: ${theme.charcoalGrey};
        }
      `}
      paddedHorizontally={2}
      className="tjs-legend__distanceLegend"
    >
      <Text
        as="label"
        mono
        styledLineHeight="1"
        textLight
        styledFontSize="inherit"
      >
        {distanceLabel}
      </Text>
      <div
        style={barStyle}
        className="tjs-legend__bar"
        css={{
          backgroundColor: theme.textLight,
          transition: "all 0.5s ease-in-out 0s"
        }}
      />
    </Box>
  ) : null;
});
