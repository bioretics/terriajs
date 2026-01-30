//"use strict";

import React from "react";
import Styles from "./viewshed-panel.scss";
import classNames from "classnames";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import Text from "../../Styled/Text";
import Box from "../../Styled/Box";
import Input from "../../Styled/Input";
import ViewState from "../../ReactViewModels/ViewState";
import Terria from "../../Models/Terria";
import { useTheme } from "styled-components";

const DragWrapper = require("../DragWrapper");

interface Props {
  viewState: ViewState;
  terria: Terria;
}

const ViewshedPanel = observer((props: Props) => {
  const { terria, viewState } = props;

  const theme = useTheme();

  const panelClassName = classNames(Styles.panel, {
    [Styles.isCollapsed]: false,
    [Styles.isVisible]: viewState.viewshedPanelIsVisible,
    [Styles.isTranslucent]: viewState.explorerPanelIsVisible
  });

  const renderHeader = () => {
    return (
      <div className={Styles.header}>
        <div className={classNames("drag-handle", Styles.btnPanelHeading)}>
          <span style={{ display: "flex", justifyContent: "center" }}>
            <b>Parametri Linea di vista</b>
          </span>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (terria.viewshedDistances) {
      return (
        <div className={Styles.body}>
          <Text textLight style={{ textAlign: "center" }} title="">
            {"Altezza dell'osservatore"}
            <br />
            rispetto al suolo in metri
            <br />
            (punto arancione):
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
              title="Altezza dell'osservatore rispetto al suolo (m)"
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
          <Text textLight style={{ textAlign: "center" }} title="">
            Altezza del bersaglio
            <br />
            rispetto al suolo in metri
            <br />
            (punto viola):
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
              title="Altezza del bersaglio rispetto al suolo (m)"
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
        </div>
      );
    }
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
