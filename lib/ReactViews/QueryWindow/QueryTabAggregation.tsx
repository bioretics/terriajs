import React, { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import html2canvas from "terriajs-html2canvas";
import Styles from "./query-tab-panel.scss";
import Box from "../../Styled/Box";
import QueryChart from "./QueryChart";
import QuerySelector from "./QuerySelector";
import Checkbox from "../../Styled/Checkbox";
import { ConstantProperty } from "terriajs-cesium";
import Button from "../../Styled/Button";
import { downloadImg } from "../Map/Panels/SharePanel/Print/PrintView";
import { SpacingSpan } from "../../Styled/Spacing";
import DataTable, { TableColumn } from "react-data-table-component";
import { TabPropsType } from "./QueryWindow";

export enum ChartType {
  Pie = "torta",
  BarV = "barre verticali",
  BarH = "barre orizzontali",
  Pivot = "tabella pivot"
}

const defaultAggregationFunction = {
  key: "count",
  label: "Conta",
  measureUnit: undefined,
  decimalPlaces: 0
};

const QueryTabPanel: React.FC<TabPropsType> = observer(
  ({ item }: TabPropsType) => {
    const [aggregationProperty, setAggregationProperty] = useState<string>();
    const [aggregationFunction, setAggregationFunction] = useState<string>();
    const [chartType, setChartType] = useState<ChartType>(ChartType.Pie);
    const [data, setData] =
      useState<{ name: string; value: number; valuePerc: number }[]>();
    const [useHidden, setUseHidden] = useState<boolean>(false);
    //const [componentUpdated, setComponentUpdated] = useState<number>(0);
    const [randomNumber, setRandomNumber] = useState<number>(0);
    const [filterText, setFilterText] = useState<string[]>([]);
    const [columns, setColumns] = useState<
      TableColumn<{ name: string; value: number; valuePerc: number }>[]
    >([]);

    const canvasRef = useRef<HTMLDivElement>(null);
    const aggregateFieldOptions = useRef<{ key: string; label: string }[]>();
    const aggregateFunctionOptions = useRef<
      {
        key: string;
        label: string;
        measureUnit?: string;
        decimalPlaces: number;
      }[]
    >();
    const featureProperties = useRef<{ [key: string]: any }[]>();

    useEffect(() => {
      if (item.queryProperties) {
        const featProps = item.getFeaturePropertiesByName(
          Object.entries(item.queryProperties)
            .filter(([_, elem]) => elem.canAggregate || elem.sumOnAggregation)
            .map(([key, _]) => key)
        );

        if (featProps) {
          featureProperties.current = featProps;
        }

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
        aggregateFieldOptions.current = fields;
        if (!aggregationProperty) {
          setAggregationProperty(fields[0].key);
        }
        const functions = [
          ...[defaultAggregationFunction],
          ...Object.entries(item.queryProperties ?? {})
            .filter(([_, elem]) => elem.sumOnAggregation)
            .map(([key, elem]) => {
              return {
                key: key,
                label: `Somma "${elem.label}"`,
                measureUnit: elem.measureUnit,
                decimalPlaces: elem.decimalPlaces
              };
            })
        ];
        aggregateFunctionOptions.current = functions;
        if (!aggregationFunction) {
          setAggregationFunction(functions[0].key);
        }

        setFilterText(
          Object.entries(item.queryValues ?? {})
            .filter(([_, val]) =>
              val.some((elem) => elem !== "" && elem !== item.ENUM_ALL_VALUE)
            )
            .map(([key, val]) => {
              return `${item.queryProperties?.[key].label}: ${val}`;
            })
        );
      }
    }, []);

    useEffect(() => {
      if (
        featureProperties?.current &&
        aggregationProperty &&
        aggregationFunction
      ) {
        const functionIsCount =
          aggregationFunction === defaultAggregationFunction.key;
        const features = useHidden
          ? featureProperties.current
          : featureProperties.current.filter(
              (elem) => !!(elem.show as ConstantProperty).valueOf()
            );
        const featuresPerClass: { [key: string]: number } = features.reduce(
          (obj, val) => {
            const name = val[aggregationProperty];
            obj[name] =
              (obj[name] ?? 0) +
              (functionIsCount ? 1 : val[aggregationFunction]);
            return obj;
          },
          {}
        );

        const tot = functionIsCount
          ? features.length
          : Object.values(featuresPerClass).reduce((result, val) => {
              return result + val;
            });

        setData(
          Object.entries(featuresPerClass).map(([key, value]) => {
            return {
              name: key,
              value: value,
              valuePerc: Math.round((value / tot + Number.EPSILON) * 100)
            };
          })
        );
      }
    }, [
      featureProperties.current,
      aggregationProperty,
      aggregationFunction,
      useHidden
    ]);

    useEffect(() => {
      if (data && aggregationFunction && chartType) {
        const functionProperty =
          aggregationFunction !== defaultAggregationFunction.key
            ? item.queryProperties?.[aggregationFunction]
            : undefined;
        const measureUnit = functionProperty?.measureUnit ?? "";
        const decimalPlaces = functionProperty?.decimalPlaces ?? 0;

        const currencyFormatter = new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR"
        });

        setColumns([
          {
            name: "Categoria",
            selector: (row) => row.name,
            sortable: true
          },
          {
            name: "Valore",
            selector: (row) => row.value,
            sortable: true,
            format: (row) => {
              return measureUnit === "€"
                ? currencyFormatter.format(row.value)
                : `${measureUnit} ${row.value.toFixed(decimalPlaces)}`;
            }
          },
          {
            name: "Percentuale",
            selector: (row) => row.valuePerc,
            sortable: true,
            format: (row) => `${row.valuePerc}%`
          }
        ]);
      }
    }, [aggregationProperty, chartType, data]);

    const downloadScreenshot = () => {
      const promise = html2canvas(canvasRef.current, {});

      return promise
        .then((canvas: HTMLCanvasElement) => {
          return canvas.toDataURL("image/png");
        })
        .then((dataString: string) => {
          downloadImg(dataString, "chartScreenshot.png");
        });
    };

    const changeColors = () => {
      //setComponentUpdated(componentUpdated + 1);
      setRandomNumber(Math.random());
    };

    const renderControls = () => {
      if (
        !aggregateFieldOptions.current ||
        !aggregateFunctionOptions.current ||
        !aggregationProperty ||
        !aggregationFunction
      ) {
        return null;
      }

      return (
        <>
          <QuerySelector
            label="Aggrega per"
            value={aggregationProperty}
            onSelect={(newValue) => {
              setAggregationProperty(newValue);
            }}
            options={aggregateFieldOptions.current}
          />
          <QuerySelector
            label="Rappresenta"
            value={aggregationFunction}
            onSelect={(newValue) => {
              setAggregationFunction(newValue);
            }}
            options={aggregateFunctionOptions.current}
          />
          <QuerySelector
            label="Modello di grafo"
            value={chartType}
            onSelect={(newValue) => {
              setChartType(newValue as ChartType);
            }}
            options={Object.values(ChartType).map((val) => {
              return { key: val, label: val };
            })}
          />
          <Box styledMargin="12px 20px" style={{ display: "block" }}>
            {filterText.length > 0 && (
              <>
                <br />
                <div>Filtri applicati:</div>
                {filterText.map((txt, index) => (
                  <div key={index}>&#x2022; {txt}</div>
                ))}
                <br />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <b>Ignora filtri</b>
                  <Checkbox
                    title={""}
                    isChecked={useHidden}
                    onChange={() => {
                      setUseHidden(!useHidden);
                    }}
                  />
                </div>
              </>
            )}
          </Box>
          <SpacingSpan bottom={filterText.length > 0 ? 40 : 60} />
          {chartType !== ChartType.Pivot && (
            <Box styledMargin="12px 20px">
              <Button
                primary
                css={`
                  width: 100px;
                  border-radius: 2px;
                  margin: 5px;
                `}
                onClick={changeColors}
              >
                Cambia colori
              </Button>
              <Button
                primary
                css={`
                  width: 100px;
                  border-radius: 2px;
                  margin: 5px;
                `}
                onClick={downloadScreenshot}
              >
                Download screenshot
              </Button>
            </Box>
          )}
        </>
      );
    };

    const renderData = () => {
      if (data && aggregationProperty && item.queryProperties) {
        if (chartType !== ChartType.Pivot) {
          return (
            <QueryChart
              data={data}
              valueKey="value"
              valuePercKey="valuePerc"
              measureUnit={
                aggregationFunction &&
                aggregationFunction in item.queryProperties
                  ? item.queryProperties[aggregationFunction].measureUnit
                  : undefined
              }
              decimalPlaces={
                aggregationFunction &&
                aggregationFunction in item.queryProperties
                  ? item.queryProperties[aggregationFunction].decimalPlaces
                  : 0
              }
              chartType={chartType}
              randomNumber={randomNumber}
              ref={canvasRef}
            />
          );
        } else {
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
      }
    };

    return (
      <div className={Styles.root}>
        <Box fullHeight column>
          <Box fullHeight overflow="hidden">
            <Box className={Styles.dataExplorer} styledWidth="30%">
              {renderControls()}
            </Box>
            <Box styledWidth="70%" flexWrap>
              {renderData()}
            </Box>
          </Box>
        </Box>
      </div>
    );
  }
);

export default QueryTabPanel;
