import { action } from "mobx";
import { observer } from "mobx-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import Icon from "../../Styled/Icon";
import { useViewState } from "../Context";
import ChartStyles from "../Custom/Chart/chart-panel.scss";
import AttributeTableContent from "./AttributeTableContent";
import Styles from "./attribute-table.scss";

const PANEL_HEIGHT = 400;

/**
 * Attribute Table bottom-dock panel shell. Table logic lives in AttributeTableContent.
 */
export default observer(function AttributeTableWindow() {
  const { t } = useTranslation();
  const viewState = useViewState();
  const controller = viewState.attributeTableController;

  const onClose = action(() => {
    viewState.closeAttributeTable();
  });

  const isVisible =
    !viewState.useSmallScreenInterface &&
    !viewState.hideMapUi &&
    viewState.attributeTablePanelIsVisible &&
    controller.isOpen;

  useEffect(() => {
    viewState.triggerResizeEvent();
  }, [isVisible, viewState]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const escKeyListener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !viewState.shareModalIsVisible) {
        onClose();
      }
    };
    window.addEventListener("keydown", escKeyListener, true);
    return () => window.removeEventListener("keydown", escKeyListener, true);
  }, [isVisible, onClose, viewState.shareModalIsVisible]);

  if (!controller.activeItem && !isVisible) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const itemName =
    (controller.activeItem as { nameInCatalog?: string; name?: string })
      ?.nameInCatalog ??
    (controller.activeItem as { name?: string })?.name ??
    t(($) => $.attributeTable.tableTab);

  return (
    <div className={ChartStyles.holder}>
      <div className={ChartStyles.inner}>
        <div
          className={ChartStyles.chartPanel}
          style={{
            height: PANEL_HEIGHT,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div className={ChartStyles.header}>
            <label className={ChartStyles.sectionLabel}>{itemName}</label>
            <div className={Styles.headerTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={controller.activeTab === "table"}
                className={classNames(Styles.headerTab, {
                  [Styles.headerTabCurrent]: controller.activeTab === "table"
                })}
                onClick={() => controller.setActiveTab("table")}
              >
                {t(($) => $.attributeTable.tableTab)}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={controller.activeTab === "dashboard"}
                className={classNames(Styles.headerTab, {
                  [Styles.headerTabCurrent]:
                    controller.activeTab === "dashboard"
                })}
                onClick={() => controller.setActiveTab("dashboard")}
              >
                {t(($) => $.attributeTable.dashboard)}
              </button>
            </div>
            <button
              type="button"
              className={ChartStyles.btnCloseChartPanel}
              onClick={onClose}
              title={t(($) => $.attributeTable.close)}
            >
              <Icon glyph={Icon.GLYPHS.close} />
            </button>
          </div>
          <div className={Styles.panelBody}>
            <AttributeTableContent controller={controller} />
          </div>
        </div>
      </div>
    </div>
  );
});
