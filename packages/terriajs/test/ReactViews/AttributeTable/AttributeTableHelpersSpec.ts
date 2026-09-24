import {
  filterAttributeRows,
  sortAttributeRows
} from "../../../lib/ReactViews/AttributeTable/attributeTableRows";
import { computeRowSelection } from "../../../lib/ReactViews/AttributeTable/attributeSelection";
import {
  rowsToCsv,
  sanitizeCsvValue
} from "../../../lib/ReactViews/AttributeTable/attributeExport";
import {
  computeFieldStats,
  computeNumericStats,
  resolveStatsScope,
  statsScopeAvailability
} from "../../../lib/ReactViews/AttributeTable/attributeStats";
import {
  coerceNumericStringRows,
  computeBar,
  computeBox,
  computeHistogram,
  computePie,
  computeScatter,
  filterRowsBySelections,
  numericColumns
} from "../../../lib/ReactViews/AttributeTable/attributeCharts";
import { summarizeColumns } from "../../../lib/ReactViews/AttributeTable/columnExplorer";
import {
  calculateField,
  compileExpression
} from "../../../lib/ReactViews/AttributeTable/attributeExpression";
import {
  applyColumnAdd,
  applyColumnDelete,
  applyColumnRename,
  applyDraftsToRows,
  buildDataColumnMajorFromRows
} from "../../../lib/ReactViews/AttributeTable/attributeEditing";
import {
  applyDashboardCrossFilters,
  selectionsFromWidgets
} from "../../../lib/ReactViews/AttributeTable/attributeDashboard";
import { AttributeTableRow } from "../../../lib/ReactViews/AttributeTable/types";

