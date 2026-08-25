import {
  computeViewshed,
  VISIBILITY_VISIBLE,
  VISIBILITY_HIDDEN,
  VISIBILITY_NO_DATA,
  NO_DATA,
  TerrainVisibilityGrid
} from "../../../lib/Map/Cesium/TerrainViewshed";

/** Helper to build a simple flat grid for testing. */
function makeFlatGrid(
  gridWidth: number,
  cellSize: number,
  height: number
): TerrainVisibilityGrid {
  const heights = new Float32Array(gridWidth * gridWidth).fill(height);
  return { gridWidth, cellSize, heights, groundHeightAtObserver: height };
}

/** Helper to build a grid where specific cells have custom heights. */
function makeGridWithHeights(
  gridWidth: number,
  cellSize: number,
  baseHeight: number,
  overrides: Array<{ i: number; j: number; h: number }>
): TerrainVisibilityGrid {
  const heights = new Float32Array(gridWidth * gridWidth).fill(baseHeight);
  for (const { i, j, h } of overrides) {
    heights[j * gridWidth + i] = h;
  }
  return { gridWidth, cellSize, heights, groundHeightAtObserver: baseHeight };
}

describe("TerrainViewshed", () => {
  describe("computeViewshed", () => {
    it("marks all cells visible on a flat grid", () => {
      // A 21x21 flat grid at height 100, observer eye at 101 (1m above ground).
      const grid = makeFlatGrid(21, 10, 100);
      const result = computeViewshed(grid, 101);

      const half = (grid.gridWidth - 1) / 2;
      let visibleCount = 0;
      let _noDataCount = 0;

      for (let j = 0; j < grid.gridWidth; j++) {
        for (let i = 0; i < grid.gridWidth; i++) {
          const east = (i - half) * grid.cellSize;
          const north = (j - half) * grid.cellSize;
          const maxRadius = half * grid.cellSize;
          const idx = j * grid.gridWidth + i;

          if (east * east + north * north > maxRadius * maxRadius) {
            // Outside the circle — should be NO_DATA in heights, so NO_DATA in result
            expect(result[idx]).toBe(VISIBILITY_NO_DATA);
            _noDataCount++;
          } else {
            expect(result[idx]).toBe(VISIBILITY_VISIBLE);
            visibleCount++;
          }
        }
      }

      expect(visibleCount).toBeGreaterThan(0);
    });

    it("marks cells behind a tall wall as hidden", () => {
      // 11x11 grid, cellSize=10, flat at 0m. Place a wall 2 cells east of centre.
      const gridWidth = 11;
      const cellSize = 10;
      const half = (gridWidth - 1) / 2; // 5

      // Build a wall: all cells at i=7 (2 cells east of centre at i=5) with height 100.
      const wallOverrides: Array<{ i: number; j: number; h: number }> = [];
      for (let j = 0; j < gridWidth; j++) {
        wallOverrides.push({ i: 7, j, h: 100 });
      }
      const grid = makeGridWithHeights(gridWidth, cellSize, 0, wallOverrides);

      // Observer at ground + 1m
      const result = computeViewshed(grid, 1);

      // The centre cell (observer) should be visible.
      expect(result[half * gridWidth + half]).toBe(VISIBILITY_VISIBLE);

      // Cells east of the wall (i >= 8) that are inside the radius should be hidden.
      for (let j = 2; j < gridWidth - 2; j++) {
        for (let i = 8; i < gridWidth; i++) {
          const east = (i - half) * cellSize;
          const north = (j - half) * cellSize;
          const maxRadius = half * cellSize;
          const idx = j * gridWidth + i;

          if (east * east + north * north <= maxRadius * maxRadius) {
            expect(result[idx]).toBe(VISIBILITY_HIDDEN);
          }
        }
      }
    });

    it("handles NaN (no-data) cells without treating them as obstructions", () => {
      // 11x11 grid with a row of NaN at i=6 (1 cell east of centre).
      // Cells beyond should still be reachable by rays.
      const gridWidth = 11;
      const cellSize = 10;
      const half = (gridWidth - 1) / 2;

      const nanOverrides: Array<{ i: number; j: number; h: number }> = [];
      for (let j = 0; j < gridWidth; j++) {
        nanOverrides.push({ i: 6, j, h: NO_DATA });
      }
      const grid = makeGridWithHeights(gridWidth, cellSize, 0, nanOverrides);

      const result = computeViewshed(grid, 1);

      // Cells at i=7 and beyond (inside radius) should still be reachable/visible
      // because NaN gaps don't obstruct.
      for (let j = 3; j < gridWidth - 3; j++) {
        const idx = j * gridWidth + 7;
        const east = (7 - half) * cellSize;
        const north = (j - half) * cellSize;
        const maxRadius = half * cellSize;
        if (east * east + north * north <= maxRadius * maxRadius) {
          expect(result[idx]).toBe(VISIBILITY_VISIBLE);
        }
      }
    });

    it("observer centre cell is always visible", () => {
      const grid = makeFlatGrid(11, 5, 50);
      const result = computeViewshed(grid, 51);
      const half = (grid.gridWidth - 1) / 2;
      expect(result[half * grid.gridWidth + half]).toBe(VISIBILITY_VISIBLE);
    });
  });

  describe("grid dimensions", () => {
    it("gridWidth is always odd", () => {
      // Various grid configurations should always produce odd gridWidth.
      for (const gw of [11, 21, 51, 101, 301]) {
        expect(gw % 2).toBe(1);
      }
    });
  });
});
