import React from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import Button from "../../Styled/Button";
import AttributeTableController from "./AttributeTableController";
import Styles from "./attribute-table.scss";

interface Props {
  controller: AttributeTableController;
  onOpenExplore: () => void;
  onOpenStats: () => void;
  onOpenCharts: () => void;
  onOpenCalculator: () => void;
}

const AttributeTableToolbar: React.FC<Props> = observer(
  function AttributeTableToolbar({
    controller,
    onOpenExplore,
    onOpenStats,
    onOpenCharts,
    onOpenCalculator
  }) {
    const { t } = useTranslation();
    const caps = controller.capabilities;

    return (
      <div className={Styles.toolbar} role="toolbar">
        {caps.canEdit &&
          (controller.isEditing ? (
            <>
              <Button
                primary
                type="button"
                onClick={() => controller.saveEdits()}
              >
                {t(($) => $.attributeTable.save)}
              </Button>
              <Button type="button" onClick={() => controller.cancelEditing()}>
                {t(($) => $.attributeTable.cancel)}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => controller.startEditing()}>
              {t(($) => $.attributeTable.edit)}
            </Button>
          ))}

        <Button type="button" onClick={onOpenExplore}>
          {t(($) => $.attributeTable.explore)}
        </Button>
        <Button type="button" onClick={onOpenStats}>
          {t(($) => $.attributeTable.statistics)}
        </Button>
        <Button type="button" onClick={onOpenCharts}>
          {t(($) => $.attributeTable.charts)}
        </Button>
        <Button
          type="button"
          onClick={() => controller.setActiveTab("dashboard")}
        >
          {t(($) => $.attributeTable.dashboard)}
        </Button>

        {caps.canEdit && (
          <Button type="button" onClick={onOpenCalculator}>
            {t(($) => $.attributeTable.fieldCalculator)}
          </Button>
        )}

        {caps.canExport && (
          <Button type="button" onClick={() => controller.exportCsv("shown")}>
            {t(($) => $.attributeTable.export)}
          </Button>
        )}

        <div className={Styles.toolbarSpacer} />

        <input
          className={Styles.searchInput}
          type="search"
          placeholder={t(($) => $.attributeTable.searchPlaceholder)}
          value={controller.search}
          onChange={(e) => controller.setSearch(e.target.value)}
          aria-label={t(($) => $.attributeTable.searchPlaceholder)}
        />

        {caps.canZoomToSelection && (
          <label>
            <input
              type="checkbox"
              checked={controller.zoomToSelection}
              onChange={(e) => controller.setZoomToSelection(e.target.checked)}
            />{" "}
            {t(($) => $.attributeTable.zoomToSelection)}
          </label>
        )}

        <Button
          type="button"
          onClick={() =>
            controller.setRowFilterMode(
              controller.rowFilterMode === "all" ? "selected" : "all"
            )
          }
        >
          {controller.rowFilterMode === "all"
            ? t(($) => $.attributeTable.showSelected)
            : t(($) => $.attributeTable.showAll)}
        </Button>
      </div>
    );
  }
);

export default AttributeTableToolbar;
