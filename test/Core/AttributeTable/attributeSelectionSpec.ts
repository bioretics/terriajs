import { computeRowSelection } from "../../../lib/Core/AttributeTable/attributeSelection";

const sortedIds = ["a", "b", "c", "d"];

describe("computeRowSelection", function () {
  it("replaces the selection on a plain click", function () {
    expect(
      computeRowSelection({
        featureId: "c",
        sortedIds,
        selectedIds: ["a", "b"],
        anchorId: "a",
        additive: false,
        range: false
      })
    ).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("adds a row on a Ctrl click and anchors it", function () {
    expect(
      computeRowSelection({
        featureId: "c",
        sortedIds,
        selectedIds: ["a"],
        anchorId: "a",
        additive: true,
        range: false
      })
    ).toEqual({ ids: ["a", "c"], anchor: "c" });
  });

  it("removes a row on a Ctrl click and keeps a surviving anchor", function () {
    expect(
      computeRowSelection({
        featureId: "c",
        sortedIds,
        selectedIds: ["a", "c"],
        anchorId: "a",
        additive: true,
        range: false
      })
    ).toEqual({ ids: ["a"], anchor: "a" });
  });

  it("moves the anchor when the anchor itself is removed", function () {
    expect(
      computeRowSelection({
        featureId: "a",
        sortedIds,
        selectedIds: ["a", "c"],
        anchorId: "a",
        additive: true,
        range: false
      })
    ).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("selects the range from the anchor and keeps the anchor fixed", function () {
    expect(
      computeRowSelection({
        featureId: "d",
        sortedIds,
        selectedIds: ["b"],
        anchorId: "b",
        additive: false,
        range: true
      })
    ).toEqual({ ids: ["b", "c", "d"], anchor: "b" });
  });

  it("selects the range backwards too", function () {
    expect(
      computeRowSelection({
        featureId: "a",
        sortedIds,
        selectedIds: ["c"],
        anchorId: "c",
        additive: false,
        range: true
      })
    ).toEqual({ ids: ["a", "b", "c"], anchor: "c" });
  });

  it("merges the range with the selection when Ctrl is also held", function () {
    expect(
      computeRowSelection({
        featureId: "b",
        sortedIds,
        selectedIds: ["d"],
        anchorId: "a",
        additive: true,
        range: true
      })
    ).toEqual({ ids: ["d", "a", "b"], anchor: "a" });
  });

  it("falls back to a single select without a usable anchor", function () {
    expect(
      computeRowSelection({
        featureId: "b",
        sortedIds,
        selectedIds: [],
        anchorId: undefined,
        additive: false,
        range: true
      })
    ).toEqual({ ids: ["b"], anchor: "b" });
  });
});
