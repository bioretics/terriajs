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

const ViewshedPanel = observer((props: Props) => {
  const { terria, viewState } = props;
  const state = terria.viewshed3d;
  const theme = useTheme();
  const { t } = useTranslation();
  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: false,
    [Styles.isVisible]: viewState.viewshedPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });
  const inputStyle = `
    margin-left: 30px;
    margin-right: 30px;
    border: solid;
    border-width: 1px;
    border-color: ${theme.textLight};
  `;

  const setNumber = (setter: (value: number) => void, value: string) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    runInAction(() => setter(number));
  };

  const statusText = (status: string) => {
    switch (status) {
      case "computing":
        return t(($) => $.viewshed.terrainComputing);
      case "ready":
        return t(($) => $.viewshed.terrainReady);
      case "unavailable":
        return t(($) => $.viewshed.terrainUnavailable);
      default:
        return "";
    }
  };

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.viewshedPanelIsVisible}
      >
        <div className={Styles.header}>
          <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
            <span style={{ display: "flex", justifyContent: "center" }}>
              <b>{t(($) => $.viewshed.parameters)}</b>
            </span>
          </div>
        </div>
        {state && (
          <div className={Styles.body}>
            <Text
              textLight
              style={{ textAlign: "center" }}
              title={t(($) => $.viewshed.observerHeightInputTitle)}
            >
              {t(($) => $.viewshed.observerHeightInput)}
            </Text>
            <Box>
              <Input
                css={inputStyle}
                title={t(($) => $.viewshed.observerHeightInputTitle)}
                light={false}
                dark
                required
                type="number"
                min={0}
                step={1}
                value={state.observerHeight}
                onChange={(event) =>
                  setNumber(
                    (value) => (state.observerHeight = Math.max(0, value)),
                    event.target.value
                  )
                }
              />
            </Box>
            <br />
            <Text
              textLight
              style={{ textAlign: "center" }}
              title={t(($) => $.viewshed.maximumDistanceInputTitle)}
            >
              {t(($) => $.viewshed.maximumDistanceInput)}
            </Text>
            <Box>
              <Input
                css={inputStyle}
                title={t(($) => $.viewshed.maximumDistanceInputTitle)}
                light={false}
                dark
                required
                type="number"
                min={1.1}
                step={1}
                value={Number(state.maximumDistance.toFixed(1))}
                onChange={(event) =>
                  setNumber(
                    (value) => (state.maximumDistance = Math.max(1.1, value)),
                    event.target.value
                  )
                }
              />
            </Box>
            <br />
            <Text textLight style={{ textAlign: "center" }}>
              {statusText(state.terrainStatus)}
            </Text>
          </div>
        )}
      </div>
    </DragWrapper>
  );
});

export default ViewshedPanel;
