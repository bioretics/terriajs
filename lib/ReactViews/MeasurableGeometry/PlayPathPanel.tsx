import { useEffect } from "react";
import { Rnd } from "react-rnd";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon, { StyledIcon } from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";
import { useCallback, useRef, useState } from "react";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CameraView from "../../Models/CameraView";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import Button from "../../Styled/Button";
import { useTheme } from "styled-components";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose: () => void;
}

const PlayPathPanel = (props: Props) => {
  const { terria, viewState, onClose } = props;
  const [playingPath, setPlayingPath] = useState(false);
  const abortPlayingPathRef = useRef(false);
  const theme = useTheme();

  const playPath = useCallback(async () => {
    const points = terria.cesium
      ? terria.measurableGeomList[terria.measurableGeometryIndex].sampledPoints
      : terria.measurableGeomList[terria.measurableGeometryIndex].stopPoints;
    const camera = terria.cesium?.scene.camera;
    const cartesianPoints = points?.map((p) => Cartographic.toCartesian(p));
    const useLookAt = camera && points && cartesianPoints;
    const pitch = camera?.pitch ?? 0;
    const dist = useLookAt
      ? Cartesian3.distance(camera?.position, cartesianPoints![0])
      : 0;
    let heading;
    let hpr;

    for (
      let i = 0;
      abortPlayingPathRef.current && points && i < points.length;
      ++i
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
        3
      );
    }
    terria.currentViewer.notifyRepaintRequired();
    setPlayingPath(false);
  }, [
    terria.currentViewer,
    terria.measurableGeometryIndex,
    terria.measurableGeomList,
    terria.cesium
  ]);

  useEffect(() => {
    abortPlayingPathRef.current = playingPath;
    if (playingPath) {
      playPath();
    }
  }, [playingPath, playPath]);

  useEffect(() => {
    if (!viewState.playPathPanelIsVisible) {
      setPlayingPath(false);
    }
  }, [viewState.playPathPanelIsVisible]);

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
      enableResizing={{
        right: false,
        left: false
      }}
    >
      <div className={panelClassName} style={{ pointerEvents: "auto" }}>
        <div className={Styles.header}>
          <div>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>{i18next.t("playPathPanel.title", "Play Path")}</b>
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
          <Button
            onClick={() => {}}
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              margin-left: 5px;
            `}
          >
            <StyledIcon
              realDark={false}
              glyph={Icon.GLYPHS.leftSmall}
              styledWidth="16px"
            />
          </Button>
          <Button
            onClick={() => setPlayingPath((s) => !s)}
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              margin-left: 5px;
            `}
          >
            <StyledIcon
              realDark={false}
              glyph={playingPath ? Icon.GLYPHS.pause : Icon.GLYPHS.play}
              styledWidth="16px"
            />
          </Button>
          <Button
            onClick={() => {}}
            css={`
              color: ${theme.textLight};
              background: ${theme.colorPrimary};
              margin-left: 5px;
            `}
          >
            <StyledIcon
              realDark={false}
              glyph={Icon.GLYPHS.rightSmall}
              styledWidth="16px"
            />
          </Button>
        </div>
      </div>
    </Rnd>
  );
};

export default PlayPathPanel;
