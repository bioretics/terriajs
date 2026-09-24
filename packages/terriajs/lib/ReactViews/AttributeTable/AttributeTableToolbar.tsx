import React from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import Icon, { StyledIcon } from "../../Styled/Icon";
import AttributeTableController from "./AttributeTableController";
import {
  PanelButton,
  PanelCheckboxLabel,
  PanelInput
} from "./AttributeTableStyles";
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
    const hasRows = controller.baseRows.length > 0;

    return (
      <div className={Styles.toolbar} role="toolbar">
        {caps.canEdit &&
          (controller.isEditing ? (
            <>
              <PanelButton type="button" onClick={() => controller.saveEdits()}>
                {t(($) => $.attributeTable.save)}
              </PanelButton>
              <PanelButton
                type="button"
                onClick={() => controller.cancelEditing()}
              >
                {t(($) => $.attributeTable.cancel)}
              </PanelButton>
            </>
          ) : (
            <PanelButton
              type="button"
              onClick={() => controller.startEditing()}
            >
              {t(($) => $.attributeTable.edit)}
            </PanelButton>
          ))}

        <PanelButton
          type="button"
          disabled={!hasRows}
          title={t(($) => $.attributeTable.columnExplorer.buttonTitle)}
          onClick={onOpenExplore}
        >
          <StyledIcon glyph={Icon.GLYPHS.data} styledWidth="13px" light />
          {t(($) => $.attributeTable.columnExplorer.button)}
        </PanelButton>
        <PanelButton
          type="button"
          disabled={!hasRows}
          title={t(($) => $.attributeTable.statistics.buttonTitle)}
          onClick={onOpenStats}
        >
          <StyledIcon
            glyph={Icon.GLYPHS.oneTwoThree}
            styledWidth="13px"
            light
          />
          {t(($) => $.attributeTable.statistics.button)}
        </PanelButton>
        <PanelButton
          type="button"
          disabled={!hasRows}
          title={t(($) => $.attributeTable.chart.buttonTitle)}
          onClick={onOpenCharts}
        >
          <StyledIcon glyph={Icon.GLYPHS.barChart} styledWidth="13px" light />
          {t(($) => $.attributeTable.chart.button)}
        </PanelButton>
        <PanelButton
          type="button"
          onClick={() => controller.setActiveTab("dashboard")}
        >
          {t(($) => $.attributeTable.dashboard)}
        </PanelButton>

        {caps.canEdit && (
          <PanelButton type="button" onClick={onOpenCalculator}>
            {t(($) => $.attributeTable.fieldCalculator)}
          </PanelButton>
        )}

        {caps.canExport && (
          <PanelButton
            type="button"
            onClick={() => controller.exportCsv("shown")}
          >
            <StyledIcon glyph={Icon.GLYPHS.download} styledWidth="13px" light />
            {t(($) => $.attributeTable.export)}
          </PanelButton>
        )}

        <div className={Styles.toolbarSpacer} />

        <PanelInput
          type="search"
          placeholder={t(($) => $.attributeTable.searchPlaceholder)}
          value={controller.search}
          onChange={(e) => controller.setSearch(e.target.value)}
          aria-label={t(($) => $.attributeTable.searchPlaceholder)}
        />

        {caps.canZoomToSelection && (
          <PanelCheckboxLabel>
            <input
              type="checkbox"
              checked={controller.zoomToSelection}
              onChange={(e) => controller.setZoomToSelection(e.target.checked)}
            />
            {t(($) => $.attributeTable.zoomToSelection)}
          </PanelCheckboxLabel>
        )}

        <PanelButton
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
        </PanelButton>
      </div>
    );
  }
);

export default AttributeTableToolbar;
