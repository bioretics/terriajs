import { action } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { useViewState } from "../StandardUserInterface/ViewStateContext";
import ModalPopup from "../ExplorerWindow/ModalPopup";
import Styles from "./query-window.scss";
import classNames from "classnames";
import QueryPanel from "./QueryPanel";

export const QueryWindowElementName = "QueryData";

export default observer<React.FC>(function QueryWindow() {
  const viewState = useViewState();

  const onClose = action(() => {
    viewState.closeQuery();
    viewState.switchMobileView("nowViewing");
  });

  const onStartAnimatingIn = action(() => {
    viewState.explorerPanelAnimating = true;
  });

  const onDoneAnimatingIn = action(() => {
    viewState.explorerPanelAnimating = false;
  });

  const isVisible =
    !viewState.useSmallScreenInterface &&
    !viewState.hideMapUi &&
    viewState.queryPanelIsVisible;

  if (!viewState.terria.itemToQuery) return null;

  return (
    <ModalPopup
      viewState={viewState}
      isVisible={isVisible}
      isTopElement={viewState.topElement === QueryWindowElementName}
      onClose={onClose}
      onStartAnimatingIn={onStartAnimatingIn}
      onDoneAnimatingIn={onDoneAnimatingIn}
    >
      <div>
        <ul className={Styles.tabList} role="tablist">
          <li key={0} className={Styles.tabListItem} role="tab">
            <div
              style={{ marginTop: "17px", marginLeft: "10px", color: "white" }}
            >
              Query
            </div>
          </li>
        </ul>
        <section className={classNames(Styles.tabPanel)}>
          <div className={Styles.panelContent}>
            <QueryPanel item={viewState.terria.itemToQuery} />
          </div>
        </section>
      </div>
    </ModalPopup>
  );
});
