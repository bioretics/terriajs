import { type ChartRow } from "../../../lib/Core/AttributeTable/attributeCharts";
import {
  computeFieldStats,
  computeNumericStats,
  computeTextStats,
  formatStatValue,
  isBlank,
  resolveStatsScope,
  statsScopeAvailability
} from "../../../lib/Core/AttributeTable/attributeStats";

const rows = (properties: Record<string, unknown>[]): ChartRow[] =>
  properties.map((p) => ({ properties: p }));

describe("attributeStats", function () {
  describe("isBlank", function () {
    it("treats nullish and whitespace-only strings as blank", function () {
      expect(isBlank(null)).toBe(true);
      expect(isBlank(undefined)).toBe(true);
      expect(isBlank("   ")).toBe(true);
      expect(isBlank(0)).toBe(false);
    });
  });

  describe("computeNumericStats", function () {
    it("returns undefined without values", function () {
      expect(computeNumericStats([])).toBeUndefined();
    });

    it("summarizes a sample", function () {
      const stats = computeNumericStats([2, 4, 4, 4, 5, 5, 7, 9], 1, 2);
      expect(stats?.count).toBe(8);
      expect(stats?.nulls).toBe(1);
      expect(stats?.nonNumeric).toBe(2);
      expect(stats?.unique).toBe(5);
      expect(stats?.min).toBe(2);
      expect(stats?.max).toBe(9);
      expect(stats?.mean).toBe(5);
      expect(stats?.median).toBe(4.5);
      expect(stats?.sum).toBe(40);
      // Sample standard deviation (n - 1), not the population one (2).
      expect(stats?.std).toBeCloseTo(2.138, 3);
    });

    it("reports a zero standard deviation for a single value", function () {
      expect(computeNumericStats([3])?.std).toBe(0);
    });
  });

  describe("computeTextStats", function () {
    it("counts populated, null, unique and most frequent values", function () {
      const stats = computeTextStats(
        rows([
          { d: "Monte" },
          { d: "Monte" },
          { d: "Poggio" },
          { d: "  " },
          { d: null }
        ]),
        "d"
      );
      expect(stats.count).toBe(3);
      expect(stats.nulls).toBe(2);
      expect(stats.unique).toBe(2);
      expect(stats.top[0]).toEqual({ value: "Monte", count: 2 });
    });

    it("breaks ties alphabetically", function () {
      const stats = computeTextStats(rows([{ d: "b" }, { d: "a" }]), "d");
      expect(stats.top.map((t) => t.value)).toEqual(["a", "b"]);
    });
  });

  describe("computeFieldStats", function () {
    it("summarizes a numeric field as numeric", function () {
      const stats = computeFieldStats(rows([{ q: 1 }, { q: 2 }]), "q");
      expect(stats?.kind).toBe("numeric");
    });

    it("keeps numeric-looking strings as text", function () {
      const stats = computeFieldStats(rows([{ q: "1" }, { q: "2" }]), "q");
      expect(stats?.kind).toBe("text");
    });
  });

  describe("statsScopeAvailability", function () {
    const all = rows([{ a: 1 }, { a: 2 }, { a: 3 }]);

    it("offers no narrowed scope when nothing narrows the layer", function () {
      expect(statsScopeAvailability(all, all, [])).toEqual({
        hasFilter: false,
        hasSelection: false
      });
    });

    it("offers the filter when it narrows the layer", function () {
      expect(statsScopeAvailability(all, [all[0]], []).hasFilter).toBe(true);
    });

    it("does not offer the same population twice", function () {
      const selection = [all[1]];
      const availability = statsScopeAvailability(all, selection, selection);
      expect(availability.hasFilter).toBe(false);
      expect(availability.hasSelection).toBe(true);
    });
  });

  describe("resolveStatsScope", function () {
    it("keeps a scope that is still offered", function () {
      expect(
        resolveStatsScope("filtered", { hasFilter: true, hasSelection: false })
      ).toBe("filtered");
    });

    it("falls back to the other narrowed scope", function () {
      expect(
        resolveStatsScope("filtered", { hasFilter: false, hasSelection: true })
      ).toBe("selected");
    });

    it("falls back to all when neither narrows the layer", function () {
      expect(
        resolveStatsScope("selected", { hasFilter: false, hasSelection: false })
      ).toBe("all");
    });
  });

  describe("formatStatValue", function () {
    it("formats integers, decimals and extreme magnitudes", function () {
      expect(formatStatValue(42)).toBe((42).toLocaleString());
      expect(formatStatValue(1.23456789)).toBe(
        (1.2346).toLocaleString(undefined, { maximumFractionDigits: 4 })
      );
      expect(formatStatValue(1e10 + 0.5)).toBe("1.000e+10");
      expect(formatStatValue(NaN)).toBe("-");
    });
  });
});
