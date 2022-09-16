"use strict";

import React from "react";
import DragWrapper from "../DragWrapper";
import Styles from "./elevation-panel.scss";
import classNames from "classnames";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { action, computed } from "mobx";
import { observer } from "mobx-react";
import ElevationDownload from "./ElevationDownload";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Button from "../../Styled/Button";
import Box from "../../Styled/Box";

const ElevationPanel = observer(props => {
  const { terria, viewState } = props;

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: viewState.elevationPanelIsCollapsed,
    [Styles.isVisible]: viewState.elevationPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  const close = action(() => {
    viewState.elevationPanelIsVisible = false;
  });

  const toggleCollapsed = action(() => {
    viewState.elevationPanelIsCollapsed = !viewState.elevationPanelIsCollapsed;
  });

  const toggleChart = action(() => {
    viewState.elevationChartIsVisible = !viewState.elevationChartIsVisible;
  });

  const toggleLineClampToGround = action(() => {
    terria.clampMeasureLineToGround = !terria.clampMeasureLineToGround;
  });

  const prettifyNumber = (number, squared) => {
    if (typeof number === "undefined") {
      return 0;
    }

    if (number <= 0) {
      return "";
    }
    // Given a number representing a number in metres, make it human readable
    let label = "m";
    if (squared) {
      if (number > 999999) {
        label = "km";
        number = number / 1000000.0;
      }
    } else {
      if (number > 999) {
        label = "km";
        number = number / 1000.0;
      }
    }

    number = number.toFixed(2);
    // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
    number = number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    let numberStr = number + " " + label;
    if (squared) {
      numberStr += "\u00B2";
    }
    return numberStr;
  };

  const getBearing = () => {
    if (
      !terria?.cesium?.scene?.globe?.ellipsoid ||
      !terria.pathPoints ||
      terria.pathPoints.length === 0
    ) {
      return "";
    }

    const ellipsoid = terria.cesium.scene.globe.ellipsoid;
    const start = terria.pathPoints[0];
    const end = terria.pathPoints[terria.pathPoints.length - 1];
    const geo = new EllipsoidGeodesic(start, end, ellipsoid);
    const bearing = (CesiumMath.toDegrees(geo.startHeading) + 360) % 360;

    return `${bearing.toFixed(0)}°`;
  };

  const getHeightDifference = () => {
    if (!terria.pathPoints || terria.pathPoints.length === 0) {
      return "";
    }

    const start = terria.pathPoints[0];
    const end = terria.pathPoints[terria.pathPoints.length - 1];
    const difference = end.height - start.height;

    return `${difference.toFixed(0)}m`;
  };

  const heights = computed(() => {
    return terria.pathPoints?.map(elem => elem.height) || [];
  });

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.elevationPanelIsVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span>
              <center>
                <b>PERCORSO</b>
              </center>
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              className={Styles.btnToggleFeature}
            >
              {props.viewState.elevationPanelIsCollapsed ? (
                <Icon glyph={Icon.GLYPHS.closed} />
              ) : (
                <Icon glyph={Icon.GLYPHS.opened} />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={close}
            className={Styles.btnCloseFeature}
            title={"featureInfo.btnCloseFeature"}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </div>
        <div className={Styles.body}>
          <Box>
            <Button
              css={`
                background: #519ac2;
                margin-left: 5px;
                margin-bottom: 20px;
              `}
              onClick={toggleLineClampToGround}
            >
              {terria.clampMeasureLineToGround ? "in aria" : "a terra"}
            </Button>
            <Button
              css={`
                background: #519ac2;
                margin-left: 5px;
                margin-bottom: 20px;
              `}
              onClick={toggleChart}
            >
              <StyledIcon
                light={true}
                realDark={false}
                glyph={Icon.GLYPHS.lineChart}
                styledWidth="24px"
              />
            </Button>
          </Box>
          <table className={Styles.elevation}>
            <thead>
              <tr>
                <th>Alt. min</th>
                <th>Alt. max</th>
                <th>Rotta</th>
                <th>Dislivello</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{prettifyNumber(Math.min(...heights.get()))}</td>
                <td>{prettifyNumber(Math.max(...heights.get()))}</td>
                <td>{getBearing()}</td>
                <td>{getHeightDifference()}</td>
              </tr>
            </tbody>
          </table>
          <br />
          <center>
            <b>Dettaglio tappe</b>
          </center>
          <table className={Styles.elevation}>
            <thead>
              <tr>
                <th>#</th>
                <th>Altitudine</th>
                <th>Dislivello</th>
                <th>Distanza</th>
                <th>Distanza 3D</th>
              </tr>
            </thead>
            <tbody>
              {terria.pathPoints &&
                terria.pathPoints.map((point, idx) => {
                  const key = `${JSON.stringify(
                    terria.pathPoints[idx - 1]
                  )} ${JSON.stringify(point)}`;
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{point.height.toFixed(0)}</td>
                      <td>
                        {idx > 0
                          ? (
                              point.height - terria.pathPoints[idx - 1].height
                            ).toFixed(0)
                          : ""}
                      </td>
                      <td>
                        {idx > 0 ? terria.pathDistances[idx].toFixed(2) : ""}
                      </td>
                      <td>
                        {idx > 0 && key in terria.pathSampled
                          ? terria.pathSampled[key].totalDistance.toFixed(2)
                          : ""}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!!terria?.cesium?.scene?.globe?.ellipsoid && (
            <ElevationDownload
              data={{
                pathPoints: terria.pathPoints,
                pathSampled: terria.pathSampled
              }}
              name="path"
              ellipsoid={terria.cesium.scene.globe.ellipsoid}
            />
          )}
        </div>
      </div>
    </DragWrapper>
  );
});

export default ElevationPanel;
