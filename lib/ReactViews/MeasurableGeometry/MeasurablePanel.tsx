import React from "react";
import { Rnd } from "react-rnd";
import Styles from "./measurable-panel.scss";
import classNames from "classnames";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { action, computed } from "mobx";
import { observer } from "mobx-react";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Button from "../../Styled/Button";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Input, { StyledTextArea } from "../../Styled/Input";
import ViewState from "../../ReactViewModels/ViewState";
import Terria from "../../Models/Terria";
import { useTheme } from "styled-components";
import { MeasurableGeometry } from "../../ViewModels/MeasurableGeometryManager";
import MeasurableDownload from "./MeasurableDownload";
import i18next from "i18next";
import {
  MeasureLineTool,
  MeasurePolygonTool,
  MeasureAngleTool,
  MeasurePointTool
} from "../Map/MapNavigation/Items";
import { SortableContainer, SortableElement } from "react-sortable-hoc";

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const MeasurablePanel = observer((props: Props) => {
  const { terria, viewState } = props;
  const theme = useTheme();

  const [showDistances, setShowDistances] = React.useState(true);
  if (terria.measurableGeom) {
    terria.measurableGeom.showDistanceLabels = showDistances;
  }

  const [pointsDescriptions, setPointsDescriptions] = React.useState<string[]>(
    []
  );

  React.useEffect(() => {
    setPointsDescriptions(terria.measurableGeom?.pointDescriptions || []);
  }, [terria.measurableGeom?.pointDescriptions]);

  React.useEffect(() => {
    const stopPoints = terria?.measurableGeom?.stopPoints || [];
    setPointsDescriptions((prev) => {
      const newLength = stopPoints.length;
      return prev.length === newLength
        ? prev
        : [
            ...prev.slice(0, newLength),
            ...new Array(Math.max(newLength - prev.length, 0)).fill("")
          ];
    });
  }, [terria?.measurableGeom?.stopPoints]);

  const [samplingPathStep, setSamplingPathStep] = React.useState(
    terria.measurableGeomSamplingStep
  );
  const [isValidSamplingPathStep, setIsValidSamplingPathStep] =
    React.useState(true);

  // Gestione delle classi CSS in base allo stato del pannello
  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: viewState.measurablePanelIsCollapsed,
    [Styles.isVisible]: viewState.measurablePanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  const close = action(() => {
    viewState.measurablePanelIsVisible = false;
    const deactivateTool = (toolId: string) => {
      const item =
        viewState.terria.mapNavigationModel.findItem(toolId)?.controller;
      if (item && item.active) {
        item.deactivate();
      }
    };
    deactivateTool(MeasurePointTool.id);
    deactivateTool(MeasureLineTool.id);
    deactivateTool(MeasurePolygonTool.id);
    deactivateTool(MeasureAngleTool.id);
  });

  const toggleCollapsed = action(() => {
    viewState.measurablePanelIsCollapsed =
      !viewState.measurablePanelIsCollapsed;
  });

  const toggleChart = action(() => {
    viewState.measurableChartIsVisible = !viewState.measurableChartIsVisible;
  });

  const toggleLineClampToGround = action(() => {
    terria.clampMeasureLineToGround = !terria.clampMeasureLineToGround;
  });

  const changeSamplingPathStep = action((val: number) => {
    terria.measurableGeomSamplingStep = val;
  });

  const getBearing = computed(() => {
    if (
      !terria?.cesium?.scene?.globe?.ellipsoid ||
      !terria?.measurableGeom?.stopPoints ||
      terria.measurableGeom.stopPoints.length === 0
    ) {
      return "";
    }
    const ellipsoid = terria.cesium.scene.globe.ellipsoid;
    const start = terria.measurableGeom.stopPoints[0];
    const end = terria.measurableGeom.stopPoints.at(-1);
    const geo = new EllipsoidGeodesic(start, end, ellipsoid);
    const bearing = (CesiumMath.toDegrees(geo.startHeading) + 360) % 360;
    return `${bearing.toFixed(0)}°`;
  });

  const getHeightDifference = computed(() => {
    if (
      !terria?.measurableGeom?.stopPoints ||
      terria.measurableGeom.stopPoints.length < 2
    ) {
      return "";
    }
    const start = terria.measurableGeom.stopPoints[0];
    const end = terria.measurableGeom.stopPoints.at(-1) as Cartographic;
    const difference = end.height - start.height;
    return `${difference.toFixed(0)} m`;
  });

  const heights = computed(() => {
    return terria?.measurableGeom?.stopPoints?.map((elem) => elem.height) || [];
  });

  const rangeSamplingPathStep = computed(() => {
    if (!terria?.measurableGeom?.geodeticDistance) {
      return [0, 0];
    }
    const minExponent = 0;
    const maxExponent = 3;
    const thousandthExponent = 4;
    const exponent = Math.min(
      maxExponent,
      Math.max(
        minExponent,
        terria.measurableGeom.geodeticDistance.toFixed(0).length -
          thousandthExponent
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
    // Gestione di metri vs km
    let label = "m";
    if (squared) {
      // per aree (m² vs km²)
      if (number > 999999) {
        label = "km";
        number = number / 1000000.0;
      }
    } else {
      // per distanze (m vs km)
      if (number > 999) {
        label = "km";
        number = number / 1000.0;
      }
    }
    let numberStr = number.toFixed(2);
    // Aggiunta di virgole come separatori di migliaia
    numberStr = numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    if (squared) {
      numberStr += "\u00B2"; // apice "2"
    }
    return numberStr;
  };

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
          <span style={{ display: "flex", justifyContent: "center" }}>
            <b>{i18next.t("measurableGeometry.header")}</b>
          </span>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={Styles.btnToggleFeature}
            title="collapse"
          >
            {props.viewState.measurablePanelIsCollapsed ? (
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
          title={i18next.t("general.close")}
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
          {i18next.t("measurableGeometry.samplingStepHeader")}:
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
              title={i18next.t("measurableGeometry.samplingStepHeader")}
              light={false}
              dark
              type="number"
              min={1}
              max={2000}
              step={1}
              value={samplingPathStep}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
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
            title={i18next.t("measurableGeometry.samplingStepButtonTitle")}
            onClick={() => {
              if (isValidSamplingPathStep) {
                changeSamplingPathStep(samplingPathStep);
              }
            }}
          >
            {i18next.t("measurableGeometry.samplingStepButtonText")}
          </Button>
        </Box>
      </>
    );
  };

  const renderToggleDistanceLabels = () => (
    <label style={{ display: "flex", alignItems: "center", margin: "0 10px" }}>
      <input
        type="checkbox"
        checked={showDistances}
        onChange={(e) => {
          setShowDistances(e.target.checked);
          terria.measurableGeom!.showDistanceLabels = e.target.checked;
        }}
        style={{ marginRight: "5px" }}
      />
      {i18next.t("Mostra etichette distanze")}
    </label>
  );

  const renderBody = () => {
    return (
      <div className={Styles.body}>
        <Box>
          {!terria?.measurableGeom?.hasArea && (
            <Button
              css={`
                background: #519ac2;
                margin-left: 5px;
                margin-bottom: 20px;
              `}
              onClick={toggleChart}
              title={i18next.t("measurableGeometry.showElevationChart")}
            >
              <StyledIcon
                light
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
            title={i18next.t("measurableGeometry.clampLineButtonTitle")}
          >
            {terria.clampMeasureLineToGround
              ? i18next.t("measurableGeometry.clampLineToGround")
              : i18next.t("measurableGeometry.dontClampLineToGround")}
          </Button>
          {!terria?.measurableGeom?.onlyPoints && renderToggleDistanceLabels()}
        </Box>
        {!terria?.measurableGeom?.hasArea && renderSamplingStep()}
        <br />
        {!terria?.measurableGeom?.hasArea
          ? terria?.measurableGeom?.onlyPoints
            ? renderPointsSummary()
            : renderPathSummary()
          : renderAreaSummary()}
        <br />
        {terria.measurableGeom?.sampledDistances && renderStepDetails()}
        {!!terria?.cesium?.scene?.globe?.ellipsoid && terria.measurableGeom && (
          <MeasurableDownload
            geom={terria.measurableGeom as MeasurableGeometry}
            name="path"
            ellipsoid={terria.cesium.scene.globe.ellipsoid}
            pointDescriptions={
              terria?.measurableGeom?.onlyPoints ? pointsDescriptions : []
            }
          />
        )}
      </div>
    );
  };

  const renderSummaryTable = (headers: string[], data: string[]) => (
    <table
      className={Styles.elevation}
      css={`
        width: 300px;
        border-collapse: collapse;
      `}
    >
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th
              key={index}
              css={`
                padding: 8px;
                text-align: left;
              `}
            >
              {i18next.t(header)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {data.map((item, index) => (
            <td
              key={index}
              css={`
                padding: 8px;
              `}
            >
              {item}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );

  const renderPointsSummary = () => {
    const tableHeaders = [
      "measurableGeometry.geometrySummaryElevationMin",
      "measurableGeometry.geometrySummaryElevationMax",
      "measurableGeometry.geometrySummaryElevationBear",
      "measurableGeometry.geometrySummaryElevationDiff"
    ];

    const tableData = [
      prettifyNumber(Math.min(...heights.get())),
      prettifyNumber(Math.max(...heights.get())),
      getBearing.get(),
      getHeightDifference.get()
    ];

    return (
      <>
        <Text textLight style={{ marginLeft: 1 }} title="">
          {i18next.t("measurableGeometry.geometrySummaryHeader")}
        </Text>
        <small>{renderSummaryTable(tableHeaders, tableData)}</small>
      </>
    );
  };

  const renderPathSummary = () => {
    const tableHeaders = [
      "measurableGeometry.geometrySummaryElevationMin",
      "measurableGeometry.geometrySummaryElevationMax",
      "measurableGeometry.geometrySummaryElevationBear",
      "measurableGeometry.geometrySummaryElevationDiff"
    ];

    const tableData = [
      prettifyNumber(Math.min(...heights.get())),
      prettifyNumber(Math.max(...heights.get())),
      getBearing.get(),
      getHeightDifference.get()
    ];

    const distanceHeaders = [
      "measurableGeometry.geometrySummaryDistGeo",
      "measurableGeometry.geometrySummaryDistAir",
      "measurableGeometry.geometrySummaryDistGround"
    ];

    const distanceData = [
      prettifyNumber(terria.measurableGeom?.geodeticDistance ?? 0),
      prettifyNumber(terria.measurableGeom?.airDistance ?? 0),
      prettifyNumber(terria.measurableGeom?.groundDistance ?? 0)
    ];

    return (
      <>
        <Text textLight style={{ marginLeft: 1 }} title="">
          {i18next.t("measurableGeometry.geometrySummaryHeader")}
        </Text>
        <small>
          {renderSummaryTable(tableHeaders, tableData)}
          {renderSummaryTable(distanceHeaders, distanceData)}
        </small>
      </>
    );
  };

  const renderAreaSummary = () => (
    <>
      <Text textLight style={{ marginLeft: 1 }} title="">
        {i18next.t("measurableGeometry.geometrySummaryHeader")}
      </Text>
      <small>
        <table className={Styles.elevation}>
          <thead>
            <tr>
              <th>
                {i18next.t("measurableGeometry.geometrySummaryPerimeterGeo")}
              </th>
              <th>
                {i18next.t("measurableGeometry.geometrySummaryPerimeterAir")}
              </th>
              <th>{i18next.t("measurableGeometry.geometrySummaryAreaGeo")}</th>
              <th>{i18next.t("measurableGeometry.geometrySummaryAreaAir")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                {prettifyNumber(terria.measurableGeom?.geodeticDistance ?? 0)}
              </td>
              <td>{prettifyNumber(terria.measurableGeom?.airDistance ?? 0)}</td>
              <td>
                {prettifyNumber(terria.measurableGeom?.geodeticArea ?? 0, true)}
              </td>
              <td>
                {prettifyNumber(terria.measurableGeom?.airArea ?? 0, true)}
              </td>
            </tr>
          </tbody>
        </table>
      </small>
    </>
  );

  function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  }

  const SortableItem = SortableElement(
    ({
      point,
      idx,
      array,
      onlyPoints,
      pointsDescriptions,
      onDescriptionChange,
      prettifyNumber,
      terria
    }: {
      point: any;
      idx: number;
      array: any[];
      onlyPoints?: boolean;
      pointsDescriptions: string[];
      onDescriptionChange: (index: number, value: string) => void;
      prettifyNumber: (num: number, squared?: boolean) => string;
      terria: any;
    }) => {
      const renderDistanceData = (distanceArray: any[], index: number) => {
        return index > 0 && distanceArray && distanceArray.length > index
          ? prettifyNumber(distanceArray[index])
          : "";
      };

      const renderSlope = (index: number) => {
        return index > 0 &&
          terria?.measurableGeom?.stopAirDistances &&
          terria.measurableGeom.stopAirDistances.length > index
          ? Math.abs(
              (100 * (point.height - array[index - 1].height)) /
                terria.measurableGeom.stopAirDistances[index]
            ).toFixed(1)
          : "";
      };

      return (
        <tr
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          style={{ cursor: "row-resize" }}
        >
          <td>{idx + 1}</td>
          <td>{`${point.height.toFixed(0)} m`}</td>
          {!onlyPoints && (
            <>
              <td>
                {idx > 0
                  ? `${(point.height - array[idx - 1].height).toFixed(0)} m`
                  : ""}
              </td>
              <td>
                {renderDistanceData(
                  terria?.measurableGeom?.stopGeodeticDistances,
                  idx
                )}
              </td>
              <td>
                {renderDistanceData(
                  terria?.measurableGeom?.stopAirDistances,
                  idx
                )}
              </td>
              <td>
                {renderDistanceData(
                  terria?.measurableGeom?.stopGroundDistances,
                  idx
                )}
              </td>
              <td>{renderSlope(idx)}</td>
            </>
          )}
          {onlyPoints && (
            <td>
              <StyledTextArea
                placeholder="Note..."
                value={pointsDescriptions[idx] || ""}
                onChange={(e) => onDescriptionChange(idx, e.target.value)}
              />
            </td>
          )}
        </tr>
      );
    }
  );

  const SortableList = SortableContainer(
    ({
      items,
      onlyPoints,
      pointsDescriptions,
      onDescriptionChange,
      prettifyNumber,
      terria
    }: {
      items: any[];
      onlyPoints?: boolean;
      pointsDescriptions: string[];
      onDescriptionChange: (index: number, value: string) => void;
      prettifyNumber: (num: number, squared?: boolean) => string;
      terria: any;
    }) => {
      return (
        <tbody>
          {items.map((point, idx) => (
            <SortableItem
              key={`item-${idx}`}
              index={idx}
              idx={idx}
              array={items}
              onlyPoints={onlyPoints}
              pointsDescriptions={pointsDescriptions}
              onDescriptionChange={onDescriptionChange}
              prettifyNumber={prettifyNumber}
              terria={terria}
              point={point}
            />
          ))}
        </tbody>
      );
    }
  );

  const renderStepDetails = () => {
    const stopPoints = terria?.measurableGeom?.stopPoints || [];
    const onlyPoints = terria?.measurableGeom?.onlyPoints;

    const handleDescriptionChange = (index: number, value: string) => {
      const newDescriptions = [...pointsDescriptions];
      newDescriptions[index] = value;
      setPointsDescriptions(newDescriptions);
    };

    const onSortEnd = ({
      oldIndex,
      newIndex
    }: {
      oldIndex: number;
      newIndex: number;
    }) => {
      if (oldIndex === newIndex) return;
      const newStopPoints = reorder(stopPoints, oldIndex, newIndex);
      if (terria.measurableGeom)
        terria.measurableGeom.stopPoints = newStopPoints;

      const newDescriptions = reorder(pointsDescriptions, oldIndex, newIndex);
      setPointsDescriptions(newDescriptions);
    };

    return (
      <>
        <Text textLight style={{ marginLeft: 1 }} title="">
          {i18next.t("measurableGeometry.geometrySummaryStopSummary")}
        </Text>
        <small>
          <table className={Styles.elevation}>
            <thead>
              <tr>
                <th>#</th>
                <th>
                  {i18next.t("measurableGeometry.geometrySummaryElevation")}
                </th>
                {!onlyPoints && (
                  <>
                    <th>
                      {i18next.t(
                        "measurableGeometry.geometrySummaryElevationDiff"
                      )}
                    </th>
                    <th>
                      {i18next.t("measurableGeometry.geometrySummaryDistGeo")}
                    </th>
                    <th>
                      {i18next.t("measurableGeometry.geometrySummaryDistAir")}
                    </th>
                    <th>
                      {i18next.t(
                        "measurableGeometry.geometrySummaryDistGround"
                      )}
                    </th>
                    <th>
                      {i18next.t("measurableGeometry.geometrySummarySlope")}
                    </th>
                  </>
                )}
                {onlyPoints && <th>Descrizione</th>}
              </tr>
            </thead>
            <SortableList
              items={stopPoints}
              onlyPoints={onlyPoints}
              pointsDescriptions={pointsDescriptions}
              onDescriptionChange={handleDescriptionChange}
              onSortEnd={onSortEnd}
              distance={5}
              prettifyNumber={prettifyNumber}
              terria={terria}
              lockAxis="y"
            />
          </table>
        </small>
      </>
    );
  };

  return (
    <Rnd
      bounds="parent"
      default={{
        x: 100,
        y: 100,
        width: "60%",
        height: "60%"
      }}
      dragHandleClassName="drag-handle"
      enableResizing={{
        right: true,
        left: true
      }}
      style={{
        pointerEvents:
          viewState.measurablePanelIsVisible &&
          !viewState.measurablePanelIsCollapsed
            ? "auto"
            : "none"
      }}
    >
      <div
        className={panelClassName}
        style={{ pointerEvents: "auto" }}
        aria-hidden={!viewState.measurablePanelIsVisible}
      >
        {renderHeader()}
        {renderBody()}
      </div>
    </Rnd>
  );
});

export default MeasurablePanel;
