import { type ChartRow } from "../../../lib/ReactViews/AttributeTable/attributeCharts";
import {
  chartResultHasData,
  computeChart
} from "../../../lib/ReactViews/AttributeTable/chartSpec";

const rows: ChartRow[] = [
  { properties: { quota: 10, dominio: "Monte", nome: "a" } },
  { properties: { quota: 20, dominio: "Monte", nome: "b" } },
  { properties: { quota: 30, dominio: "Poggio", nome: "c" } }
];

describe("computeChart", function () {
  it("bins a histogram of the chosen field", function () {
    const result = computeChart(rows, {
      type: "histogram",
      field: "quota",
      bins: 2
    });
    expect(result.type).toBe("histogram");
    expect(chartResultHasData(result)).toBe(true);
    if (result.type === "histogram") {
      expect(result.result?.total).toBe(3);
      expect(result.result?.bins.length).toBe(2);
    }
  });

  it("has no data when the spec names no field", function () {
    const result = computeChart(rows, { type: "histogram" });
    expect(chartResultHasData(result)).toBe(false);
  });

  it("counts rows per category for a bar chart", function () {
    const result = computeChart(rows, {
      type: "bar",
      category: "dominio",
      aggregation: "count"
    });
    if (result.type === "bar") {
      expect(result.result?.bars[0]).toEqual({
        label: "Monte",
        value: 2,
        count: 2
      });
    }
  });

  it("ignores the value field when the aggregation is a count", function () {
    const result = computeChart(rows, {
      type: "pie",
      category: "dominio",
      aggregation: "count",
      valueField: "quota"
    });
    if (result.type === "pie") {
      expect(result.result?.total).toBe(3);
    }
  });

  it("reduces the value field when the aggregation is a sum", function () {
    const result = computeChart(rows, {
      type: "bar",
      category: "dominio",
      aggregation: "sum",
      valueField: "quota"
    });
    if (result.type === "bar") {
      expect(result.result?.bars[0].value).toBe(30);
    }
  });

  it("needs both fields for a scatter plot", function () {
    expect(
      chartResultHasData(
        computeChart(rows, { type: "scatter", xField: "quota" })
      )
    ).toBe(false);
  });
});
