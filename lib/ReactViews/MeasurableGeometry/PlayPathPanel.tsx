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

  const panelRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const speedSliderRef = useRef<HTMLDivElement>(null);

  const {
    playSpeed,
    setPlaySpeed,
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
    if (speedSliderRef.current) {
      props.viewState.updateAppRef("PlayPathSpeedSlider", speedSliderRef);
    }

    return () => {
      props.viewState.deleteAppRef("PlayPathPanel");
      props.viewState.deleteAppRef("PlayPathPlayButton");
      props.viewState.deleteAppRef("PlayPathStopButton");
      props.viewState.deleteAppRef("PlayPathSpeedSlider");
    };
  }, [props.viewState]);

  useEffect(() => {
    if (
      props.viewState.playPathPanelIsVisible &&
      !localStorage.getItem("playPathTourShown")
    ) {
      setShowTourPrompt(true);
    }
  }, [props.viewState.playPathPanelIsVisible]);

  useEffect(() => {
    const currentGeom =
      props.terria.measurableGeomList[props.terria.measurableGeometryIndex];

    if (currentGeom !== lastGeom) {
      resetPlayPath();
      setLastGeom(currentGeom);
    }
  }, [
    currentGeom,
    props.terria.measurableGeomList,
    props.terria.measurableGeometryIndex,
    lastGeom,
    resetPlayPath
  ]);

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: props.viewState.playPathPanelIsVisible,
    [Styles.isTranslucent]: props.viewState.explorerPanelIsVisible
  });

  const startPlayPathTour = () => {
    setShowTourPrompt(false);
    localStorage.setItem("playPathTourShown", "true");
    runInAction(() => {
      props.viewState.startPlayPathTour();
    });
  };

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <span
          style={{
            justifyContent: "center",
            display: "flex"
          }}
        >
          <b>{i18next.t("playPath.title")}</b>
        </span>
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
            }}
            style={{ fontSize: "0.8em", padding: "2px 10px" }}
          >
            {i18next.t("general.skip")}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderBody = () => {
    return (
      <div
        className={Styles.body}
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 8,
            width: "100%"
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
                ? i18next.t("playPath.tooltip.pause")
                : i18next.t("playPath.tooltip.play")
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
              !(currentPointIndex > 0 && currentPointIndex < pointsSize!! - 1)
            }
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              min-width: 50px;
            `}
          >
            <StyledIcon glyph={Icon.GLYPHS.refresh} styledWidth="16px" />
          </Button>
        </div>
        <div
          ref={speedSliderRef}
          title={`${i18next.t("playPath.tooltip.speedSliderTitle")}`}
          className="no-drag"
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            maxWidth: "130%",
            gap: 8
          }}
        >
          <label style={{ whiteSpace: "nowrap", fontSize: "0.9em" }}>
            {i18next.t("playPath.speed")}:
          </label>
          <Slider
            min={0.5}
            max={3}
            step={0.1}
            value={playSpeed}
            onChange={(val) => {
              setPlaySpeed(val);
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
        width: window.innerWidth * 0.1,
        height: "auto"
      }}
      maxWidth={window.innerWidth * 0.4}
      enableResizing={{ right: false, left: false }}
      cancel=".no-drag"
    >
      <div
        ref={panelRef}
        className={panelClassName}
        style={{ pointerEvents: "auto", position: "relative" }}
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
