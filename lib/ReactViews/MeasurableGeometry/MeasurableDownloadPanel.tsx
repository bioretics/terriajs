import React from "react";
import { Rnd } from "react-rnd";
import MeasurableDownload from "./MeasurableDownload";
import Terria from "../../Models/Terria";
import Styles from "./measurable-panel.scss";
import Icon from "../../Styled/Icon";
import i18next from "i18next";
import ViewState from "../../ReactViewModels/ViewState";
import classNames from "classnames";

interface Props {
  terria: Terria;
  viewState: ViewState;
  onClose: () => void;
}

const MeasurableDownloadPanel = (props: Props) => {
  const { onClose, ...downloadProps } = props;

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: downloadProps.viewState.measurablePanelIsCollapsed,
    [Styles.isVisible]: downloadProps.viewState.measurablePanelIsVisible,
    [Styles.isTranslucent]: downloadProps.viewState.explorerPanelIsVisible
  });

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <div>
          <span style={{ display: "flex", justifyContent: "center" }}>
            <b>{i18next.t("DOWNLOAD")}</b>
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
    );
  };

  return (
    <Rnd
      bounds="window"
      default={{ x: 300, y: 100, width: 400, height: 300 }}
      enableResizing={false}
    >
      <div className={panelClassName} style={{ pointerEvents: "auto" }}>
        {renderHeader()}
        <div className={Styles.body} style={{ padding: "20px" }}>
          <MeasurableDownload
            terria={downloadProps.terria}
            name={
              downloadProps.terria.measurableGeomList[
                downloadProps.terria.measurableGeometryIndex
              ].filename!!
            }
            pathNotes={
              downloadProps.terria.measurableGeomList[
                downloadProps.terria.measurableGeometryIndex
              ].pathNotes!!
            }
            ellipsoid={downloadProps.terria?.cesium?.scene?.globe?.ellipsoid!!}
          />
        </div>
      </div>
    </Rnd>
  );
};

export default MeasurableDownloadPanel;
