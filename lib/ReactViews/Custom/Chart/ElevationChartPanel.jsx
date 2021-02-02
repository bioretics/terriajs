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

import FeatureDetection from "terriajs-cesium/Source/Core/FeatureDetection";
import FileSaver from "file-saver";
import StylesDownload from "./chart-panel-download-button.scss";

/*import DataUri from "../../../Core/DataUri";
import Dropdown from "../../Generic/Dropdown";
import StylesFeatureDownload from "../../FeatureInfo/feature-info-download.scss";*/

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

  download() {
    if (!this.isDownloadSupported()) {
      return;
    }

    const positions = this.props.terria.elevationPoints[0];
    const stepDistanceMeters = this.props.terria.elevationPoints[1];
    let isSampled = false;
    /*if(this.props.terria.sampledElevationPoints) {
      isSampled = true;
      const pos3d = this.props.terria.sampledElevationPoints[0];
      const stepDistance3DMetres = this.props.terria.sampledElevationPoints[1];
    }*/

    const arrayLen = positions.length;
    const names = [['tappa', 'lat', 'lon', 'distanza_m', 'altitudine_m', 'dislivello_m']];
    const values = [[
      new Uint8Array(arrayLen), new Float32Array(arrayLen), new Float32Array(arrayLen), 
      new Float32Array(arrayLen), new Int32Array(arrayLen), new Int32Array(arrayLen)
    ]];
    for(let i = 0; i < positions.length; ++i) {
      values[0][0][i] = i;
      values[0][1][i] = positions[i].latitude;
      values[0][2][i] = positions[i].longitude;
      values[0][3][i] = stepDistanceMeters[i];
      values[0][4][i] = positions[i].height;
      values[0][5][i] = i > 0 ? positions[i].height - positions[i - 1].height : 0;
    }
    const dataToDownload = {values: values, names: names};

    const HrefWorker = require("worker-loader!./downloadHrefWorker");
    const worker = new HrefWorker();

    if (dataToDownload.values && dataToDownload.values.length > 0) {
      worker.postMessage(dataToDownload);
      worker.onmessage = event => {
        const blob = new Blob([event.data], {
          type: "text/csv;charset=utf-8"
        });
        FileSaver.saveAs(blob, "elevation.csv");
      };
    }
  },

  /*getLinks() {
    const positions = this.props.terria.elevationPoints[0];
    const stepDistanceMeters = this.props.terria.elevationPoints[1];

    return [
      {
        href: DataUri.make("csv", generateCsvData(positions)),
        download: `${this.props.name}.csv`,
        label: "CSV"
      },
      {
        href: DataUri.make("json", JSON.stringify(positions)),
        download: `${this.props.name}.json`,
        label: "JSON"
      }
    ].filter(download => !!download.href);
  },*/

  render() {
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

    /*const links = this.getLinks();
    const icon = (
      <span className={StylesFeatureDownload.iconDownload}>
        <Icon glyph={Icon.GLYPHS.opened} />
      </span>
    );*/

    return (
      <div >
        <div className={Styles.header}>
          <label className={Styles.sectionLabel}>
            {loader || "Profilo altimetrico"}
          </label>
          <If condition={this.isDownloadSupported()}>
            <button className={StylesDownload.btnDownload} onClick={() => this.download()}>
              <Icon glyph={Icon.GLYPHS.download} />
              Download
            </button>
            {/*<Dropdown
              options={links}
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
            </Dropdown>*/}
          </If>
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

/**
 * Turns a 2-dimensional javascript object into a CSV string, with the first row being the property names and the second
 * row being the data. If the object is too hierarchical to be made into a CSV, returns undefined.
 */
/*function generateCsvData(data) {
  if (!data) {
    return;
  }

  const row1 = [];
  const row2 = [];
  const keys = Object.keys(data);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const type = typeof data[key];

    // If data is too hierarchical to fit in a table, just return undefined as we can't generate a CSV.
    if (type === "object" && data[key] !== null) {
      // covers both objects and arrays.
      return;
    }
    if (type === "function") {
      // Ignore template functions we may add.
      continue;
    }

    row1.push(makeSafeForCsv(key));
    row2.push(makeSafeForCsv(data[key]));
  }

  return row1.join(",") + "\n" + row2.join(",");
}*/

/**
 * Makes a string safe for insertion into a CSV by wrapping it in inverted commas (") and changing inverted commas within
 * it to double-inverted-commas ("") as per CSV convention.
 */
/*function makeSafeForCsv(value) {
  value = value ? `${value}` : "";

  return '"' + value.replace(/"/g, '""') + '"';
}*/

module.exports = withTranslation()(ElevationChartPanel);
