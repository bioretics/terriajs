"use strict";

import { values } from "mobx";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React from "react";
import defined from "terriajs-cesium/Source/Core/defined";
import Icon from "../../../Styled/Icon";
import Chart from "./BottomDockChart";
import Styles from "./chart-panel.scss";
import { action } from "mobx";

const height = 300;

@observer
class ElevationChartPanel extends React.Component {
  static displayName = "ElevationChartPanel";

  static propTypes = {
    terria: PropTypes.object.isRequired,
    onHeightChange: PropTypes.func,
    viewState: PropTypes.object.isRequired,
    animationDuration: PropTypes.number
  };

  @action
  closePanel() {
    this.props.viewState.elevationChartIsVisible = false;
  }

  componentDidUpdate() {
    if (defined(this.props.onHeightChange)) {
      this.props.onHeightChange();
    }
  }

  render() {
    const chartItems = [];

    if (
      !!this.props.terria?.pathPoints &&
      this.props.terria.pathPoints.slice().length > 0
    ) {
      /* const pointItem = new GeoJsonCatalogItem(createGuid(), this.props.terria);
      pointItem.setTrait(
        CommonStrata.user,
        "style",
        createStratumInstance(StyleTraits, {
          "stroke-width": 3,
          "marker-size": "30",
          stroke: "#ffffff",
          "marker-color": "#f00",
          "marker-opacity": 1
        })
      );
      pointItem.setTrait(CommonStrata.user, "geoJsonData", {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          //coordinates: [props.point.longitude, props.point.latitude]
          coordinates: [this.props.terria.pathPoints[0].longitude, this.props.terria.pathPoints[0].latitude]
        }
      });
      pointItem.setTrait(CommonStrata.user, "show", true);
      pointItem.setTrait(CommonStrata.user, "isOpenInWorkbench", true);
      pointItem.setTrait(CommonStrata.user, "isOpen", true);
      pointItem.setTrait(CommonStrata.underride, "name", "marco");
      this.props.terria.addModel(pointItem);
      this.props.terria.overlays.add(pointItem); */

      const pathDistances = this.props.terria.pathDistances.slice();
      const y = this.props.terria.pathPoints
        .slice()
        .map((p) => Math.round(p.height));
      const item = {
        categoryName: "Percorso",
        name: "in aria",
        units: "m",
        isSelectedInWorkbench: false,
        points: y.map((h, i) => ({
          x: pathDistances
            .map((v, j) => (j <= i ? v : 0))
            .reduce((a, b) => a + b, 0)
            .toFixed(2),
          y: h
        })),
        // "pointOnMap": points.map(p => ({ "latitude": p.latitude, "longitude": p.longitude })),
        key: "path",
        type: "lineAndPoint",
        glyphStyle: "circle",
        getColor: () => "#f00",
        domain: {
          x: [0, pathDistances.reduce((a, b) => a + b, 0)],
          y: [Math.min(...y), Math.max(...y)]
        }
      };
      chartItems.push(item);

      const pathSampled = values(this.props.terria.pathSampled).sort(
        (a, b) => a.index > b.index
      );
      const sampledX = [];
      const sampledY = [];
      let distance = 0;
      pathSampled.forEach((elem) => {
        elem.stepDistances.forEach((dist, i) => {
          distance += dist;
          sampledX.push(distance.toFixed(2));
          sampledY.push(Math.round(elem.stepHeights[i]));
        });
      });
      const itemSampled = {
        categoryName: "Percorso",
        name: "a terra",
        units: "m",
        isSelectedInWorkbench: false,
        points: sampledX.map((v, i) => {
          return { x: v, y: sampledY[i] };
        }),
        key: "path_sampled",
        type: "line",
        glyphStyle: "circle",
        getColor: () => "#0f0",
        domain: {
          x: [0, distance],
          y: [Math.min(...sampledY), Math.max(...sampledY)]
        }
      };
      chartItems.push(itemSampled);

      this.props.terria.currentViewer.notifyRepaintRequired();
    }

    return (
      <div className={Styles.holder}>
        <div className={Styles.inner}>
          <div className={Styles.chartPanel} style={{ height: height }}>
            <div className={Styles.body}>
              <div className={Styles.header}>
                <label className={Styles.sectionLabel}>
                  Profilo altimetrico
                </label>
                <button
                  type="button"
                  className={Styles.btnCloseChartPanel}
                  onClick={() => this.closePanel()}
                >
                  <Icon glyph={Icon.GLYPHS.close} />
                </button>
              </div>
              <div className={Styles.chart}>
                {!!chartItems && (
                  <Chart
                    terria={this.props.terria}
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
      </div>
    );
  }
}

export default ElevationChartPanel;
