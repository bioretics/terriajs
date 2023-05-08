//"use strict";

import { observer } from "mobx-react";
import React, { useState, useEffect, useRef } from "react";
import Icon from "../../../Styled/Icon";
import Chart from "./BottomDockChart";
import Styles from "./chart-panel.scss";
import { action } from "mobx";
import ViewState from "../../../ReactViewModels/ViewState";
import Terria from "../../../Models/Terria";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumColor from "terriajs-cesium/Source/Core/Color";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import VerticalOrigin from "terriajs-cesium/Source/Scene/VerticalOrigin";
import BillboardCollection from "terriajs-cesium/Source/Scene/BillboardCollection";

//import markerIcon from "../../../Models/markerIcon";
import markerIcon from "./markerIcon";

enum ChartKeys {
  AirChart = "path",
  GroundChart = "path_sampled"
}

interface ChartPoint {
  x: number;
  y: number;
}

interface ChartItem {
  categoryName: string;
  name: string;
  units: string;
  key: string;
  type: string;
  glyphStyle: string;
  getColor: () => string;
  points: ChartPoint[];
  domain: { x: number[]; y: number[] };
}

interface Props {
  terria: Terria;
  viewState: ViewState;
}

const ElevationChartPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const PANEL_HEIGHT = 300;
  const CHART_HEIGHT = 266;

  const [chartItems, setChartItems] = useState<ChartItem[]>();

  const chartPoint = useRef<ChartPoint>();
  const billboardCollection = useRef<BillboardCollection>();

  const closePanel = action(() => {
    viewState.elevationChartIsVisible = false;
  });

  const fetchPathDataChart = (
    points: Cartographic[] | undefined,
    distances: number[] | undefined,
    totalDistance: number | undefined
  ) => {
    if (!points || !distances || !totalDistance) {
      return;
    }

    const pointsHeight = points.map((point) => point.height);

    const chartPoints = pointsHeight.map((height, i) => ({
      x: distances.map((v, j) => (j <= i ? v : 0)).reduce((a, b) => a + b, 0),
      y: height
    }));

    const chartDomain = {
      x: [0, totalDistance],
      y: [Math.min(...pointsHeight), Math.max(...pointsHeight)]
    };

    return { chartPoints, chartDomain };
  };

  const updateChartPointNearMouse = (newPoint: ChartPoint) => {
    if (
      newPoint &&
      terria?.cesium?.scene &&
      (!chartPoint?.current || chartPoint.current !== newPoint)
    ) {
      chartPoint.current = newPoint;

      const pointIndex = chartItems
        ?.find((item) => item.key === ChartKeys.GroundChart)
        ?.points.findIndex((elem) => elem === newPoint);
      if (!pointIndex) return;
      const coords = terria?.path?.sampledPoints?.[pointIndex];
      if (!coords) return;

      if (!billboardCollection.current) {
        billboardCollection.current = new BillboardCollection({
          scene: terria.cesium.scene
        });
        terria.cesium.scene.primitives.add(billboardCollection.current);
      }
      billboardCollection.current.removeAll();
      billboardCollection.current.add({
        position: Cartographic.toCartesian(coords),
        scale: 0.4,
        verticalOrigin: VerticalOrigin.BOTTOM,
        image: markerIcon,
        //color: new CesiumColor(0.0, 1.0, 0.0, 0.5),
        //disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        id: "chartPointPlaceholder"
      });

      terria.currentViewer.notifyRepaintRequired();
    } else if (newPoint === undefined && billboardCollection.current) {
      billboardCollection.current.removeAll();
    }
  };

  useEffect(() => {
    if (terria?.path) {
      const airData = fetchPathDataChart(
        terria.path.stopPoints,
        terria.path.stopAirDistances,
        terria.path.airDistance
      );
      const groundData = fetchPathDataChart(
        terria.path.sampledPoints,
        terria.path.sampledDistances,
        terria.path.groundDistance
      );

      const items: ChartItem[] = [];

      if (groundData?.chartPoints && groundData.chartDomain) {
        items.push({
          categoryName: "Percorso",
          name: "al suolo",
          units: "m",
          key: ChartKeys.GroundChart,
          type: "lineAndPoint",
          glyphStyle: "circle",
          getColor: () => "#0f0",
          points: groundData?.chartPoints,
          domain: groundData?.chartDomain
        });
      }
      if (airData?.chartPoints && airData.chartDomain) {
        items.push({
          categoryName: "Percorso",
          name: "in aria",
          units: "m",
          key: ChartKeys.AirChart,
          type: "lineAndPoint",
          glyphStyle: "circle",
          getColor: () => "#f00",
          points: airData?.chartPoints,
          domain: airData?.chartDomain
        });
      }

      setChartItems(items);
    }
  }, [terria.path, terria.samplingPathStep]);

  return (
    <div className={Styles.holder}>
      <div className={Styles.inner}>
        <div className={Styles.chartPanel} style={{ height: PANEL_HEIGHT }}>
          <div className={Styles.header}>
            <label className={Styles.sectionLabel}>Profilo altimetrico</label>
            <button
              type="button"
              className={Styles.btnCloseChartPanel}
              onClick={closePanel}
            >
              <Icon glyph={Icon.GLYPHS.close} />
            </button>
          </div>
          <div className={Styles.chart}>
            {chartItems && (
              <Chart
                terria={terria}
                chartItems={chartItems}
                xAxis={{
                  scale: "linear",
                  units: "m"
                }}
                height={CHART_HEIGHT}
                chartItemKeyForPointMouseNear={ChartKeys.GroundChart}
                onPointMouseNear={updateChartPointNearMouse}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ElevationChartPanel;
