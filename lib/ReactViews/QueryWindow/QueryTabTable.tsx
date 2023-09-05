import React, { useEffect, useState, useRef } from "react";
import { observer } from "mobx-react";
import { BaseModel } from "../../Models/Definition/Model";
import DataTable, { TableColumn } from "react-data-table-component";
import QueryableCatalogItemMixin from "../../ModelMixins/QueryableCatalogItemMixin";
import { TabPropsType } from "./QueryWindow";

interface PropsType {
  item: BaseModel;
}

const QueryTabTable: React.FC<TabPropsType> = observer(
  ({ item }: TabPropsType) => {
    const [columns, setColumns] = useState<TableColumn<Map<string, any>>[]>([]);
    const [data, setData] = useState<Map<string, any>[]>([]);

    const featureProperties = useRef<{ [key: string]: any }[]>();

    useEffect(() => {
      if (
        data &&
        item &&
        QueryableCatalogItemMixin.isMixedInto(item) &&
        item.queryProperties
      ) {
        const fields = Object.entries(item.queryProperties ?? {})
          .filter(([key, elem]) => {
            return (
              elem.canAggregate &&
              !item.queryValues?.[key].some(
                (val) => val && val !== "" && val !== item.ENUM_ALL_VALUE
              )
            );
          })
          .map(([key, elem]) => {
            return { key: key, label: elem.label };
          });

        setColumns(
          fields?.map((field) => {
            return {
              name: field.label,
              selector: (row) => row.get(field.key).toString(),
              sortable: true
            };
          }) ?? []
        );
      }
    }, [data]);

    useEffect(() => {
      if (
        item &&
        QueryableCatalogItemMixin.isMixedInto(item) &&
        item.queryProperties
      ) {
        const featProps = item.getFeaturePropertiesByName(
          Object.entries(item.queryProperties)
            .filter(([_, elem]) => elem.canAggregate || elem.sumOnAggregation)
            .map(([key, _]) => key)
        );

        if (featProps) {
          featureProperties.current = featProps;
          setData(
            featProps.map(
              (elem) => new Map<string, any>(Object.entries(elem))
            ) ?? []
          );
        }
      }
    }, []);

    return (
      <DataTable
        columns={columns}
        data={data}
        pagination
        paginationPerPage={15}
        paginationComponentOptions={{ noRowsPerPage: true }}
        dense
        striped
        highlightOnHover
      />
    );
  }
);

export default QueryTabTable;
