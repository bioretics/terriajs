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
import { useTheme } from "styled-components";

const DragWrapper = require("../DragWrapper");

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const ElevationPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const theme = useTheme();

  const [samplingPathStep, setSamplingPathStep] = React.useState(
    terria.samplingPathStep
  );
  const [isValidSamplingPathStep, setIsValidSamplingPathStep] =
    React.useState(true);

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

  const changeSamplingPathStep = action((val: number) => {
    terria.samplingPathStep = val;
  });

  const getBearing = computed(() => {
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
  });

  const getHeightDifference = computed(() => {
    if (!terria?.path?.stopPoints || terria.path.stopPoints.length < 2) {
      return "";
    }

    const start = terria.path.stopPoints[0];
    const end = terria.path.stopPoints.at(-1) as Cartographic;
    const difference = end.height - start.height;

    return `${difference.toFixed(0)} m`;
  });

  const heights = computed(() => {
    return terria?.path?.stopPoints?.map((elem) => elem.height) || [];
  });

  const rangeSamplingPathStep = computed(() => {
    if (!terria?.path?.geodeticDistance) {
      return [0, 0];
    }
    const minExponent = 0;
    const maxExponent = 3;
    const thousandthExponent = 4;
    const exponent = Math.min(
      maxExponent,
      Math.max(
        minExponent,
        terria.path.geodeticDistance.toFixed(0).length - thousandthExponent
      )
    );
    const minSamplingPathStep = 10 ** exponent;
    const maxSamplingPathStep = 2 * 10 ** maxExponent;
    return [minSamplingPathStep, maxSamplingPathStep];
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

  const renderHeader = () => {
    return (
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
    );
  };

  const renderSamplingStep = () => {
    return (
      <>
        <Text textLight style={{ marginLeft: 1 }} title="">
          Passo di campionamento del terreno (metri):
          <br />
          [min {rangeSamplingPathStep.get()[0]}, max{" "}
          {rangeSamplingPathStep.get()[1]}]
        </Text>
        <Box styledMargin="5px">
          <Box styledWidth="120px">
            <Input
              css={`
                border: solid;
                border-width: ${isValidSamplingPathStep ? 1 : 2}px;
                border-color: ${isValidSamplingPathStep
                  ? theme.textLight
                  : "red"};
              `}
              title="Passo di campionamento"
              light={false}
              dark={true}
              type="number"
              min={1}
              max={2000}
              step={1}
              value={samplingPathStep}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setIsValidSamplingPathStep(
                  val >= rangeSamplingPathStep.get()[0] &&
                    val <= rangeSamplingPathStep.get()[1]
                );
                setSamplingPathStep(val);
              }}
            />
          </Box>
          <Button
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              margin-left: 5px;
            `}
            title="Modifica il passo di campionamento"
            onClick={() => {
              if (isValidSamplingPathStep) {
                changeSamplingPathStep(samplingPathStep);
              }
            }}
          >
            Cambia
          </Button>
        </Box>
      </>
    );
  };

  const renderBody = () => {
    return (
      <div className={Styles.body}>
        <Box>
          {!terria?.path?.hasArea && (
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
          )}
          <Button
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
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
        {!terria?.path?.hasArea && renderSamplingStep()}
        <br />
        {!terria?.path?.hasArea ? renderPathSummary() : renderAreaSummary()}
        <br />
        {terria.path?.sampledDistances && renderStepDetails()}
        {!!terria?.cesium?.scene?.globe?.ellipsoid && terria.path && (
          <ElevationDownload
            path={terria.path as PathCustom}
            name="path"
            ellipsoid={terria.cesium.scene.globe.ellipsoid}
          />
        )}
      </div>
    );
  };

  const renderPathSummary = () => {
    return (
      <>
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
                <td>{getBearing.get()}</td>
                <td>{getHeightDifference.get()}</td>
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
      </>
    );
  };

  const renderAreaSummary = () => {
    return (
      <>
        <Text textLight style={{ marginLeft: 1 }} title="">
          Dettaglio area poligonale
        </Text>
        <small>
          <table className={Styles.elevation}>
            <thead>
              <tr>
                <th>
                  Perimetro
                  <br />
                  geodetico
                </th>
                <th>
                  Perimetro
                  <br />
                  in aria
                </th>
                <th>
                  Area
                  <br />
                  geodetica
                </th>
                <th>
                  Area
                  <br />
                  in aria
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{prettifyNumber(terria.path?.geodeticDistance ?? 0)}</td>
                <td>{prettifyNumber(terria.path?.airDistance ?? 0)}</td>
                <td>{prettifyNumber(terria.path?.geodeticArea ?? 0, true)}</td>
                <td>{prettifyNumber(terria.path?.airArea ?? 0, true)}</td>
              </tr>
            </tbody>
          </table>
        </small>
      </>
    );
  };

  const renderStepDetails = () => {
    return (
      <>
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
                <th>
                  Pendenza
                  <br />%
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
                          ? prettifyNumber(terria.path.stopGroundDistances[idx])
                          : ""}
                      </td>
                      <td>
                        {idx > 0 && terria?.path?.stopAirDistances
                          ? Math.abs(
                              (100 * (point.height - array[idx - 1].height)) /
                                terria.path.stopAirDistances[idx]
                            ).toFixed(1)
                          : ""}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </small>
      </>
    );
  };

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.elevationPanelIsVisible}
      >
        {renderHeader()}
        {renderBody()}
      </div>
    </DragWrapper>
  );
});

export default ElevationPanel;
