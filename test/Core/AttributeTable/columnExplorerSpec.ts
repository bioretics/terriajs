import { type ChartRow } from "../../../lib/Core/AttributeTable/attributeCharts";
import {
  populatedCount,
  summarizeColumn,
  summarizeColumns
} from "../../../lib/Core/AttributeTable/columnExplorer";

const rows = (properties: Record<string, unknown>[]): ChartRow[] =>
  properties.map((p) => ({ properties: p }));

describe("columnExplorer", function () {
  it("summarizes a numeric column with a distribution", function () {
    const summary = summarizeColumn(
      rows([{ q: 1 }, { q: 2 }, { q: 3 }, { q: null }]),
      "q"
    );
    expect(summary?.stats.kind).toBe("numeric");
    expect(summary?.stats.nulls).toBe(1);
    expect(summary?.total).toBe(4);
    expect(summary?.histogram?.total).toBe(3);
  });

  it("summarizes a text column with its top values and no distribution", function () {
    const summary = summarizeColumn(
      rows([{ d: "Monte" }, { d: "Monte" }, { d: "Poggio" }]),
      "d"
    );
    expect(summary?.stats.kind).toBe("text");
    expect(summary?.histogram).toBeUndefined();
  });

  it("counts a whitespace-only value as populated but not numeric", function () {
    const summary = summarizeColumn(
      rows([{ q: 1 }, { q: 2 }, { q: "  " }, { q: "  " }, { q: "  " }]),
      "q"
    );
    // Three blank-but-populated rows outweigh the two numbers, so the column
    // reads as text rather than as a numeric column with three nulls.
    expect(summary?.stats.kind).toBe("text");
  });

  it("keeps the given column order", function () {
    const summaries = summarizeColumns(rows([{ a: 1, b: "x" }]), ["b", "a"]);
    expect(summaries.map((s) => s.key)).toEqual(["b", "a"]);
  });

  it("reports how many rows hold a value", function () {
    const summary = summarizeColumn(rows([{ d: "x" }, { d: null }]), "d");
    expect(summary && populatedCount(summary)).toBe(1);
  });
});
