import { Rnd } from "react-rnd";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon, { StyledIcon } from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";
import React, { useEffect, useCallback, useState, useRef } from "react";
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

const PlayPathPanel: React.FC<Props> = ({ terria, onClose }) => {
  const theme = useTheme();
  const abortPlayingPathRef = useRef(false);

  const [playingPath, setPlayingPath] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const playSpeedRef = useRef(playSpeed);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const currentPointIndexRef = useRef(currentPointIndex);
  const distRef = useRef(0);

  // Sync refs with state
  useEffect(() => {
    currentPointIndexRef.current = currentPointIndex;
  }, [currentPointIndex]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  // Retrieve points list
  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    return terria.cesium ? geom.sampledPoints : geom.stopPoints;
  }, [terria]);

  // Recompute distance when camera moves
  useEffect(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const updateDist = () => {
      const pts = getPoints();
      if (!pts?.length) return;
      const cartesians = pts.map((p) => Cartographic.toCartesian(p));
      const idx = currentPointIndexRef.current;
      distRef.current = Cartesian3.distance(camera.position, cartesians[idx]);
    };

    updateDist();
    camera.moveEnd.addEventListener(updateDist);
    return () => {
      camera.moveEnd.removeEventListener(updateDist);
    };
  }, [getPoints, terria]);

  // Main playback loop
  const playPath = useCallback(async () => {
    abortPlayingPathRef.current = true;
    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    const cartesians = pts?.map((p) => Cartographic.toCartesian(p));
    const useLookAt = Boolean(camera && pts && cartesians);
    const pitch = camera?.pitch ?? 0;
    const dist = distRef.current;
    const duration = 3 / playSpeedRef.current;

    for (
      let i = currentPointIndexRef.current;
      abortPlayingPathRef.current && pts && i < pts.length;
      i++
    ) {
      let hpr: HeadingPitchRange | undefined;
      if (useLookAt && i < pts.length - 1) {
        const heading =
          (new EllipsoidGeodesic(pts[i], pts[i + 1]).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }

      await terria.currentViewer.doZoomTo(
        useLookAt && hpr
          ? CameraView.fromLookAt(pts[i], hpr)
          : Rectangle.fromCartographicArray([pts[i]]),
        duration
      );

      setCurrentPointIndex(i + 1);
      terria.currentViewer.notifyRepaintRequired();
    }
    setPlayingPath(false);
  }, [getPoints, terria]);

  const onPlay = () => {
    const pts = getPoints();
    if (pts?.length) setPlayingPath(true);
  };

  const onPause = () => {
    abortPlayingPathRef.current = false;
    setPlayingPath(false);
  };

  const onStop = useCallback(() => {
    abortPlayingPathRef.current = false;
    setPlayingPath(false);
    setCurrentPointIndex(0);

    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (camera && pts?.length) {
      const firstPoint = pts[0];
      const currentCartesian = camera.position;
      const targetCartesian = Cartographic.toCartesian(firstPoint);
      const dist = Cartesian3.distance(currentCartesian, targetCartesian);
      const pitch = camera.pitch ?? 0;
      let hpr: HeadingPitchRange | undefined;
      if (pts.length > 1) {
        const heading =
          (new EllipsoidGeodesic(firstPoint, pts[1]).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }
      const duration = 3 / playSpeedRef.current;
      terria.currentViewer.doZoomTo(
        hpr
          ? CameraView.fromLookAt(firstPoint, hpr)
          : Rectangle.fromCartographicArray([firstPoint]),
        duration
      );
    }
  }, [getPoints, terria]);

  useEffect(() => {
    if (playingPath) playPath();
  }, [playingPath, playPath]);

  const panelClass = classNames(Styles.panel, {
    [Styles.isVisible]: true
  });

  return (
    <Rnd
      bounds="window"
      default={{ x: 50, y: 50, width: "auto", height: "auto" }}
      enableResizing={{ right: false, left: false }}
      cancel=".no-drag"
    >
      <div className={panelClass} style={{ pointerEvents: "auto" }}>
        <div className={Styles.header}>
          <span style={{ flex: 1, textAlign: "center" }}>
            <b>Play Path</b>
          </span>
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

        <div className={Styles.body} style={{ padding: 20 }}>
          {playingPath ? (
            <Button
              onClick={onPause}
              css={`
                color: ${theme.textLight};
                background: ${theme.colorPrimary};
                width: 170px;
              `}
            >
              <StyledIcon glyph={Icon.GLYPHS.pause} styledWidth="16px" />
            </Button>
          ) : (
            <Button
              onClick={onPlay}
              css={`
                color: ${theme.textLight};
                background: ${theme.colorPrimary};
                width: 170px;
              `}
            >
              <StyledIcon glyph={Icon.GLYPHS.play} styledWidth="16px" />
            </Button>
          )}

          {(playingPath || currentPointIndex !== 0) && (
            <Button
              onClick={onStop}
              css={`
                color: ${theme.textLight};
                background: ${theme.colorPrimary};
                margin-top: 10px;
                width: 170px;
              `}
            >
              <StyledIcon glyph={Icon.GLYPHS.refresh} styledWidth="16px" />
            </Button>
          )}

          <div
            className="no-drag"
            style={{ marginTop: 10, display: "flex", alignItems: "center" }}
          >
            <label style={{ marginRight: 10 }}>
              {i18next.t("playPath.speed")}:
            </label>
            <Slider
              min={0.5}
              max={3}
              step={0.1}
              value={playSpeed}
              disabled={playingPath}
              onChange={(val) => setPlaySpeed(val)}
              aria-valuetext={`${i18next.t("playPath.speed")} ${playSpeed}x`}
              css={`
                margin: 0 10px;
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
