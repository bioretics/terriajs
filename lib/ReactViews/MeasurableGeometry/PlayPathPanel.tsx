import { Rnd } from "react-rnd";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon, { StyledIcon } from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";
import Button from "../../Styled/Button";
import { useTheme } from "styled-components";
import Slider from "rc-slider";
import usePlayPath from "../Custom/PlayPath";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useState, useRef } from "react";
import Box from "../../Styled/Box";
import Text from "../../Styled/Text";
import { TrackingReferenceFrame } from "terriajs-cesium";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose?: () => void;
}

const PlayPathPanel = observer((props: Props) => {
  const theme = useTheme();
  const [lastGeom, setLastGeom] = useState(
    props.terria.measurableGeomList[props.terria.measurableGeometryIndex]
  );
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState<boolean>(
    !!localStorage.getItem("playPathTourShown")
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const cameraPositionRef = useRef<HTMLDivElement>(null);

  const {
    playSpeed,
    setPlaySpeed,
    interpolationMode,
    setInterpolationMode,
    trackingReferenceFrame,
    setTrackingReferenceFrame,
    startFromLastPoint,
    setStartFromLastPoint,
    showPositionMarker,
    setShowPositionMarker,
    playingPath,
    isCameraMoving,
    countdown,
    currentPointIndex,
    pointsSize,
    onPlay,
    onPause,
    onStop,
    resetPlayPath
  } = usePlayPath(props.terria, props.viewState);

  const currentGeom =
    props.terria.measurableGeomList[props.terria.measurableGeometryIndex];

  useEffect(() => {
    if (panelRef.current) {
      props.viewState.updateAppRef("PlayPathPanel", panelRef);
    }
    if (playButtonRef.current) {
      props.viewState.updateAppRef("PlayPathPlayButton", playButtonRef);
    }
    if (stopButtonRef.current) {
      props.viewState.updateAppRef("PlayPathStopButton", stopButtonRef);
    }
    if (cameraPositionRef.current) {
      props.viewState.updateAppRef("PlayPathCameraPosition", cameraPositionRef);
    }

    return () => {
      props.viewState.deleteAppRef("PlayPathPanel");
      props.viewState.deleteAppRef("PlayPathPlayButton");
      props.viewState.deleteAppRef("PlayPathStopButton");
      props.viewState.deleteAppRef("PlayPathCameraPosition");
    };
  }, [props.viewState]);

  useEffect(() => {
    if (props.viewState.playPathPanelIsVisible) {
      const seen = !!localStorage.getItem("playPathTourShown");
      setHasSeenTour(seen);
      if (!seen) setShowTourPrompt(true);
    }
  }, [props.viewState.playPathPanelIsVisible]);

  useEffect(() => {
    const currentGeom =
      props.terria.measurableGeomList[props.terria.measurableGeometryIndex];

    if (currentGeom !== lastGeom) {
      if (!props.viewState.isPlayingPath && countdown === null) {
        resetPlayPath();
      }
      setLastGeom(currentGeom);
    }
  }, [
    currentGeom,
    props.terria.measurableGeomList,
    props.terria.measurableGeometryIndex,
    lastGeom,
    props.viewState.isPlayingPath,
    countdown,
    resetPlayPath
  ]);

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: props.viewState.playPathPanelIsVisible,
    [Styles.isTranslucent]: props.viewState.explorerPanelIsVisible
  });

  const startPlayPathTour = () => {
    setShowTourPrompt(false);
    localStorage.setItem("playPathTourShown", "true");
    setHasSeenTour(true);
    const anyVs: any = props.viewState as any;
    if (typeof anyVs.startPlayPathTour === "function") {
      runInAction(() => anyVs.startPlayPathTour());
    }
  };

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <span
          style={{
            justifyContent: "center",
            display: "flex",
            flex: 1
          }}
        >
          <b>{i18next.t("playPath.title")}</b>
        </span>
        {renderCompactHelp()}
        <button
          type="button"
          onClick={() => {
            props.onClose?.();
            runInAction(() => {
              props.viewState.playPathPanelIsVisible = false;
            });
          }}
          className={Styles.btnCloseFeature}
          title={i18next.t("general.close")}
        >
          <Icon glyph={Icon.GLYPHS.close} />
        </button>
      </div>
    );
  };

  const renderTourPrompt = () => {
    if (!showTourPrompt) return null;

    return (
      <Box
        position="absolute"
        style={{
          top: -60,
          left: 0,
          right: 0,
          background: theme.colorPrimary,
          padding: "8px 12px",
          borderRadius: "4px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          zIndex: 1000
        }}
      >
        <Text small textLight>
          {i18next.t(
            "playPath.tourPrompt",
            "First time using Play Path? Take a quick tour!"
          )}
        </Text>
        <Box centered gap={2} style={{ marginTop: 4 }}>
          <Button
            secondary
            shortMinHeight
            onClick={() => {
              startPlayPathTour();
            }}
            style={{ fontSize: "0.8em", padding: "2px 10px" }}
          >
            {i18next.t("playPath.tour.preface.start")}
          </Button>
          <Button
            primary
            shortMinHeight
            onClick={() => {
              setShowTourPrompt(false);
              localStorage.setItem("playPathTourShown", "true");
              setHasSeenTour(true);
            }}
            style={{ fontSize: "0.8em", padding: "2px 10px" }}
          >
            {i18next.t("general.skip", "Skip")}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderCompactHelp = () => {
    if (!hasSeenTour || showTourPrompt) return null;
    return (
      <button
        onClick={startPlayPathTour}
        className={Styles.btnCloseFeature}
        title={i18next.t("playPath.tour.helpButton", "Open Play Path tour")}
        style={{ marginRight: 25 }}
      >
        <Icon glyph={Icon.GLYPHS.helpThick} />
      </button>
    );
  };

  const renderBody = () => {
    const canChangeOptions = !playingPath && countdown === null;

    const rowStyle: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      width: "100%",
      minWidth: 0,
      gap: 8
    };

    const selectStyle: React.CSSProperties = {
      flex: "1 1 0%",
      width: "100%",
      minWidth: 0,
      maxWidth: "100%",
      padding: "4px 6px",
      borderRadius: 4,
      border: `1px solid ${theme.textLight}`,
      background: theme.colorPrimary,
      color: theme.textLight,
      opacity: canChangeOptions ? 1 : 0.6,
      cursor: canChangeOptions ? "pointer" : "not-allowed",
      overflow: "hidden",
      textOverflow: "ellipsis"
    };

    return (
      <div
        ref={cameraPositionRef}
        className={Styles.body}
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: "hidden"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            minWidth: 0
          }}
        >
          <Button
            ref={playButtonRef}
            onClick={playingPath ? onPause : onPlay}
            disabled={!playingPath && isCameraMoving}
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              min-width: 50px;
            `}
            title={
              playingPath
                ? i18next.t("playPath.tooltip.pause", "Pause")
                : i18next.t("playPath.tooltip.play", "Play")
            }
          >
            <StyledIcon
              glyph={playingPath ? Icon.GLYPHS.pause : Icon.GLYPHS.play}
              styledWidth="16px"
            />
          </Button>
          <Button
            ref={stopButtonRef}
            onClick={onStop}
            title={i18next.t("playPath.tooltip.stop")}
            disabled={
              !playingPath &&
              !(
                pointsSize !== undefined &&
                currentPointIndex > 0 &&
                currentPointIndex < pointsSize - 1
              )
            }
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              min-width: 50px;
            `}
          >
            <StyledIcon glyph={Icon.GLYPHS.revert} styledWidth="16px" />
          </Button>
        </div>

        <div className="no-drag" style={{ ...rowStyle, alignItems: "center" }}>
          <label style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
            {i18next.t("playPath.startFrom.name", "Start from")}:
          </label>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              flex: "1 1 0%",
              minWidth: 0,
              opacity: canChangeOptions ? 1 : 0.6,
              cursor: canChangeOptions ? "pointer" : "not-allowed"
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.9em",
                cursor: canChangeOptions ? "pointer" : "not-allowed"
              }}
            >
              <input
                type="radio"
                name="playPathStartFrom"
                checked={!startFromLastPoint}
                onChange={() => setStartFromLastPoint(false)}
                disabled={!canChangeOptions}
              />
              {i18next.t("playPath.startFrom.first", "First point")}
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.9em",
                cursor: canChangeOptions ? "pointer" : "not-allowed"
              }}
            >
              <input
                type="radio"
                name="playPathStartFrom"
                checked={startFromLastPoint}
                onChange={() => setStartFromLastPoint(true)}
                disabled={!canChangeOptions}
              />
              {i18next.t("playPath.startFrom.last", "Last point")}
            </label>
          </div>
        </div>

        <div className="no-drag" style={rowStyle}>
          <label style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
            {i18next.t("playPath.interpolation.name")}:
          </label>
          <select
            value={interpolationMode}
            onChange={(e) => setInterpolationMode(e.target.value as any)}
            disabled={!canChangeOptions}
            style={selectStyle}
          >
            <option value="linear">
              {i18next.t(
                "playPath.interpolation.linear",
                "Linear Approximation"
              )}
            </option>
            <option value="lagrange">
              {i18next.t(
                "playPath.interpolation.lagrange",
                "Lagrange Polynomial"
              )}
            </option>
            <option value="hermite">
              {i18next.t(
                "playPath.interpolation.hermite",
                "Hermite Polynomial"
              )}
            </option>
          </select>
        </div>

        <div className="no-drag" style={rowStyle}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9em",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <input
              type="checkbox"
              checked={showPositionMarker}
              onChange={(e) => setShowPositionMarker(e.target.checked)}
            />
            {i18next.t("playPath.positionMarker", "Position marker")}
          </label>
        </div>

        <div className="no-drag" style={rowStyle}>
          <label style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
            {i18next.t("playPath.trackingFrame.name")}:
          </label>
          <select
            value={trackingReferenceFrame}
            onChange={(e) =>
              setTrackingReferenceFrame(Number(e.target.value) as any)
            }
            disabled={!canChangeOptions}
            style={selectStyle}
          >
            <option value={TrackingReferenceFrame.AUTODETECT}>
              {i18next.t("playPath.trackingFrame.autodetect", "Auto-detect")}
            </option>
            <option value={TrackingReferenceFrame.INERTIAL}>
              {i18next.t("playPath.trackingFrame.inertial")}
            </option>
            <option value={TrackingReferenceFrame.VELOCITY}>
              {i18next.t("playPath.trackingFrame.velocity")}
            </option>
            <option value={TrackingReferenceFrame.ENU}>
              {i18next.t("playPath.trackingFrame.enu")}
            </option>
          </select>
        </div>

        <div
          title={`${i18next.t("playPath.tooltip.speedSliderTitle")}`}
          className="no-drag"
          style={{ ...rowStyle, maxWidth: "100%" }}
        >
          <label style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
            {i18next.t("playPath.speed")}:
          </label>
          <Slider
            min={0.1}
            max={3}
            step={0.1}
            value={playSpeed}
            onChange={(val) => {
              setPlaySpeed(val as number);
            }}
            aria-valuetext={`${i18next.t(
              "playPath.tooltip.speedSlider"
            )}: ${playSpeed}x`}
            css={`
              flex: 1;
              width: 100%;
            `}
          />
          <span style={{ minWidth: 32, textAlign: "right", fontSize: "0.9em" }}>
            {playSpeed}x
          </span>
        </div>
      </div>
    );
  };

  return (
    <Rnd
      bounds="window"
      default={{
        x: 50,
        y: 50,
        width: Math.min(380, Math.max(300, window.innerWidth * 0.22)),
        height: "auto"
      }}
      maxWidth={window.innerWidth * 0.4}
      minWidth={280}
      enableResizing={{ right: false, left: false }}
      cancel=".no-drag"
    >
      <div
        ref={panelRef}
        className={panelClassName}
        style={{
          pointerEvents: "auto",
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box"
        }}
        aria-hidden={!props.viewState.playPathPanelIsVisible}
      >
        {renderTourPrompt()}
        {renderHeader()}
        {countdown !== null ? (
          <div
            className={Styles.body}
            style={{
              padding: 20,
              display: "flex",
              alignItems: "center",
              flexDirection: "column",
              justifyContent: "center",
              fontSize: "3em"
            }}
          >
            <b>{countdown}</b>
          </div>
        ) : (
          renderBody()
        )}
      </div>
    </Rnd>
  );
});

export default PlayPathPanel;
