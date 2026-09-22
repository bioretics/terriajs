import {
  categoricalColumns,
  coerceNumericStringRows,
  computeBar,
  computeBox,
  computeHistogram,
  computeLine,
  computePie,
  computeScatter,
  formatAxisValue,
  numericColumns,
  numericValues,
  pickAnalysisRows,
  toFiniteNumber,
  type ChartRow
} from "../../../lib/Core/AttributeTable/attributeCharts";

const rows = (properties: Record<string, unknown>[]): ChartRow[] =>
  properties.map((p) => ({ properties: p }));

describe("attributeCharts", function () {
  describe("toFiniteNumber", function () {
    it("accepts numbers and numeric strings", function () {
      expect(toFiniteNumber(42)).toBe(42);
      expect(toFiniteNumber(" 3.5 ")).toBe(3.5);
    });

    it("rejects anything that is not a finite number", function () {
      expect(toFiniteNumber("")).toBeUndefined();
      expect(toFiniteNumber("abc")).toBeUndefined();
      expect(toFiniteNumber(true)).toBeUndefined();
      expect(toFiniteNumber(NaN)).toBeUndefined();
      expect(toFiniteNumber(null)).toBeUndefined();
    });
  });

  describe("coerceNumericStringRows", function () {
    it("converts a column whose values are mostly numeric strings", function () {
      const result = coerceNumericStringRows(
        rows([{ quota: "10" }, { quota: "20.5" }, { quota: "" }])
      );
      expect(result[0].properties.quota).toBe(10);
      expect(result[1].properties.quota).toBe(20.5);
    });

    it("keeps identifier-like columns as text", function () {
      const result = coerceNumericStringRows(
        rows([{ ISTAT_COM: "040012" }, { ISTAT_COM: "040007" }])
      );
      expect(result[0].properties.ISTAT_COM).toBe("040012");
    });

    it("keeps a mostly textual column verbatim", function () {
      const result = coerceNumericStringRows(
        rows([{ nome: "Forli" }, { nome: "Cesena" }, { nome: "3.0" }])
      );
      expect(result[2].properties.nome).toBe("3.0");
    });
  });

  describe("pickAnalysisRows", function () {
    it("keeps the rows of the named features, in layer order", function () {
      const source = [
        { featureId: "0" },
        { featureId: "1" },
        { featureId: "2" }
      ];
      const analysis = rows([{ a: 1 }, { a: 2 }, { a: 3 }]);
      const picked = pickAnalysisRows(analysis, source, new Set(["2", "0"]));
      expect(picked.length).toBe(2);
      expect(picked[0].properties.a).toBe(1);
      expect(picked[1].properties.a).toBe(3);
    });
  });

  describe("numericColumns", function () {
    it("only offers columns that are mostly finite numbers", function () {
      const data = rows([
        { quota: 10, nome: "a" },
        { quota: 20, nome: "b" },
        { quota: 30, nome: "c" }
      ]);
      expect(numericColumns(data, ["quota", "nome"])).toEqual(["quota"]);
    });

    it("ignores columns with a single numeric value", function () {
      const data = rows([{ q: 10 }, { q: "x" }, { q: "y" }]);
      expect(numericColumns(data, ["q"])).toEqual([]);
    });
  });

  describe("numericValues", function () {
    it("skips non-numeric cells", function () {
      const data = rows([{ q: 1 }, { q: "x" }, { q: 3 }]);
      expect(numericValues(data, "q")).toEqual([1, 3]);
    });
  });

  describe("computeHistogram", function () {
    it("returns undefined without values", function () {
      expect(computeHistogram([], 10)).toBeUndefined();
    });

    it("bins values into equal-width buckets, maximum in the last bin", function () {
      const result = computeHistogram([0, 1, 2, 3, 4], 2);
      expect(result?.bins.length).toBe(2);
      expect(result?.bins[0].count).toBe(2);
      expect(result?.bins[1].count).toBe(3);
      expect(result?.maxCount).toBe(3);
      expect(result?.total).toBe(5);
    });

    it("returns a single bin when every value is identical", function () {
      const result = computeHistogram([7, 7, 7], 10);
      expect(result?.bins.length).toBe(1);
      expect(result?.bins[0].count).toBe(3);
    });

    it("clamps the requested bin count", function () {
      expect(computeHistogram([1, 2, 3], 0)?.bins.length).toBe(1);
      expect(computeHistogram([1, 2, 3], 999)?.bins.length).toBe(50);
    });
  });

  describe("computeScatter", function () {
    it("keeps only the pairs where both fields are numeric", function () {
      const data = rows([
        { x: 1, y: 2 },
        { x: "a", y: 3 },
        { x: 5, y: 6 }
      ]);
      const result = computeScatter(data, "x", "y");
      expect(result?.total).toBe(2);
      expect(result?.xMin).toBe(1);
      expect(result?.xMax).toBe(5);
    });

    it("strides evenly when capped", function () {
      const data = rows(new Array(10).fill(0).map((_v, i) => ({ x: i, y: i })));
      const result = computeScatter(data, "x", "y", 5);
      expect(result?.total).toBe(10);
      expect(result?.points.length).toBe(5);
      expect(result?.points[1].x).toBe(2);
    });
  });

  describe("computeBar", function () {
    it("counts rows per category, sorted descending", function () {
      const data = rows([
        { dominio: "Monte" },
        { dominio: "Monte" },
        { dominio: "Poggio" }
      ]);
      const result = computeBar(data, "dominio", "count", undefined);
      expect(result?.bars[0]).toEqual({ label: "Monte", value: 2, count: 2 });
      expect(result?.bars[1].label).toBe("Poggio");
    });

    it("drops categories with no numeric samples when aggregating", function () {
      const data = rows([
        { c: "a", v: 10 },
        { c: "b", v: "x" }
      ]);
      const result = computeBar(data, "c", "sum", "v");
      expect(result?.bars.length).toBe(1);
      expect(result?.bars[0].label).toBe("a");
    });

    it("buckets blank categories", function () {
      const result = computeBar(rows([{ c: "" }]), "c", "count", undefined);
      expect(result?.bars[0].label).toBe("(blank)");
    });
  });

  describe("computePie", function () {
    it("folds the tail into a single other slice", function () {
      const data = rows(new Array(10).fill(0).map((_v, i) => ({ c: `c${i}` })));
      const result = computePie(data, "c", "count", undefined, 3);
      expect(result?.slices.length).toBe(3);
      expect(result?.slices[2].label).toBe("(other)");
      expect(result?.otherCount).toBe(8);
    });

    it("returns undefined when nothing is positive", function () {
      const data = rows([{ c: "a", v: -1 }]);
      expect(computePie(data, "c", "sum", "v")).toBeUndefined();
    });
  });

  describe("computeLine", function () {
    it("keeps the original row index of each point", function () {
      const data = rows([{ q: 1 }, { q: "x" }, { q: 3 }]);
      const result = computeLine(data, "q");
      expect(result?.points).toEqual([
        { index: 0, value: 1 },
        { index: 2, value: 3 }
      ]);
      expect(result?.length).toBe(3);
    });
  });

  describe("computeBox", function () {
    it("computes a five-number summary", function () {
      const result = computeBox([1, 2, 3, 4]);
      expect(result?.min).toBe(1);
      expect(result?.median).toBe(2.5);
      expect(result?.max).toBe(4);
      expect(result?.count).toBe(4);
    });
  });

  describe("categoricalColumns", function () {
    it("rejects a column that is unique per row", function () {
      const data = rows([{ id: "a" }, { id: "b" }, { id: "c" }]);
      expect(categoricalColumns(data, ["id"])).toEqual([]);
    });

    it("accepts a repeating enumeration", function () {
      const data = rows([{ c: "x" }, { c: "y" }, { c: "x" }]);
      expect(categoricalColumns(data, ["c"])).toEqual(["c"]);
    });
  });

  describe("formatAxisValue", function () {
    it("keeps integers short and trims decimals", function () {
      expect(formatAxisValue(1200)).toBe("1200");
      expect(formatAxisValue(1.23456)).toBe("1.235");
      expect(formatAxisValue(1e9)).toBe("1.0e+9");
    });
  });
});
