import { Rnd } from "react-rnd";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon, { StyledIcon } from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";
import React, { useEffect, useCallback, useState } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Button from "../../Styled/Button";
import { useTheme } from "styled-components";
import Slider from "rc-slider";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CameraView from "../../Models/CameraView";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose: () => void;
}

const PlayPathPanel = (props: Props) => {
  const { terria, onClose } = props;
  const theme = useTheme();
  const abortPlayingPathRef = React.useRef(false);

  const [playingPath, setPlayingPath] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    return terria.cesium ? geom.sampledPoints : geom.stopPoints;
  }, [terria]);

  const playPath = useCallback(async () => {
    abortPlayingPathRef.current = true;
    const points = getPoints();
    const camera = terria.cesium?.scene.camera;
    const cartesianPoints = points?.map((p) => Cartographic.toCartesian(p));
    const useLookAt = camera && points && cartesianPoints;
    const pitch = camera?.pitch ?? 0;
    const dist = useLookAt
      ? Cartesian3.distance(camera?.position, cartesianPoints![0])
      : 0;
    const duration = 3 / playSpeed;
    let heading;
    let hpr;

    for (
      let i = currentPointIndex;
      abortPlayingPathRef.current && points && i < points.length;
      i++
    ) {
      if (useLookAt && i !== points.length - 1) {
        heading =
          (new EllipsoidGeodesic(points[i], points[i + 1]).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }
      await terria.currentViewer.doZoomTo(
        useLookAt
          ? CameraView.fromLookAt(points[i], hpr!)
          : Rectangle.fromCartographicArray([points[i]]),
        duration
      );
      setCurrentPointIndex(i);
      terria.currentViewer.notifyRepaintRequired();
    }
    setPlayingPath(false);
  }, [terria, getPoints, playSpeed, currentPointIndex]);

  const onPlay = () => {
    const pts = getPoints();
    if (!pts || !pts.length) return;
    setPlayingPath(true);
  };

  const onPause = () => {
    abortPlayingPathRef.current = false;
    setPlayingPath(false);
    console.log("Paused at point index: ", currentPointIndex);
  };

  const onStop = () => {
    setPlayingPath(false);
    setCurrentPointIndex(0);
    abortPlayingPathRef.current = false;
  };

  useEffect(() => {
    if (playingPath) {
      playPath();
    }
  }, [playingPath, playPath]);

  const panelClassName = classNames(Styles.panel, {
    [Styles.isVisible]: true
  });

  return (
    <Rnd
      bounds="window"
      default={{
        x: 50,
        y: 50,
        width: "auto",
        height: "auto"
      }}
      enableResizing={{ right: false, left: false }}
      cancel=".no-drag"
    >
      <div className={panelClassName} style={{ pointerEvents: "auto" }}>
        <div className={Styles.header}>
          <div>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>Play Path</b>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              abortPlayingPathRef.current = false;
              setPlayingPath(false);
              setCurrentPointIndex(0);
              onClose();
            }}
            className={Styles.btnCloseFeature}
            title={i18next.t("general.close")}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </div>

        <div className={Styles.body} style={{ padding: "20px" }}>
          {playingPath ? (
            <div>
              <Button
                onClick={onPause}
                css={`
                  color: ${theme.textLight};
                  background: ${theme.colorPrimary};
                  margin-left: 5px;
                  width: 170px;
                `}
              >
                <StyledIcon
                  realDark={false}
                  glyph={Icon.GLYPHS.pause}
                  styledWidth="16px"
                />
              </Button>
            </div>
          ) : (
            <div>
              <Button
                onClick={onPlay}
                css={`
                  color: ${theme.textLight};
                  background: ${theme.colorPrimary};
                  margin-left: 5px;
                  width: 170px;
                `}
              >
                <StyledIcon
                  realDark={false}
                  glyph={Icon.GLYPHS.play}
                  styledWidth="16px"
                />
              </Button>
            </div>
          )}
          {(playingPath || (!playingPath && currentPointIndex !== 0)) && (
            <div>
              <Button
                onClick={onStop}
                css={`
                  color: ${theme.textLight};
                  background: ${theme.colorPrimary};
                  margin-top: 10px;
                  margin-left: 5px;
                  width: 170px;
                `}
              >
                <StyledIcon
                  realDark={false}
                  glyph={Icon.GLYPHS.refresh}
                  styledWidth="16px"
                />
              </Button>
            </div>
          )}
          <div className="no-drag" style={{ marginTop: "10px" }}>
            <label style={{ marginRight: "10px" }}>
              {i18next.t("playPath.speed")}:
            </label>
            <Slider
              min={0.5}
              max={3}
              step={0.1}
              value={playSpeed}
              onChange={(val: number) => setPlaySpeed(val)}
              aria-valuetext={`${i18next.t("playPath.speed")} ${playSpeed}x`}
              css={`
                margin: 0 10px;
                margin-top: 5px;
              `}
            />
            <span>{playSpeed}x</span>
          </div>
        </div>
      </div>
    </Rnd>
  );
};

export default PlayPathPanel;
