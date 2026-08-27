import classNames from "classnames";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { Rnd } from "react-rnd";
import { useTheme } from "styled-components";
import { useTranslation } from "react-i18next";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Input from "../../Styled/Input";
import Icon from "../../Styled/Icon";
import ViewState from "../../ReactViewModels/ViewState";
import Terria from "../../Models/Terria";
import Styles from "./viewshed-panel.scss";
import {
  AREA_PANEL_Y,
  useViewshedPanelDefault
} from "./useViewshedPanelDefault";

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const VIEWSHED_AREA_TOOL_ID = "viewshed-area-tool";

const ViewshedAreaPanel = observer((props: Props) => {
  const { terria, viewState } = props;
  const theme = useTheme();
  const { t } = useTranslation();
  const { sentinelRef, defaultBox } = useViewshedPanelDefault(
    AREA_PANEL_Y,
    viewState.viewshedAreaPanelIsVisible
  );

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: false,
    [Styles.isVisible]: viewState.viewshedAreaPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  const closeTool = () => {
    const controller = terria.mapNavigationModel.findItem(
      VIEWSHED_AREA_TOOL_ID
    )?.controller;
    if (controller?.active) {
      controller.deactivate();
    }
  };

  if (!viewState.viewshedAreaPanelIsVisible) {
    return null;
  }

  if (!defaultBox) {
    return <div ref={sentinelRef} aria-hidden />;
  }

  return (
    <Rnd
      className={Styles.panelShell}
      bounds="parent"
      default={defaultBox}
      minWidth={280}
      minHeight={200}
      dragHandleClassName="drag-handle"
      enableResizing={{
        top: false,
        right: true,
        bottom: true,
        left: true,
        topRight: false,
        bottomRight: true,
        bottomLeft: true,
        topLeft: false
      }}
      style={{ pointerEvents: "auto", zIndex: 10 }}
    >
      <div
        className={panelClassName}
        aria-hidden={!viewState.viewshedAreaPanelIsVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                cursor: "move"
              }}
            >
              <b>{t(($) => $.viewshed.areaParameters)}</b>
            </span>
          </div>
          <button
            type="button"
            onClick={closeTool}
            className={Styles.btnCloseFeature}
            title={t(($) => $.general.close)}
          >
            <Icon glyph={Icon.GLYPHS.close} />
          </button>
        </div>
        <div className={Styles.body}>
          <Text
            textLight
            style={{ textAlign: "center" }}
            title={t(($) => $.viewshed.areaObserverHeightTitle)}
          >
            {t(($) => $.viewshed.areaObserverHeight)}
          </Text>
          <Box>
            <Input
              css={`
                margin-left: 12px;
                margin-right: 12px;
                width: 100%;
                border: solid;
                border-width: 1px;
                border-color: ${theme.textLight};
              `}
              title={t(($) => $.viewshed.areaObserverHeightTitle)}
              light={false}
              dark
              type="number"
              value={terria.viewshedAreaObserverHeight}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                runInAction(() => {
                  terria.viewshedAreaObserverHeight = isNaN(val) ? 0 : val;
                });
              }}
            />
          </Box>
          <br />
          <Text
            textLight
            style={{ textAlign: "center" }}
            title={t(($) => $.viewshed.areaDistanceTitle)}
          >
            {t(($) => $.viewshed.areaDistance)}
          </Text>
          <Box>
            <Input
              css={`
                margin-left: 12px;
                margin-right: 12px;
                width: 100%;
                border: solid;
                border-width: 1px;
                border-color: ${theme.textLight};
              `}
              title={t(($) => $.viewshed.areaDistanceTitle)}
              light={false}
              dark
              type="number"
              value={Math.round(terria.viewshedAreaDistance)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                runInAction(() => {
                  terria.viewshedAreaDistance = isNaN(val)
                    ? 0
                    : Math.max(0, val);
                });
              }}
            />
          </Box>
          <br />
        </div>
      </div>
    </Rnd>
  );
});

export default ViewshedAreaPanel;
