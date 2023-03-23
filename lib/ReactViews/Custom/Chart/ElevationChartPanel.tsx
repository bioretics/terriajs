//"use strict";

import { observer } from "mobx-react";
import React, { useState, useEffect } from "react";
import Icon from "../../../Styled/Icon";
import Chart from "./BottomDockChart";
import Styles from "./chart-panel.scss";
import { action } from "mobx";
import ViewState from "../../../ReactViewModels/ViewState";
import Terria from "../../../Models/Terria";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import GeoJsonCatalogItem from "../../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../../Models/Definition/CommonStrata";
import createStratumInstance from "../../../Models/Definition/createStratumInstance";
import StyleTraits from "../../../Traits/TraitsClasses/StyleTraits";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import { addMarker } from "../../../Models/LocationMarkerUtils";

const height = 300;

interface Props {
  terria: Terria;
  viewState: ViewState;
}

const ElevationChartPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const [chartItems, setChartItems] = useState<any[]>();

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

      const items = [];

      if (airData?.chartPoints && airData.chartDomain) {
        items.push({
          categoryName: "Percorso",
          name: "in aria",
          units: "m",
          isSelectedInWorkbench: false,
          key: "path",
          type: "lineAndPoint",
          glyphStyle: "circle",
          getColor: () => "#f00",
          points: airData?.chartPoints,
          domain: airData?.chartDomain
        });
      }
      if (groundData?.chartPoints && groundData.chartDomain) {
        ////////////////////
        /*const _marker = new GeoJsonCatalogItem(createGuid(), terria);
        _marker.setTrait(CommonStrata.user, "name", "ciccio");
        _marker.setTrait(
          CommonStrata.user,
          "description",
          "Posizione dell'utente"
        );
        _marker.setTrait(CommonStrata.user, "geoJsonData", {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              CesiumMath.toDegrees(terria.path?.sampledPoints?.[2].longitude ?? 0),
              CesiumMath.toDegrees(terria.path?.sampledPoints?.[2].latitude ?? 0)
            ]
          },
          properties: {
            title: "urca urca",
            longitude: terria.path?.sampledPoints?.[20].longitude,
            latitude: terria.path?.sampledPoints?.[20].latitude
          }
        });
        _marker.setTrait(
          CommonStrata.user,
          "style",
          createStratumInstance(StyleTraits, {
            "marker-size": "25",
            "marker-color": "#FFABD5",
            stroke: "#ffffff",
            "stroke-width": 3
          })
        );
        _marker.setTrait(CommonStrata.user, "clampToGround", true);
        terria.workbench.add(_marker);*/

        console.log("birra");
        addMarker(terria, {
          name: "ciao",
          location: {
            longitude: CesiumMath.toDegrees(
              terria.path?.sampledPoints?.[2].longitude ?? 0
            ),
            latitude: CesiumMath.toDegrees(
              terria.path?.sampledPoints?.[2].latitude ?? 0
            )
          }
        });

        items.push({
          categoryName: "Percorso",
          name: "al suolo",
          units: "m",
          //isSelectedInWorkbench: false,
          key: "path_sampled",
          type: "line",
          glyphStyle: "circle",
          getColor: () => "#0f0",
          points: groundData?.chartPoints,
          domain: groundData?.chartDomain /*,
            pointOnMap: { "latitude": terria.path?.sampledPoints?.[20].latitude, "longitude": terria.path?.sampledPoints?.[20].longitude },
            isSelectedInWorkbench: true,
            showInChartPanel: true,
            updateIsSelectedInWorkbench: () => {},*/
        });
      }

      setChartItems(items);
    }
  }, [terria.path, terria.samplingPathStep]);

  return (
    <div className={Styles.holder}>
      <div className={Styles.inner}>
        <div className={Styles.chartPanel} style={{ height: height }}>
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
                height={height - 34}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ElevationChartPanel;
