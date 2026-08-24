import classNames from "classnames";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
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

  const numberField = (
    label: string,
    title: string,
    value: number,
    onChange: (value: number) => void,
    min?: number,
    max?: number,
    step?: number
  ) => (
    <>
      <Text textLight style={{ textAlign: "center" }} title={title}>
        {label}
      </Text>
      <Box>
        <Input
          css={inputStyle}
          title={title}
          light={false}
          dark
          required
          type="number"
          min={min}
          max={max}
          step={step ?? 1}
          value={value}
          onChange={(event) => setNumber(onChange, event.target.value)}
        />
      </Box>
      <br />
    </>
  );

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
            {numberField(
              t(($) => $.viewshed.observerHeightInput),
              t(($) => $.viewshed.observerHeightInputTitle),
              state.observerHeight,
              (value) => (state.observerHeight = Math.max(0, value)),
              0
            )}
            {numberField(
              t(($) => $.viewshed.targetHeightInput),
              t(($) => $.viewshed.targetHeightInputTitle),
              state.targetHeight,
              (value) => (state.targetHeight = Math.max(0, value)),
              0
            )}
            {numberField(
              t(($) => $.viewshed.horizontalFovInput),
              t(($) => $.viewshed.horizontalFovInputTitle),
              Number(CesiumMath.toDegrees(state.horizontalFov).toFixed(1)),
              (value) =>
                (state.horizontalFov = CesiumMath.toRadians(
                  Math.max(1, Math.min(179, value))
                )),
              1,
              179
            )}
            {numberField(
              t(($) => $.viewshed.verticalFovInput),
              t(($) => $.viewshed.verticalFovInputTitle),
              Number(CesiumMath.toDegrees(state.verticalFov).toFixed(1)),
              (value) =>
                (state.verticalFov = CesiumMath.toRadians(
                  Math.max(1, Math.min(179, value))
                )),
              1,
              179
            )}
            {numberField(
              t(($) => $.viewshed.maximumDistanceInput),
              t(($) => $.viewshed.maximumDistanceInputTitle),
              Number(state.maximumDistance.toFixed(1)),
              (value) => (state.maximumDistance = Math.max(1.1, value)),
              1.1
            )}
            <Text textLight style={{ textAlign: "center" }}>
              {state.terrainStatus === "updating"
                ? t(($) => $.viewshed.terrainUpdating, {
                    count: state.terrainTileLoadCount
                  })
                : t(($) => $.viewshed.terrainCurrent)}
            </Text>
            <Text textLight style={{ textAlign: "center", fontSize: "0.85em" }}>
              {t(($) => $.viewshed.terrainLodNotice)}
            </Text>
            <Box style={{ marginTop: 10, textAlign: "center" }}>
              <label title={t(($) => $.viewshed.debugInputTitle)}>
                <input
                  type="checkbox"
                  checked={state.showDebug}
                  onChange={(event) =>
                    runInAction(() => (state.showDebug = event.target.checked))
                  }
                />{" "}
                {t(($) => $.viewshed.debugInput)}
              </label>
            </Box>
          </div>
        )}
      </div>
    </DragWrapper>
  );
});

export default ViewshedPanel;
