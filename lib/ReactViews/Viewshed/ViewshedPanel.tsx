//"use strict";

import classNames from "classnames";
import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useTheme } from "styled-components";
import { useTranslation } from "react-i18next";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Checkbox from "../../Styled/Checkbox";
import Input from "../../Styled/Input";
import ViewState from "../../ReactViewModels/ViewState";
import Terria from "../../Models/Terria";
import Styles from "./viewshed-panel.scss";

const DragWrapper = require("../DragWrapper");

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const ViewshedPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const theme = useTheme();

  const { t } = useTranslation();

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: false,
    [Styles.isVisible]: viewState.viewshedPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  const inputCss = `
    margin-left: 30px;
    margin-right: 30px;
    border: solid;
    border-width: 1px;
    border-color: ${theme.textLight};
  `;

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
          <span style={{ display: "flex", justifyContent: "center" }}>
            <b>{t("viewshed.parameters")}</b>
          </span>
        </div>
      </div>
    );
  };

  const renderAreaCheckbox = () => {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "10px",
          color: theme.textLight
        }}
      >
        <Checkbox
          title={t("viewshed.areaCheckboxTitle")}
          isChecked={terria.viewshedAreaMode}
          onChange={(e) => {
            const checked = e.target.checked;
            runInAction(() => {
              terria.viewshedAreaMode = checked;
              // Clear dynamic mode when area mode is turned off
              if (!checked) {
                terria.viewshedDynamicSize = false;
              }
            });
          }}
        />
        <Text textLight style={{ marginLeft: "6px" }}>
          {t("viewshed.areaCheckbox")}
        </Text>
      </label>
    );
  };

  const renderDynamicSizeCheckbox = () => {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "10px",
          color: theme.textLight,
          opacity: terria.viewshedAreaMode ? 1 : 0.5
        }}
      >
        <Checkbox
          title={t("viewshed.dynamicSizeCheckboxTitle")}
          isChecked={terria.viewshedDynamicSize}
          isDisabled={!terria.viewshedAreaMode}
          onChange={(e) => {
            const checked = e.target.checked;
            runInAction(() => {
              terria.viewshedDynamicSize = checked;
            });
          }}
        />
        <Text textLight style={{ marginLeft: "6px" }}>
          {t("viewshed.dynamicSizeCheckbox")}
        </Text>
      </label>
    );
  };

  const renderBody = () => {
    return (
      <div className={Styles.body}>
        <Text
          textLight
          style={{ textAlign: "center" }}
          title={t("viewshed.observerHeightInputTitle")}
        >
          {t("viewshed.observerHeightInput")}
        </Text>
        <Box>
          <Input
            css={inputCss}
            title={t("viewshed.observerHeightInputTitle")}
            light={false}
            dark
            required
            type="number"
            value={terria.viewshedObserverHeight}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              runInAction(() => {
                terria.viewshedObserverHeight = isNaN(val) ? 0 : val;
              });
            }}
          />
        </Box>
        <br />
        <Text
          textLight
          style={{ textAlign: "center" }}
          title={t("viewshed.targetHeightInputTitle")}
        >
          {t("viewshed.targetHeightInput")}
        </Text>
        <Box>
          <Input
            css={inputCss}
            title={t("viewshed.targetHeightInputTitle")}
            light={false}
            dark
            required
            type="number"
            value={terria.viewshedTargetHeight}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              runInAction(() => {
                terria.viewshedTargetHeight = isNaN(val) ? 0 : val;
              });
            }}
          />
        </Box>
        <br />
        {renderAreaCheckbox()}
        {renderDynamicSizeCheckbox()}
        <Text
          textLight
          style={{
            textAlign: "center",
            opacity: terria.viewshedAreaMode ? 1 : 0.5
          }}
          title={t("viewshed.radiusInputTitle")}
        >
          {t("viewshed.radiusInput")}
        </Text>
        <Box>
          <Input
            css={inputCss}
            title={t("viewshed.radiusInputTitle")}
            light={false}
            dark
            required
            type="number"
            min={100}
            disabled={!terria.viewshedAreaMode || terria.viewshedDynamicSize}
            value={terria.viewshedAreaRadius}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              runInAction(() => {
                terria.viewshedAreaRadius = isNaN(val) ? 0 : val;
              });
            }}
          />
        </Box>
        <br />
        {terria.viewshedAreaMode && terria.viewshedAreaComputing && (
          <Text textLight style={{ textAlign: "center" }}>
            {t("viewshed.computing")}
          </Text>
        )}
      </div>
    );
  };

  return (
    <DragWrapper>
      <div
        className={panelClassName}
        aria-hidden={!viewState.viewshedPanelIsVisible}
      >
        {renderHeader()}
        {renderBody()}
      </div>
    </DragWrapper>
  );
});

export default ViewshedPanel;
