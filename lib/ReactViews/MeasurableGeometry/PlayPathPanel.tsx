import { Rnd } from "react-rnd";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon, { StyledIcon } from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";
import { useCallback, useState } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CameraView from "../../Models/CameraView";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import Button from "../../Styled/Button";
import { useTheme } from "styled-components";
import Slider from "rc-slider";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose: () => void;
}

const PlayPathPanel = (props: Props) => {
  const { terria, onClose } = props;
  const theme = useTheme();

  const [playingPath, setPlayingPath] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(1);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    return terria.cesium ? geom.sampledPoints : geom.stopPoints;
  }, [terria]);

  const focusToPoint = useCallback(
    async (index: number) => {
      const points = getPoints();
      if (!points || index < 0 || index >= points.length) return;
      const point = points[index];
      const camera = terria.cesium?.scene.camera!;
      const cartPt = Cartographic.toCartesian(point);
      const pitch = camera?.pitch ?? 0;
      const dist = Cartesian3.distance(camera.position, cartPt);
      const heading = camera.heading;
      const hpr = new HeadingPitchRange(heading, -pitch, dist);
      const duration = 1 / playSpeed;
      await terria.currentViewer.doZoomTo(
        terria.cesium
          ? CameraView.fromLookAt(point, hpr)
          : Rectangle.fromCartographicArray([point]),
        duration
      );
    },
    [terria, getPoints, playSpeed]
  );

  const zoomToPoint = useCallback(
    async (_: number, index = currentPointIndex) => {
      const points = getPoints();
      if (!points || index < 0 || index >= points.length) return;
      const point = points[index];
      const camera = terria.cesium?.scene.camera!;
      const cartPt = Cartographic.toCartesian(point);
      const pitch = camera.pitch;
      const baseDist = Cartesian3.distance(camera.position, cartPt);
      const dist = baseDist * zoomFactor;
      const heading = camera.heading;
      const hpr = new HeadingPitchRange(heading, -pitch, dist);
      const duration = 1 / playSpeed;
      await terria.currentViewer.doZoomTo(
        terria.cesium
          ? CameraView.fromLookAt(point, hpr)
          : Rectangle.fromCartographicArray([point]),
        duration
      );
    },
    [getPoints, terria, zoomFactor, currentPointIndex, playSpeed]
  );

  const onPlay = () => {
    const pts = getPoints();
    if (!pts || !pts.length) return;
    setCurrentPointIndex(0);
    focusToPoint(0);
    setPlayingPath(true);
  };

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
            onClick={onClose}
            className={Styles.btnCloseFeature}
            title={i18next.t("general.close")}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </div>

        <div className={Styles.body} style={{ padding: "20px" }}>
          {playingPath ? (
            <Button
              onClick={() => setPlayingPath(false)}
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
          ) : (
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
          )}
          <div className="no-drag" style={{ marginTop: "10px" }}>
            <label style={{ marginRight: "10px" }}>Velocità:</label>
            <Slider
              min={0.5}
              max={3}
              step={0.1}
              value={playSpeed}
              onChange={(val: number) => setPlaySpeed(val)}
              marks={{ 2: "" }}
              aria-valuetext={`Velocità ${playSpeed}x`}
              css={`
                margin: 0 10px;
                margin-top: 5px;
              `}
            />
            <span>{playSpeed}x</span>
          </div>
          <div className="no-drag" style={{ marginTop: "10px" }}>
            <label style={{ marginRight: "10px" }}>Zoom:</label>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={zoomFactor}
              onChange={(val: number) => setZoomFactor(val)}
              onAfterChange={() => zoomToPoint(currentPointIndex)}
              marks={{ 1: "" }}
              aria-valuetext={`Zoom ${zoomFactor}x`}
              css={`
                margin: 0 10px;
                margin-top: 5px;
              `}
            />
            <span>{zoomFactor}x</span>
          </div>
        </div>
      </div>
    </Rnd>
  );
};

export default PlayPathPanel;