describe("AttributeTable helpers", function () {
  const rows: AttributeTableRow[] = [
    { featureId: "0", rowId: 0, properties: { name: "Alpha", value: 10 } },
    { featureId: "1", rowId: 1, properties: { name: "Beta", value: 30 } },
    { featureId: "2", rowId: 2, properties: { name: "Gamma", value: 20 } }
  ];

  describe("computeRowSelection", function () {
    it("selects a single row on plain click", function () {
      const result = computeRowSelection({
        featureId: "1",
        sortedIds: ["0", "1", "2"],
        selectedIds: [],
        anchorId: null,
        additive: false,
        range: false
      });
      expect(result.ids).toEqual(["1"]);
      expect(result.anchor).toBe("1");
    });

    it("toggles with additive modifier", function () {
      const result = computeRowSelection({
        featureId: "2",
        sortedIds: ["0", "1", "2"],
        selectedIds: ["1"],
        anchorId: "1",
        additive: true,
        range: false
      });
      expect(result.ids).toEqual(["1", "2"]);
    });

    it("selects a range with shift", function () {
      const result = computeRowSelection({
        featureId: "2",
        sortedIds: ["0", "1", "2"],
        selectedIds: ["0"],
        anchorId: "0",
        additive: false,
        range: true
      });
      expect(result.ids).toEqual(["0", "1", "2"]);
      expect(result.anchor).toBe("0");
    });
  });

  describe("filter and sort", function () {
    it("filters by search text", function () {
      expect(filterAttributeRows(rows, "bet").map((r) => r.featureId)).toEqual([
        "1"
      ]);
    });

    it("sorts numeric columns", function () {
      const sorted = sortAttributeRows(rows, "value", "asc");
      expect(sorted.map((r) => r.properties.value)).toEqual([10, 20, 30]);
    });
  });

  describe("export", function () {
    it("escapes csv values", function () {
      expect(sanitizeCsvValue('a,"b"')).toBe('"a,""b"""');
    });

    it("builds csv from rows", function () {
      const csv = rowsToCsv(rows, [
        { key: "name", title: "Name", hidden: false },
        { key: "value", title: "Value", hidden: false }
      ]);
      expect(csv.split("\n")[0]).toBe("featureId,name,value");
      expect(csv).toContain("Alpha,10");
    });
  });

  describe("statistics and charts", function () {
    it("computes numeric stats", function () {
      const stats = computeNumericStats([1, 2, 3, 4]);
      expect(stats?.mean).toBe(2.5);
      expect(stats?.min).toBe(1);
      expect(stats?.max).toBe(4);
    });

    it("computes field stats for text", function () {
      const stats = computeFieldStats(
        [
          { properties: { a: "x" } },
          { properties: { a: "x" } },
          { properties: { a: "y" } }
        ],
        "a"
      );
      expect(stats?.kind).toBe("text");
      if (stats?.kind === "text") {
        expect(stats.unique).toBe(2);
      }
    });

    it("resolves stats scope", function () {
      const availability = statsScopeAvailability(rows, rows.slice(0, 2), [
        rows[0]
      ]);
      expect(availability.hasFilter).toBe(true);
      expect(resolveStatsScope("filtered", availability)).toBe("filtered");
    });

    it("coerces numeric strings and detects numeric columns", function () {
      const coerced = coerceNumericStringRows([
        { properties: { v: "1" } },
        { properties: { v: "2" } },
        { properties: { v: "3" } }
      ]);
      expect(numericColumns(coerced, ["v"])).toEqual(["v"]);
    });

    it("computes histogram, scatter, bar, pie, box", function () {
      const chartRows = coerceNumericStringRows([
        { properties: { cat: "A", v: 1, w: 2 } },
        { properties: { cat: "A", v: 3, w: 4 } },
        { properties: { cat: "B", v: 5, w: 6 } }
      ]);
      expect(computeHistogram([1, 2, 3, 4], 2)?.bins.length).toBe(2);
      expect(computeScatter(chartRows, "v", "w")?.points.length).toBe(3);
      expect(computeBar(chartRows, "cat", "count", null)?.bars.length).toBe(2);
      expect(computePie(chartRows, "cat", "count", null)?.slices.length).toBe(
        2
      );
      expect(computeBox([1, 2, 3, 4, 5])?.median).toBe(3);
    });

    it("summarizes columns", function () {
      const summaries = summarizeColumns(coerceNumericStringRows(rows), [
        "name",
        "value"
      ]);
      expect(summaries.length).toBe(2);
    });
  });

  describe("expression and editing", function () {
    it("evaluates a field expression", function () {
      const compiled = compileExpression("value * 2", ["value"]);
      expect(compiled.evaluate({ value: 5 }, 0)).toBe(10);
      const next = calculateField(rows, compiled, "double");
      expect(next[0].properties.double).toBe(20);
    });

    it("applies drafts and column ops", function () {
      const drafts = new Map([["0", new Map([["name", "Zed"]])]]);
      expect(applyDraftsToRows(rows, drafts)[0].properties.name).toBe("Zed");

      const added = applyColumnAdd(
        rows,
        [{ key: "name", title: "Name", hidden: false }],
        "newCol"
      );
      expect(added.columns.some((c) => c.key === "newCol")).toBe(true);

      const renamed = applyColumnRename(
        added.rows,
        added.columns,
        "newCol",
        "newer"
      );
      expect(renamed.columns.some((c) => c.key === "newer")).toBe(true);

      const deleted = applyColumnDelete(renamed.rows, renamed.columns, "newer");
      expect(deleted.columns.some((c) => c.key === "newer")).toBe(false);
    });

    it("builds column-major table data from edited rows", function () {
      const existing = [
        ["name", "Alpha", "Beta", "Gamma"],
        ["value", "10", "30", "20"]
      ];
      const edited = [
        { featureId: "0", rowId: 0, properties: { name: "A1", value: 11 } },
        { featureId: "1", rowId: 1, properties: { name: "B1", value: 31 } },
        { featureId: "2", rowId: 2, properties: { name: "G1", value: 21 } }
      ];
      const columns = [
        { key: "name", title: "name", hidden: false },
        { key: "value", title: "value", hidden: false }
      ];
      const built = buildDataColumnMajorFromRows(edited, columns, existing);
      expect(built).toEqual([
        ["name", "A1", "B1", "G1"],
        ["value", "11", "31", "21"]
      ]);
    });
  });

  describe("dashboard cross-filters", function () {
    it("filters rows from selector widgets", function () {
      const widgets = [
        {
          id: "1",
          type: "selector" as const,
          title: "n",
          field: "name",
          selectedValues: ["Beta"]
        }
      ];
      const selections = selectionsFromWidgets(widgets);
      const filtered = applyDashboardCrossFilters(rows, selections);
      expect(filtered.map((r) => r.featureId)).toEqual(["1"]);
    });

    it("filters by category selections", function () {
      const filtered = filterRowsBySelections(rows, [
        { field: "name", values: ["Alpha", "Gamma"] }
      ]);
      expect(filtered.length).toBe(2);
    });
  });
});
