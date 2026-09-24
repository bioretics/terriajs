import React, { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import AttributeTableController from "./AttributeTableController";
import AttributeTableToolbar from "./AttributeTableToolbar";
import AttributeTableGrid from "./AttributeTableGrid";
import AttributeDashboard from "./AttributeDashboard";
import AttributeStatsDialog from "./dialogs/AttributeStatsDialog";
import AttributeChartDialog from "./dialogs/AttributeChartDialog";
import ColumnExplorerDialog from "./dialogs/ColumnExplorerDialog";
import FieldCalculatorDialog from "./dialogs/FieldCalculatorDialog";
import Styles from "./attribute-table.scss";

interface Props {
  controller: AttributeTableController;
}

/** Attribute table body (toolbar, grid/dashboard, dialogs) for the bottom dock panel. */
const AttributeTableContent: React.FC<Props> = observer(
  function AttributeTableContent({ controller }) {
    const { t } = useTranslation();
    const [dialog, setDialog] = useState<
      "explore" | "stats" | "charts" | "calculator" | null
    >(null);

    const counts = controller.statusCounts;
    const itemName =
      (controller.activeItem as any)?.nameInCatalog ??
      (controller.activeItem as any)?.name ??
      "";

    return (
      <div className={Styles.panelContent}>
        {controller.errorMessage && (
          <div className={Styles.errorBanner}>{controller.errorMessage}</div>
        )}
        <AttributeTableToolbar
          controller={controller}
          onOpenExplore={() => setDialog("explore")}
          onOpenStats={() => setDialog("stats")}
          onOpenCharts={() => setDialog("charts")}
          onOpenCalculator={() => setDialog("calculator")}
        />
        {controller.activeTab === "dashboard" ? (
          <AttributeDashboard controller={controller} />
        ) : (
          <AttributeTableGrid controller={controller} />
        )}
        <div className={Styles.statusBar} role="status">
          <span>{itemName}</span>
          <span>
            {t(($) => $.attributeTable.total)}: {counts.total}
          </span>
          <span>
            {t(($) => $.attributeTable.shown)}: {counts.shown}
          </span>
          <span>
            {t(($) => $.attributeTable.selected)}: {counts.selected}
          </span>
          {!controller.capabilities.canEdit && (
            <span>{t(($) => $.attributeTable.readOnly)}</span>
          )}
        </div>

        {dialog === "explore" && (
          <ColumnExplorerDialog
            controller={controller}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === "stats" && (
          <AttributeStatsDialog
            controller={controller}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === "charts" && (
          <AttributeChartDialog
            controller={controller}
            onClose={() => setDialog(null)}
            onAddToDashboard={(spec) => {
              controller.addDashboardWidget({
                type: spec.type,
                title: spec.title,
                field: spec.field,
                fieldY: spec.fieldY,
                categoryField: spec.categoryField,
                aggregation: spec.aggregation,
                bins: spec.bins
              });
              controller.setActiveTab("dashboard");
              setDialog(null);
            }}
          />
        )}
        {dialog === "calculator" && (
          <FieldCalculatorDialog
            controller={controller}
            onClose={() => setDialog(null)}
          />
        )}
      </div>
    );
  }
);

export default AttributeTableContent;
