import { action } from "mobx";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import classNames from "classnames";
import styled from "styled-components";
import { useViewState } from "../Context";
import ModalPopup from "../ExplorerWindow/ModalPopup";
import { Button } from "../../Styled/Button";
import AttributeTableContent from "./AttributeTableContent";
import { ATTRIBUTE_TABLE_ELEMENT_NAME } from "./types";
import Styles from "./attribute-table.scss";

/**
 * Attribute Table modal shell. Content is isolated so it can later be
 * remounted inside a resizable bottom dock without changing table logic.
 */
export default observer(function AttributeTableWindow() {
  const { t } = useTranslation();
  const viewState = useViewState();
  const controller = viewState.attributeTableController;

  const onClose = action(() => {
    viewState.closeAttributeTable();
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
    viewState.attributeTablePanelIsVisible &&
    controller.isOpen;

  if (!controller.activeItem && !isVisible) return null;

  return (
    <ModalPopup
      viewState={viewState}
      isVisible={isVisible}
      isTopElement={viewState.topElement === ATTRIBUTE_TABLE_ELEMENT_NAME}
      onClose={onClose}
      onStartAnimatingIn={onStartAnimatingIn}
      onDoneAnimatingIn={onDoneAnimatingIn}
    >
      <div
        onPointerDown={action(() => {
          viewState.setTopElement(ATTRIBUTE_TABLE_ELEMENT_NAME);
        })}
      >
        <ul className={Styles.tabList} role="tablist">
          <li className={Styles.tabListItem} role="tab">
            <div style={{ marginTop: 17, marginLeft: 10, color: "white" }}>
              <ButtonTab
                type="button"
                onClick={() => controller.setActiveTab("table")}
                isCurrent={controller.activeTab === "table"}
              >
                {t(($) => $.attributeTable.tableTab)}
              </ButtonTab>
            </div>
          </li>
          <li className={Styles.tabListItem} role="tab">
            <div style={{ marginTop: 17, marginLeft: 10, color: "white" }}>
              <ButtonTab
                type="button"
                onClick={() => controller.setActiveTab("dashboard")}
                isCurrent={controller.activeTab === "dashboard"}
              >
                {t(($) => $.attributeTable.dashboard)}
              </ButtonTab>
            </div>
          </li>
        </ul>
        <section className={classNames(Styles.tabPanel)}>
          <AttributeTableContent controller={controller} />
        </section>
      </div>
    </ModalPopup>
  );
});

const ButtonTab = styled(Button)<{ isCurrent: boolean }>`
  ${(props) => `
    background: transparent;
    font-size: $font-size-mid-small;
    padding: $padding-small;
    margin: $padding;
    height: 3vh;
    min-height: 3vh;
    border-radius: 3px;
    color: ${props.theme.textLight};
    &:hover,
    &:focus {
      background: ${props.theme.textLight};
      color: ${props.theme.colorPrimary};
    }
    ${
      props.isCurrent &&
      `
      background: ${props.theme.textLight};
      color: ${props.theme.colorPrimary};
    `
    }
  `}
`;
