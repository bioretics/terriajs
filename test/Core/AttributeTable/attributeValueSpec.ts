import { type ChartRow } from "../../../lib/Core/AttributeTable/attributeCharts";
import { computeTextStats } from "../../../lib/Core/AttributeTable/attributeStats";
import { formatAttributeValue } from "../../../lib/Core/AttributeTable/attributeValue";

describe("formatAttributeValue", function () {
  it("renders primitives as themselves and nullish as empty", function () {
    expect(formatAttributeValue("x")).toBe("x");
    expect(formatAttributeValue(3.5)).toBe("3.5");
    expect(formatAttributeValue(false)).toBe("false");
    expect(formatAttributeValue(null)).toBe("");
    expect(formatAttributeValue(undefined)).toBe("");
  });

  it("stringifies objects and arrays as JSON", function () {
    expect(formatAttributeValue({ a: 1 })).toBe('{"a":1}');
    expect(formatAttributeValue([1, 2])).toBe("[1,2]");
  });

  it("falls back to String for a value JSON cannot render", function () {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(formatAttributeValue(cyclic)).toBe("[object Object]");
  });

  it("is what the statistics count distinct values by", function () {
    const rows: ChartRow[] = [
      { properties: { attributi: { a: 1 } } },
      { properties: { attributi: { b: 2 } } },
      { properties: { attributi: { a: 1 } } }
    ];
    const stats = computeTextStats(rows, "attributi");
    // Two distinct objects, not one bucket of "[object Object]".
    expect(stats.unique).toBe(2);
    expect(stats.top[0]).toEqual({ value: '{"a":1}', count: 2 });
  });
});
