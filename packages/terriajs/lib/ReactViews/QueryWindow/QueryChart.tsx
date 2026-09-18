import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Tooltip,
  Cell,
  BarChart,
  CartesianGrid,
  Bar,
  XAxis,
  YAxis
} from "recharts";
import { ChartType } from "./QueryTabAggregation";
import Box from "../../Styled/Box";
import StandardCssColors from "../../Core/StandardCssColors";
import { RECHARTS_DEFAULT_FILL } from "../../Core/DefaultVisualStyles";

const COLORS = StandardCssColors.queryChartSeries;

export interface DataType {
  name: string;
  value: number;
  valuePerc: number;
}

interface PropsType {
  data: DataType[];
  valueKey: string;
  valuePercKey: string;
  measureUnit?: string;
  decimalPlaces: number;
  chartType: ChartType;
  randomNumber: number;
  filterText: string[];
  useHidden: boolean;
}

const QueryChart = React.forwardRef<HTMLDivElement, PropsType>(
  (
    {
      data,
      valueKey,
      valuePercKey,
      measureUnit,
      decimalPlaces,
      chartType,
      randomNumber,
      filterText,
      useHidden
    },
    ref
  ) => {
    const currencyFormatter = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      notation: "compact"
    });

    const formatCurrency = (value: number) => {
      return currencyFormatter
        .format(value)
        .replace("Mio", "Mln")
        .replace("Mrd", "Mld");
    };

    const randomIndex = Math.floor(randomNumber * COLORS.length);

    const renderPieChart = () => {
      const dataPurged = data.filter((elem) => elem.valuePerc > 0);
      return (
        <PieChart
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5
          }}
        >
          <Pie
            isAnimationActive={false}
            dataKey={valuePercKey}
            data={dataPurged}
            fill={RECHARTS_DEFAULT_FILL}
            labelLine={false}
            label={(elem: any) => {
              const val = elem[valuePercKey];
              return val > 1 ? `${val}%` : "";
            }}
          >
            {dataPurged?.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[(index + randomIndex) % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, _: string, props: any) => {
              try {
                const { payload: outerPayload } = props || {};
                const { payload: innerPayload } = outerPayload || {};

                if (
                  innerPayload &&
                  typeof innerPayload === "object" &&
                  valueKey in innerPayload
                ) {
                  const dataValue = innerPayload[valueKey];
                  if (
                    dataValue !== undefined &&
                    dataValue !== null &&
                    !isNaN(Number(dataValue))
                  ) {
                    return `${v}% (${
                      measureUnit === "€"
                        ? formatCurrency(Number(dataValue))
                        : Number(dataValue).toFixed(decimalPlaces)
                    })`;
                  }
                }
              } catch (error) {
                console.warn("Error formatting tooltip:", error);
              }

              return `${v}%`;
            }}
          />
          {dataPurged.length <= 20 && (
            <Legend wrapperStyle={{ fontSize: "14px" }} />
          )}
        </PieChart>
      );
    };

    const renderBarVChart = () => {
      const xLabelsHeight = Math.min(
        Math.max(...data.map((elem) => elem.name.length)) * 3 + 80,
        220
      );
      return (
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: 40,
            bottom: 5
          }}
        >
          <XAxis
            dataKey="name"
            height={xLabelsHeight}
            angle={90}
            textAnchor="start"
            style={{ fontSize: "0.8rem" }}
          />
          <YAxis
            type="number"
            tickFormatter={(v: number) => {
              return measureUnit === "€"
                ? `${formatCurrency(v)}`
                : v.toFixed(decimalPlaces);
            }}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip
            formatter={(v: number) => {
              return measureUnit === "€"
                ? `${formatCurrency(v)}`
                : v.toFixed(decimalPlaces);
            }}
          />
          <Bar dataKey={valueKey} barSize={20} fill={COLORS[randomIndex]}>
            {data?.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[(index + randomIndex) % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      );
    };

    const renderBarHChart = () => {
      return (
        <BarChart
          layout="vertical"
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: 20,
            bottom: 5
          }}
        >
          <YAxis
            dataKey="name"
            type="category"
            textAnchor="start"
            scale="band"
            tickMargin={-15}
            width={5}
            tick={{ width: 260 }}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) => {
              return measureUnit === "€"
                ? `${formatCurrency(v)}`
                : v.toFixed(decimalPlaces);
            }}
          />
          <Tooltip
            formatter={(v: number) => {
              return measureUnit === "€"
                ? `${formatCurrency(v)}`
                : v.toFixed(decimalPlaces);
            }}
          />
          <Bar dataKey={valueKey} barSize={5} fill={COLORS[randomIndex]}>
            {data?.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[(index + randomIndex) % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      );
    };

    const renderChart = () => {
      switch (chartType) {
        case ChartType.BarV:
          return renderBarVChart();
        case ChartType.BarH:
          return renderBarHChart();
        default:
          return renderPieChart();
      }
    };

    const showFilters = filterText.length > 0 && !useHidden;

    return (
      <div style={{ width: "100%", height: "100%" }} ref={ref}>
        <Box fullHeight column>
          <Box fullHeight overflow="hidden">
            <Box styledWidth={showFilters ? "80%" : "100%"}>
              <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
            </Box>
            {showFilters && (
              <Box
                styledWidth="20%"
                flexWrap
                style={{ alignContent: "center" }}
              >
                <div>
                  Filtri applicati:
                  {filterText.map((txt, index) => (
                    <div key={index}>&#x2022; {txt}</div>
                  ))}
                </div>
              </Box>
            )}
          </Box>
        </Box>
      </div>
    );
  }
);

QueryChart.displayName = "QueryChart";

export default QueryChart;
