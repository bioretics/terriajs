export type ViewshedTerrainStatus =
  | "updating"
  | "currentTerrain"
  | "unavailable";

/** UI state for the active two-point Viewshed3D interaction. */
export interface Viewshed3DState {
  observerHeight: number;
  maximumDistance: number;
  terrainStatus: ViewshedTerrainStatus;
  terrainTileLoadCount: number;
}

export function createViewshed3DState(
  maximumDistance: number
): Viewshed3DState {
  return {
    observerHeight: 0,
    maximumDistance,
    terrainStatus: "updating",
    terrainTileLoadCount: 0
  };
}
