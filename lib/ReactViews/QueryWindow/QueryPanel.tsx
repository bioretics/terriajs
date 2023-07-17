import React, { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import html2canvas from "terriajs-html2canvas";
import Styles from "./query-panel.scss";
import Box from "../../Styled/Box";
import QueryableCatalogItemMixin from "../../ModelMixins/QueryableCatalogItemMixin";
import { BaseModel } from "../../Models/Definition/Model";
import QueryChart from "./QueryChart";
import QuerySelector from "./QuerySelector";
import Checkbox from "../../Styled/Checkbox";
import { ConstantProperty } from "terriajs-cesium";
import Button from "../../Styled/Button";
import { downloadImg } from "../Map/Panels/SharePanel/Print/PrintView";
import { SpacingSpan } from "../../Styled/Spacing";

interface PropsType {
  item: BaseModel;
}

export enum ChartType {
  Pie = "torta",
  BarV = "barre verticali",
  BarH = "barre orizzontali"
}

const defaultAggregationFunction = { key: "count", label: "Conta" };

const QueryPanel = observer(({ item }: PropsType) => {
  const [aggregationProperty, setAggregationProperty] = useState<string>();
  const [aggregationFunction, setAggregationFunction] = useState<string>();
  const [chartType, setChartType] = useState<ChartType>(ChartType.Pie);
  const [data, setData] = useState<{ name: string; value: number }[]>();
  const [useHidden, setUseHidden] = useState<boolean>(false);
  const [componentUpdated, setComponentUpdated] = useState<number>(0);
  const [filterText, setFilterText] = useState<string[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const aggregateFieldOptions = useRef<{ key: string; label: string }[]>();
  const aggregateFunctionOptions = useRef<{ key: string; label: string }[]>();
  const featureProperties = useRef<{ [key: string]: any }[]>();

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
            return { key: key, label: `Somma "${elem.label}"` };
          })
      ];
      aggregateFunctionOptions.current = functions;
      if (!aggregationFunction) {
        setAggregationFunction(functions[0].key);
      }

      setFilterText(
        Object.entries(item.queryValues ?? {})
          .filter(([_, val]) => val.some((elem) => elem !== ""))
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
            (obj[name] ?? 0) + (functionIsCount ? 1 : val[aggregationFunction]);
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
    setComponentUpdated(componentUpdated + 1);
  };

  if (
    !QueryableCatalogItemMixin.isMixedInto(item) ||
    !item.queryProperties ||
    !aggregateFieldOptions.current ||
    !aggregateFunctionOptions.current ||
    !aggregationProperty ||
    !aggregationFunction
  ) {
    return null;
  }
  return (
    <div className={Styles.root}>
      <Box fullHeight column>
        <Box fullHeight overflow="hidden">
          <Box className={Styles.dataExplorer} styledWidth="30%">
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
          </Box>
          <Box styledWidth="70%">
            {data && (
              <QueryChart
                data={data}
                valueKey="value"
                valuePercKey="valuePerc"
                measureUnit={
                  item.queryProperties[aggregationProperty].measureUnit
                }
                decimalPlaces={
                  item.queryProperties[aggregationProperty].decimalPlaces
                }
                chartType={chartType}
                ref={canvasRef}
              />
            )}
          </Box>
        </Box>
      </Box>
    </div>
  );
});

export default QueryPanel;
