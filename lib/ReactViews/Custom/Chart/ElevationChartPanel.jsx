"use strict";

import React from "react";

import createReactClass from "create-react-class";

import PropTypes from "prop-types";

import defined from "terriajs-cesium/Source/Core/defined";
import Chart from "./Chart.jsx";
import ObserveModelMixin from "../../ObserveModelMixin";
import Icon from "../../Icon.jsx";
import { withTranslation } from "react-i18next";

import Styles from "./chart-panel.scss";

import ChartData from '../../../Charts/ChartData';

import FeatureDetection from "terriajs-cesium/Source/Core/FeatureDetection";
import FileSaver from "file-saver";

import Dropdown from "../../Generic/Dropdown";
import StylesFeatureDownload from "../../FeatureInfo/feature-info-download.scss";

var CesiumMath = require("terriajs-cesium/Source/Core/Math").default;

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

  isDownloadSupported() {
    return (
      FeatureDetection.supportsTypedArrays() &&
      FeatureDetection.supportsWebWorkers()
    );
  },

  makeCsv(positions, stepDistanceMeters=undefined) {
    let full = false;
    const arrayLen = positions.length;
    const names = [['tappa', 'lat', 'lon', 'altitudine_m']];
    const values = [[
      new Uint8Array(arrayLen), new Float32Array(arrayLen), new Float32Array(arrayLen), new Int32Array(arrayLen)
    ]];
    if(typeof(stepDistanceMeters) !== 'undefined') {
      full = true;
      names[0].push('altitudine_m');
      names[0].push('dislivello_m');
      values[0].push(new Float32Array(arrayLen));
      values[0].push(new Int32Array(arrayLen));
    }

    for(let i = 0; i < positions.length; ++i) {
      values[0][0][i] = i;
      values[0][1][i] = CesiumMath.toDegrees(positions[i].latitude);
      values[0][2][i] = CesiumMath.toDegrees(positions[i].longitude);
      values[0][3][i] = positions[i].height;
      if(full) {
        values[0][4][i] = stepDistanceMeters[i];
        values[0][5][i] = i > 0 ? positions[i].height - positions[i - 1].height : 0;
      }
    }

    return {values: values, names: names};
  },

  makeJson(positions, properties) {
    const data = {
      type: "LineString",
      coordinates: [],
      properties: properties
    };

    for(let i = 0; i < positions.length; ++i) {
      data.coordinates.push([CesiumMath.toDegrees(positions[i].longitude), CesiumMath.toDegrees(positions[i].latitude), positions[i].height]);
    }
    return data;
  },

  download(option) {
    if (!this.isDownloadSupported()) {
      return;
    }

    const positions = this.props.terria.elevationPoints[0];

    if(option.label === 'CSV') {
      //CSV
      const stepDistanceMeters = this.props.terria.elevationPoints[1];
      const HrefWorker = require("worker-loader!./downloadHrefWorker");

      console.log(stepDistanceMeters);

      const data = this.makeCsv(positions, stepDistanceMeters);
      if (data.values && data.values.length > 0) {
        const worker = new HrefWorker();
        worker.postMessage(data);
        worker.onmessage = event => {
          const blob = new Blob([event.data], {
            type: "text/csv;charset=utf-8"
          });
          FileSaver.saveAs(blob, "elevation_step.csv");
        };
      }

      if(this.props.terria.sampledElevationPoints) {
        const detailedData = this.makeCsv(this.props.terria.sampledElevationPoints[0]);
        if (detailedData.values && detailedData.values.length > 0) {
          const worker = new HrefWorker();
          worker.postMessage(detailedData);
          worker.onmessage = event => {
            const blob = new Blob([event.data], {
              type: "text/csv;charset=utf-8"
            });
            FileSaver.saveAs(blob, "elevation_detail.csv");
          };
        }
      }
    }
    else {
      //JSON
      const data = this.makeJson(positions, this.props.terria.detailedElevationPath);
      const blob = new Blob([JSON.stringify(data)], {
        type: "file/json;charset=utf-8"
      });
      FileSaver.saveAs(blob, "elevation_step.geojson");

      if(this.props.terria.sampledElevationPoints) {
        const detailedData = this.makeJson(this.props.terria.sampledElevationPoints[0], this.props.terria.detailedElevationPath);
        const blob = new Blob([JSON.stringify(detailedData)], {
          type: "file/json;charset=utf-8"
        });
        FileSaver.saveAs(blob, "elevation_detail.geojson");
      }
    }
  },

  render() {
    const chartPoints = [];
    let positions = this.props.terria.elevationPoints[0];
    let stepDistanceMeters = this.props.terria.elevationPoints[1];
    //let hasError = false;
    let useKm = false;
    if (positions.length > 1) {
      if (stepDistanceMeters[stepDistanceMeters.length - 1] > 2000) {
        useKm = true;
      }
      for (let i = 0; i < positions.length; ++i) {
        if (isNaN(positions[i].height)) {
          positions = [];
          //hasError = true;
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

    this.props.terria.currentViewer.notifyRepaintRequired();

    let loader;
    let chart;
    if (data.length > 0) {
      chart = (
        <Chart data={data} height={height} axisLabel={{ x: !useKm ? 'm' : 'Km', y: 'm' }} />
      );
    }
    const { t } = this.props;

    const icon = (
      <span className={StylesFeatureDownload.iconDownload}>
        <Icon glyph={Icon.GLYPHS.opened} />
      </span>
    );

    return (
      <div >
        <div className={Styles.header}>
          <label className={Styles.sectionLabel}>
            {loader || "Profilo altimetrico"}
          </label>
          <If condition={this.isDownloadSupported()}>
            <Dropdown
              options={
                [{
                  label: "CSV"
                },
                {
                  label: "JSON"
                }]
              }
              selectOption={this.download}
              textProperty="label"
              theme={{
                dropdown: StylesFeatureDownload.download,
                list: StylesFeatureDownload.dropdownList,
                button: StylesFeatureDownload.dropdownButton,
                icon: icon
              }}
              buttonClassName={StylesFeatureDownload.btn}
            >
              Download
            </Dropdown>
          </If>
          {/*<button
            type="button"
            title={t("chart.closePanel")}
            className={Styles.btnCloseChartPanel}
            onClick={this.closePanel}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>*/}
        </div>
        <div>{chart}</div>
      </div>
    );
  }
});

module.exports = withTranslation()(ElevationChartPanel);
