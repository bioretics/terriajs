import { compareAttributeValues } from "../../../lib/Core/AttributeTable/attributeSort";

describe("compareAttributeValues", function () {
  it("sorts empty cells first", function () {
    expect(compareAttributeValues(null, "a")).toBeLessThan(0);
    expect(compareAttributeValues("a", undefined)).toBeGreaterThan(0);
    expect(compareAttributeValues("", null)).toBe(0);
  });

  it("compares numbers numerically", function () {
    expect(compareAttributeValues(9, 10)).toBeLessThan(0);
  });

  it("compares numbers stored as text numerically", function () {
    expect(compareAttributeValues("9", "10")).toBeLessThan(0);
  });

  it("compares text case-insensitively and naturally", function () {
    expect(compareAttributeValues("via 2", "Via 10")).toBeLessThan(0);
    expect(compareAttributeValues("Cesena", "cesena")).toBe(0);
  });

  it("keeps a zero cell ahead of a bigger one rather than treating it as empty", function () {
    expect(compareAttributeValues(0, 5)).toBeLessThan(0);
  });
});
