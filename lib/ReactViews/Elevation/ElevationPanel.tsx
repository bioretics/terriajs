//"use strict";

import React from "react";
//import DragWrapper from "../DragWrapper";
import Styles from "./elevation-panel.scss";
import classNames from "classnames";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { action, computed } from "mobx";
import { observer } from "mobx-react";
import ElevationDownload from "./ElevationDownload";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Button from "../../Styled/Button";
//import Slider from "rc-slider";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Input from "../../Styled/Input";
import ViewState from "../../ReactViewModels/ViewState";
import Terria, { PathCustom } from "../../Models/Terria";

const DragWrapper = require("../DragWrapper");

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const ElevationPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  //const [numOfSamplingPoints, setNumOfSamplingPoints] = React.useState(10);

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

  const prettifyNumber = (number: number, squared: boolean = false) => {
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
    let numberStr = number.toFixed(2);
    // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
    numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    if (squared) {
      numberStr += "\u00B2";
    }
    return numberStr;
  };

  const getBearing = () => {
    if (
      !terria?.cesium?.scene?.globe?.ellipsoid ||
      !terria?.path?.stopPoints ||
      terria.path.stopPoints.length === 0
    ) {
      return "";
    }

    const ellipsoid = terria.cesium.scene.globe.ellipsoid;
    const start = terria.path.stopPoints[0];
    const end = terria.path.stopPoints.at(-1);
    const geo = new EllipsoidGeodesic(start, end, ellipsoid);
    const bearing = (CesiumMath.toDegrees(geo.startHeading) + 360) % 360;

    return `${bearing.toFixed(0)}°`;
  };

  const getHeightDifference = () => {
    if (!terria?.path?.stopPoints || terria.path.stopPoints.length < 2) {
      return "";
    }

    const start = terria.path.stopPoints[0];
    const end = terria.path.stopPoints.at(-1) as Cartographic;
    const difference = end.height - start.height;

    return `${difference.toFixed(0)} m`;
  };

  const heights = computed(() => {
    return terria?.path?.stopPoints?.map((elem) => elem.height) || [];
  });

  const changeSamplingPathStep = action((val: number) => {
    terria.samplingPathStep = val;
  });

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.elevationPanelIsVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>PERCORSO</b>
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
            title="Chiudi pannello"
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
              onClick={toggleChart}
              title="Mostra/nascondi il grafo altimetrico"
            >
              <StyledIcon
                light={true}
                realDark={false}
                glyph={Icon.GLYPHS.lineChart}
                styledWidth="24px"
              />
            </Button>
            <Button
              css={`
                background: #519ac2;
                margin-left: 5px;
                margin-bottom: 20px;
              `}
              onClick={toggleLineClampToGround}
              title={`Passa alla visualizzazione del percorso ${
                terria.clampMeasureLineToGround ? "in aria" : "al suolo"
              }`}
            >
              {terria.clampMeasureLineToGround
                ? "vedi percorso in aria"
                : "vedi percorso al suolo"}
            </Button>
          </Box>

          {/*<Text
            large
            textLight
            title="Numero di punti, per ogni tratto del percorso, in cui campionare l'elevazione del terreno. 
                    Vanno a definirei il percorso 'a terra' e la 'Distanza 3D'">
            Punti di campionamento per tappa: {numOfSamplingPoints}
          </Text>
          <Slider
            title="Numero di punti, per ogni tratto del percorso, in cui campionare l'elevazione del terreno. 
                    Vanno a definirei il percorso 'a terra' e la 'Distanza 3D'"
            min={5}
            max={99}
            value={numOfSamplingPoints}
            onChange={(val) => {
              changeSamplingPointsNumber(val)
            }}
          />*/}
          <Text textLight style={{ marginLeft: 1 }} title="">
            Passo di campionamento del terreno (metri):
          </Text>
          <small>
            <Input
              title=""
              style={{ width: "100px", marginLeft: 5, marginTop: 5 }}
              light={false}
              dark={true}
              type="number"
              value={terria.samplingPathStep}
              onChange={(e) => changeSamplingPathStep(parseInt(e.target.value))}
            />
          </small>
          <br />
          <Text textLight style={{ marginLeft: 1 }} title="">
            Dettaglio percorso
          </Text>
          <small>
            <table className={Styles.elevation}>
              <thead>
                <tr>
                  <th>Alt. min</th>
                  <th>Alt. max</th>
                  <th>Rotta</th>
                  <th>Disl.</th>
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
            <table className={Styles.elevation}>
              <thead>
                <tr>
                  <th>
                    Dist.
                    <br />
                    geodetica
                  </th>
                  <th>
                    Dist.
                    <br />
                    in aria
                  </th>
                  <th>
                    Dist.
                    <br />
                    al suolo
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{prettifyNumber(terria.path?.geodeticDistance ?? 0)}</td>
                  <td>{prettifyNumber(terria.path?.airDistance ?? 0)}</td>
                  <td>{prettifyNumber(terria.path?.groundDistance ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </small>
          <br />
          <Text textLight style={{ marginLeft: 1 }} title="">
            Dettaglio tappe
          </Text>
          <small>
            <table className={Styles.elevation}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Alt.</th>
                  <th>Disl.</th>
                  <th>
                    Dist.
                    <br />
                    geodetica
                  </th>
                  <th>
                    Dist.
                    <br />
                    in aria
                  </th>
                  <th>
                    Dist.
                    <br />
                    al suolo
                  </th>
                </tr>
              </thead>
              <tbody>
                {terria?.path?.stopPoints &&
                  terria.path.stopPoints.length > 0 &&
                  terria.path.stopPoints.map((point, idx, array) => {
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{`${point.height.toFixed(0)} m`}</td>
                        <td>
                          {idx > 0
                            ? `${(point.height - array[idx - 1].height).toFixed(
                                0
                              )} m`
                            : ""}
                        </td>
                        <td>
                          {idx > 0 && terria?.path
                            ? prettifyNumber(
                                terria.path.stopGeodeticDistances[idx]
                              )
                            : ""}
                        </td>
                        <td>
                          {idx > 0 && terria?.path?.stopAirDistances
                            ? prettifyNumber(terria.path.stopAirDistances[idx])
                            : ""}
                        </td>
                        <td>
                          {idx > 0 && terria?.path?.stopGroundDistances
                            ? prettifyNumber(
                                terria.path.stopGroundDistances[idx]
                              )
                            : ""}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </small>
          {!!terria?.cesium?.scene?.globe?.ellipsoid && terria.path && (
            <ElevationDownload
              path={terria.path as PathCustom}
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
