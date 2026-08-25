export type ViewshedTerrainStatus = "computing" | "ready" | "unavailable";

/** UI state for the active two-point Viewshed3D interaction. */
export interface Viewshed3DState {
  observerHeight: number;
  maximumDistance: number;
  terrainStatus: ViewshedTerrainStatus;
  showBorder: boolean;
  showLine: boolean;
}

export function createViewshed3DState(
  maximumDistance: number
): Viewshed3DState {
  return {
    observerHeight: 0,
    maximumDistance,
    terrainStatus: "computing",
    showBorder: true,
    showLine: true
  };
}
