import classNames from "classnames";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useTheme } from "styled-components";
import { useTranslation } from "react-i18next";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Input from "../../Styled/Input";
import ViewState from "../../ReactViewModels/ViewState";
import Terria from "../../Models/Terria";
import Styles from "./viewshed-panel.scss";
import DragWrapper from "../../ReactViews/Drag/DragWrapper";

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const ViewshedAreaPanel = observer((props: Props) => {
  const { terria, viewState } = props;
  const theme = useTheme();
  const { t } = useTranslation();

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: false,
    [Styles.isVisible]: viewState.viewshedAreaPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.viewshedAreaPanelIsVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>{t(($) => $.viewshed.areaParameters)}</b>
            </span>
          </div>
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
                margin-left: 30px;
                margin-right: 30px;
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
                margin-left: 30px;
                margin-right: 30px;
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
    </DragWrapper>
  );
});

export default ViewshedAreaPanel;
