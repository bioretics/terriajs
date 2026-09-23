import React, { useMemo } from "react";
import { observer } from "mobx-react";
import DataTable, { TableColumn } from "react-data-table-component";
import AttributeTableController from "./AttributeTableController";
import Styles from "./attribute-table.scss";

interface Props {
  controller: AttributeTableController;
}

const AttributeTableGrid: React.FC<Props> = observer(
  function AttributeTableGrid({ controller }) {
    const rows = controller.displayRows;
    const columns = controller.visibleColumns;
    const selectedSet = useMemo(
      () => new Set(controller.selectedIds),
      [controller.selectedIds]
    );

    const tableColumns: TableColumn<any>[] = useMemo(() => {
      return columns.map((col) => ({
        name: col.title || col.key,
        selector: (row: any) => row.properties[col.key],
        sortable: true,
        wrap: true,
        grow: 1,
        cell: (row: any) => {
          const value = row.properties[col.key];
          if (controller.isEditing) {
            return (
              <div className={Styles.editableCell}>
                <input
                  aria-label={`${col.title} for ${row.featureId}`}
                  defaultValue={
                    value === null || value === undefined ? "" : String(value)
                  }
                  onBlur={(e) =>
                    controller.setCellDraft(
                      row.featureId,
                      col.key,
                      e.target.value
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          }
          return (
            <span
              title={value === null || value === undefined ? "" : String(value)}
            >
              {value === null || value === undefined ? "" : String(value)}
            </span>
          );
        }
      }));
    }, [columns, controller]);

    if (rows.length === 0) {
      return <div className={Styles.emptyState}>No records to display.</div>;
    }

    return (
      <div className={Styles.gridWrap}>
        <DataTable
          columns={tableColumns}
          data={rows}
          keyField="featureId"
          pagination
          paginationPerPage={25}
          paginationRowsPerPageOptions={[15, 25, 50, 100]}
          dense
          striped
          highlightOnHover
          pointerOnHover
          onRowClicked={(row, event) => {
            controller.handleRowClick(row.featureId, {
              additive: !!(event?.ctrlKey || event?.metaKey),
              range: !!event?.shiftKey
            });
          }}
          conditionalRowStyles={[
            {
              when: (row) => selectedSet.has(row.featureId),
              style: {
                backgroundColor: "rgba(33, 150, 243, 0.18)",
                fontWeight: 600
              }
            }
          ]}
          onSort={(column, direction) => {
            const key = columns.find(
              (c) => c.title === column.name || c.key === column.name
            )?.key;
            if (key) {
              controller.setSort(key, direction === "asc" ? "asc" : "desc");
            }
          }}
        />
      </div>
    );
  }
);

export default AttributeTableGrid;
