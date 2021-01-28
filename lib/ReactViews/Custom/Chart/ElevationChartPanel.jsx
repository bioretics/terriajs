"use strict";

import React from "react";

import createReactClass from "create-react-class";

import PropTypes from "prop-types";

import defined from "terriajs-cesium/Source/Core/defined";
import Chart from "./Chart.jsx";
import ChartPanelDownloadButton from "./ChartPanelDownloadButton";
import Loader from "../../Loader.jsx";
import ObserveModelMixin from "../../ObserveModelMixin";
import Icon from "../../Icon.jsx";
import { withTranslation } from "react-i18next";

import Styles from "./chart-panel.scss";

import ChartData from '../../../Charts/ChartData';
import { DataCatalogItem } from "../../DataCatalog/DataCatalogItem.jsx";

const height = 200;

const ElevationChartPanel = createReactClass({
  displayName: "ElevationChartPanel",
  mixins: [ObserveModelMixin],

  propTypes: {
    terria: PropTypes.object.isRequired,
    onHeightChange: PropTypes.func,
    viewState: PropTypes.object.isRequired,
    animationDuration: PropTypes.number,
    t: PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      pos3d: []
    }
  },

  closePanel() {
    this.props.viewState.chartIsOpen = false;
  },

  componentDidUpdate() {
    if (defined(this.props.onHeightChange)) {
      this.props.onHeightChange();
    }
  },

  render() {
    /*const chartableItems = this.props.terria.catalog.chartableItems;
    if (this.props.viewState.chartIsOpen === false) {
      return null;
    }
    let data = [];
    let xUnits;
    chartableItems.forEach(item => {
      const thisData = item.chartData();
      if (!defined(thisData)) {
        return;
      }
      if (item.isEnabled) {
        data = data.concat(thisData);

        if (!defined(xUnits) && defined(item.xAxis)) {
          xUnits = item.xAxis.units;
        }
      }
    });*/

    //let data = [];
    let xUnits;
    /*const item = this.props.terria.elevationPoints;
    const thisData = item.chartData();
    if (!defined(thisData)) {
      return;
    }
    if (item.isEnabled) {
      data = data.concat(thisData);

      if (!defined(xUnits) && defined(item.xAxis)) {
        xUnits = item.xAxis.units;
      }
    }*/

    const chartPoints = [];
    let positions = this.props.terria.elevationPoints[0];
    let stepDistanceMeters = this.props.terria.elevationPoints[1];
    let hasError = false;
    let useKm = false;
    if (positions.length > 1) {
      if (stepDistanceMeters[stepDistanceMeters.length - 1] > 2000) {
        useKm = true;
      }
      for (let i = 0; i < positions.length; ++i) {
        if (isNaN(positions[i].height)) {
          positions = [];
          hasError = true;
          break;
        }
        chartPoints.push({ x: !useKm ? stepDistanceMeters[i] : stepDistanceMeters[i] / 1000, y: Math.round(positions[i].height) });
      }
    }
    const chartData = new ChartData(chartPoints, { name: 'tappe', units: 'm', categoryName: 'altitudine', color: 'white' });
    const data = [chartData];
    if (this.props.terria.sampledElevationPoints) {
      
      let pos3d = this.props.terria.sampledElevationPoints[0];
      let stepDistance3DMetres = this.props.terria.sampledElevationPoints[1];
      if (pos3d && pos3d.length > 1) {
        let newPoints = [];
        for (let i = 0; i < pos3d.length; ++i) {
          newPoints.push({ x: !useKm ? stepDistance3DMetres[i] : stepDistance3DMetres[i] / 1000, y: Math.round(pos3d[i].height) });
        }
        const otherChartData = new ChartData(newPoints, { name: 'dettaglio', units: 'm', categoryName: 'altitudine', color: 'blue' });
        data.push(otherChartData);
      }
    }

    /*const isLoading =
      chartableItems.length > 0 &&
      chartableItems[chartableItems.length - 1].isLoading;*/

    this.props.terria.currentViewer.notifyRepaintRequired();

    let loader;
    let chart;
    /*if (isLoading) {
      loader = <Loader className={Styles.loader} />;
    }*/
    if (data.length > 0) {
      chart = (
        <Chart data={data} height={height} axisLabel={{ x: !useKm ? 'm' : 'Km', y: 'm' }} />
      );
    }
    const { t } = this.props;
    return (
      <div >
        <div className={Styles.header}>
          <label className={Styles.sectionLabel}>
            {loader || "Profilo altimetrico"}
          </label>
          <ChartPanelDownloadButton
            chartableItems={chartPoints}
          />
          <button
            type="button"
            title={t("chart.closePanel")}
            className={Styles.btnCloseChartPanel}
            onClick={this.closePanel}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </div>
        <div>{chart}</div>
      </div>
    );
  }
});

module.exports = withTranslation()(ElevationChartPanel);
