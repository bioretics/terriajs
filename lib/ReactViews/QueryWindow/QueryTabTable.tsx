import React, { useEffect, useState, useRef } from "react";
import { observer } from "mobx-react";
import DataTable, { TableColumn } from "react-data-table-component";
import QueryableCatalogItemMixin from "../../ModelMixins/QueryableCatalogItemMixin";
import { TabPropsType } from "./QueryWindow";
import { ConstantProperty } from "terriajs-cesium";
import Box from "../../Styled/Box";
import Button from "../../Styled/Button";
import DataUri from "../../Core/DataUri";

const QueryTabTable: React.FC<TabPropsType> = observer(
  ({ item, terria }: TabPropsType) => {
    const [columns, setColumns] = useState<TableColumn<Map<string, any>>[]>([]);
    const [data, setData] = useState<Map<string, any>[]>([]);

    const featureProperties = useRef<{ [key: string]: any }[]>();

    const downloadTable = () => {
      const rows = [Array.from(data[0].keys()).join(",")];
      rows.push(...data.map((elem) => Array.from(elem.values()).join(",")));
      const csvString = rows.join("\n");
      const href = DataUri.make("csv", csvString);
      var link = document.createElement("a");
      link.href = href;
      link.download = "download.csv";
      link.click();
    };

    useEffect(() => {
      if (
        data &&
        item &&
        QueryableCatalogItemMixin.isMixedInto(item) &&
        item.queryProperties
      ) {
        const fields = Object.entries(item.queryProperties ?? {})
          .filter(([_, elem]) => {
            return elem.canAggregate || elem.sumOnAggregation;
          })
          .map(([key, elem]) => {
            return {
              key: key,
              label: elem.label,
              sumOnAggregation: elem.sumOnAggregation
            };
          });

        const currencyFormatter = new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0
        });

        setColumns(
          fields?.map((field) => {
            return {
              name: field.label,
              selector: (row) => row.get(field.key),
              sortable: true,
              format: (row) => {
                return field.sumOnAggregation
                  ? currencyFormatter.format(row.get(field.key))
                  : row.get(field.key).toString();
              },
              right: field.sumOnAggregation
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
        const featProps = item
          .getFeaturePropertiesByName(
            Object.entries(item.queryProperties)
              .filter(([_, elem]) => elem.canAggregate || elem.sumOnAggregation)
              .map(([key, _]) => key)
          )
          ?.filter((elem) => !!(elem.show as ConstantProperty).valueOf());

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
      <>
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
        {terria?.isFeatureAllowedByProfile("DownloadQueryData") && (
          <Box>
            <Button
              primary
              css={`
                width: 100px;
                border-radius: 2px;
                margin: 10px;
              `}
              onClick={downloadTable}
            >
              Download
            </Button>
          </Box>
        )}
      </>
    );
  }
);

export default QueryTabTable;
