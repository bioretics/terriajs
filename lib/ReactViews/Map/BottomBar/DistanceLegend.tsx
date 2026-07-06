"use strict";
import L from "leaflet";
import { observer } from "mobx-react";
import React, { FC, useEffect, useState } from "react";
import { useTheme } from "styled-components";
import CesiumEvent from "terriajs-cesium/Source/Core/Event";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import isDefined from "../../../Core/isDefined";
import Box from "../../../Styled/Box";
import Text from "../../../Styled/Text";
import { useViewState } from "../../Context";
import {
  getDistanceLegendMetricsFromCesium,
  getDistanceLegendMetricsFromLeaflet
} from "../Panels/SharePanel/Print/getDistanceLegendMetrics";

interface IDistanceLegendProps {
  scale?: number;
  isPrintMode?: boolean;
}

export const DistanceLegend: FC<IDistanceLegendProps> = observer(
  ({ scale = 1, isPrintMode = false }) => {
    const [distanceLabel, setDistanceLabel] = useState<string>();
    const [barWidth, setBarWidth] = useState<number>(0);

    const { terria } = useViewState();
    const theme = useTheme();

    let removeUpdateSubscription:
      | CesiumEvent.RemoveCallback
      | (() => void)
      | undefined;

    useEffect(() => {
      const viewerSubscriptions: CesiumEvent.RemoveCallback[] = [];
      /* eslint-disable-next-line react-hooks/exhaustive-deps */
      removeUpdateSubscription = addUpdateSubscription();

      return () => {
        if (removeUpdateSubscription) {
          removeUpdateSubscription();
        }
        viewerSubscriptions.forEach((clear) => clear());
      };
    }, [terria.cesium, terria.leaflet]);

    const addUpdateSubscription = ():
      | CesiumEvent.RemoveCallback
      | (() => void)
      | undefined => {
      if (isDefined(terria.cesium)) {
        const scene = terria.cesium.scene;
        let removeUpdateSubscription: CesiumEvent.RemoveCallback | undefined =
          scene.postRender.addEventListener(() => {
            updateDistanceLegendCesium(scene);
            if (isPrintMode) {
              removeUpdateSubscription?.();
              removeUpdateSubscription = undefined;
            }
          });
        return removeUpdateSubscription;
      } else if (isDefined(terria.leaflet)) {
        const map = terria.leaflet.map;
        let removeUpdateSubscription: (() => void) | undefined = undefined;

        if (!isPrintMode) {
          const potentialChangeCallback = function potentialChangeCallback() {
            updateDistanceLegendLeaflet(map);
          };
          removeUpdateSubscription = function () {
            map.off("zoomend", potentialChangeCallback);
            map.off("moveend", potentialChangeCallback);
          };

          map.on("zoomend", potentialChangeCallback);
          map.on("moveend", potentialChangeCallback);
        }

        updateDistanceLegendLeaflet(map);
        return removeUpdateSubscription;
      }
    };

    const updateDistanceLegendCesium = (scene: Scene) => {
      const metrics = getDistanceLegendMetricsFromCesium(scene, terria, scale);
      if (metrics) {
        setBarWidth(metrics.barWidth);
        setDistanceLabel(metrics.label);
      } else {
        setBarWidth(0);
        setDistanceLabel(undefined);
      }
    };

    const updateDistanceLegendLeaflet = (map: L.Map) => {
      const metrics = getDistanceLegendMetricsFromLeaflet(map, terria, scale);
      if (metrics) {
        setBarWidth(metrics.barWidth);
        setDistanceLabel(metrics.label);
      } else {
        setBarWidth(0);
        setDistanceLabel(undefined);
      }
    };

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
  }
);
