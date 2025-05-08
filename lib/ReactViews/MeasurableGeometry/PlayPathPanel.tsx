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
  const [playSpeed, setPlaySpeed] = useState(1);
  const [playingPath, setPlayingPath] = useState(false);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);

  const distRef = useRef(0);
  const startIdxRef = useRef(0);
  const reverseRef = useRef(false);
  const playSpeedRef = useRef(playSpeed);
  const abortPlayingPathRef = useRef(false);
  const currentPointIndexRef = useRef(currentPointIndex);

  useEffect(() => {
    currentPointIndexRef.current = currentPointIndex;
  }, [currentPointIndex]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    return terria.cesium ? geom.sampledPoints : geom.stopPoints;
  }, [terria]);

  useEffect(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;
    const updateDist = () => {
      const pts = getPoints();
      if (!pts?.length) return;
      const cartesians = pts.map((p) => Cartographic.toCartesian(p));
      const idx = currentPointIndexRef.current;
      distRef.current = Cartesian3.distance(camera.position, cartesians[idx]);
      console.log("TEST dist", distRef.current);
      setIsCameraMoving(false);
    };

    const onMoveStart = () => setIsCameraMoving(true);

    camera.moveStart?.addEventListener(onMoveStart);
    camera.moveEnd.addEventListener(updateDist);

    return () => {
      camera.moveStart?.removeEventListener(onMoveStart);
      camera.moveEnd.removeEventListener(updateDist);
    };
  }, [getPoints, terria]);

  const playPath = useCallback(async () => {
    abortPlayingPathRef.current = true;
    const pts = getPoints();
    if (!pts?.length) return;
    const viewer = terria.currentViewer;
    const scene = terria.cesium?.scene;
    if (!scene) return;
    const camera = scene.camera;
    const cartesians = pts.map((p) => Cartographic.toCartesian(p));
    const useLookAt = Boolean(camera && cartesians.length);
    const pitch = camera?.pitch ?? 0;
    const dist = distRef.current;
    const duration = 3 / playSpeedRef.current;
    const isResume = currentPointIndexRef.current !== startIdxRef.current;
    const waitForRender = () =>
      new Promise<boolean>((resolve) => {
        const handler = () => {
          scene.postRender.removeEventListener(handler);
          resolve(true);
        };
        scene.postRender.addEventListener(handler);
      });
    const waitForAbort = () =>
      new Promise<boolean>((resolve) => {
        const check = () => {
          if (!abortPlayingPathRef.current) {
            resolve(false);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    const tryStep = async (i: number) => {
      let hpr: HeadingPitchRange | undefined;
      if (
        useLookAt &&
        ((i < pts.length - 1 && !reverseRef.current) ||
          (reverseRef.current && i > 0))
      ) {
        const next = reverseRef.current ? pts[i - 1] : pts[i + 1];
        const heading =
          (new EllipsoidGeodesic(pts[i], next).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }
      await viewer.doZoomTo(
        useLookAt && hpr
          ? CameraView.fromLookAt(pts[i], hpr)
          : Rectangle.fromCartographicArray([pts[i]]),
        duration
      );
      const rendered = await Promise.race([waitForRender(), waitForAbort()]);
      return rendered;
    };
    if (!reverseRef.current) {
      for (
        let i = currentPointIndexRef.current;
        abortPlayingPathRef.current && i < pts.length;
        i++
      ) {
        if (!(isResume && i === currentPointIndexRef.current)) {
          const ok = await tryStep(i);
          if (!ok) break;
        }
        setCurrentPointIndex(i + 1);
        viewer.notifyRepaintRequired();
      }
    } else {
      const lastIdx = pts.length - 1;
      for (
        let i = Math.min(currentPointIndexRef.current, lastIdx);
        abortPlayingPathRef.current && i >= 0;
        i--
      ) {
        if (!(isResume && i === currentPointIndexRef.current)) {
          const ok = await tryStep(i);
          if (!ok) break;
        }
        setCurrentPointIndex(i - 1);
        viewer.notifyRepaintRequired();
      }
    }
    setPlayingPath(false);
  }, [getPoints, terria]);

  const onPlay = () => {
    const pts = getPoints();
    if (!pts?.length) return;
    const camera = terria.cesium?.scene.camera;
    if (currentPointIndex !== startIdxRef.current && !playingPath) {
      setPlayingPath(true);
      return;
    }
    if (camera) {
      const cartesian = pts.map((p) => Cartographic.toCartesian(p));
      const distFirst = Cartesian3.distance(camera.position, cartesian[0]);
      const distLast = Cartesian3.distance(
        camera.position,
        cartesian[cartesian.length - 1]
      );
      reverseRef.current = distFirst > distLast;
      startIdxRef.current = reverseRef.current ? cartesian.length - 1 : 0;
      setCurrentPointIndex(startIdxRef.current);
      setPlayingPath(true);
    }
  };

  const onPause = () => {
    abortPlayingPathRef.current = false;
    setPlayingPath(false);
  };

  const onStop = useCallback(() => {
    abortPlayingPathRef.current = false;
    setPlayingPath(false);
    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (camera && pts?.length) {
      const targetIdx = startIdxRef.current;
      const point = pts[targetIdx];
      const currentCartesian = camera.position;
      const targetCartesian = Cartographic.toCartesian(point);
      const dist = Cartesian3.distance(currentCartesian, targetCartesian);
      const pitch = camera.pitch ?? 0;
      let hpr: HeadingPitchRange | undefined;
      if (pts.length > 1) {
        const neighborIdx = reverseRef.current ? targetIdx - 1 : targetIdx + 1;
        const heading =
          (new EllipsoidGeodesic(point, pts[neighborIdx]).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }
      const duration = 3 / playSpeedRef.current;
      terria.currentViewer.doZoomTo(
        hpr
          ? CameraView.fromLookAt(point, hpr)
          : Rectangle.fromCartographicArray([point]),
        duration
      );
      setCurrentPointIndex(targetIdx);
      terria.currentViewer.notifyRepaintRequired();
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
          <span
            style={{
              flex: 1,
              textAlign: "center",
              justifyContent: "center",
              display: "flex"
            }}
          >
            <b>{i18next.t("playPath.title")}</b>
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

        <div
          className={Styles.body}
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center"
            }}
          >
            <Button
              onClick={playingPath ? onPause : onPlay}
              disabled={!playingPath && isCameraMoving}
              css={`
                color: ${theme.textLight};
                background: ${theme.colorPrimary};
                min-width: 120px;
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
            {(playingPath || currentPointIndex !== 0) && (
              <Button
                onClick={onStop}
                title={i18next.t("playPath.tooltip.stop")}
                css={`
                  color: ${theme.textLight};
                  background: ${theme.colorPrimary};
                  min-width: 120px;
                `}
              >
                <StyledIcon glyph={Icon.GLYPHS.refresh} styledWidth="16px" />
              </Button>
            )}
          </div>
          <div
            className="no-drag"
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              maxWidth: 300,
              gap: 8
            }}
          >
            <label style={{ whiteSpace: "nowrap" }}>
              {i18next.t("playPath.speed")}:
            </label>
            <Slider
              min={0.5}
              max={3}
              step={0.1}
              value={playSpeed}
              disabled={playingPath}
              onChange={(val) => setPlaySpeed(val)}
              aria-valuetext={`${i18next.t(
                "playPath.tooltip.speedSlider"
              )}: ${playSpeed}x`}
              css={`
                flex: 1;
                width: 150px;
              `}
            />
            <span style={{ minWidth: 32, textAlign: "right" }}>
              {playSpeed}x
            </span>
          </div>
        </div>
      </div>
    </Rnd>
  );
};

export default PlayPathPanel;
