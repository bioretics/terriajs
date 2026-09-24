import React, { useMemo } from "react";
import { observer } from "mobx-react";
import { coerceNumericStringRows, pickAnalysisRows } from "../attributeCharts";
import AttributeTableController from "../AttributeTableController";
import FieldStatisticsDialog from "./FieldStatisticsDialog";

interface Props {
  controller: AttributeTableController;
  onClose: () => void;
}

const AttributeStatsDialog: React.FC<Props> = observer(
  function AttributeStatsDialog({ controller, onClose }) {
    const rows = useMemo(
      () => coerceNumericStringRows(controller.baseRows),
      [controller.baseRows]
    );
    const filteredRows = useMemo(
      () =>
        pickAnalysisRows(
          rows,
          controller.baseRows,
          new Set(controller.searchFilteredRows.map((r) => r.featureId))
        ),
      [rows, controller.baseRows, controller.searchFilteredRows]
    );
    const selectedRows = useMemo(
      () =>
        pickAnalysisRows(
          rows,
          controller.baseRows,
          new Set(controller.selectedIds)
        ),
      [rows, controller.baseRows, controller.selectedIds]
    );
    const columns = controller.visibleColumns.map((c) => c.key);
    const layerName =
      (controller.activeItem as { nameInCatalog?: string; name?: string })
        ?.nameInCatalog ??
      (controller.activeItem as { name?: string })?.name ??
      "";

    return (
      <FieldStatisticsDialog
        rows={rows}
        filteredRows={filteredRows}
        selectedRows={selectedRows}
        columns={columns}
        layerName={layerName}
        onClose={onClose}
      />
    );
  }
);

export default AttributeStatsDialog;
