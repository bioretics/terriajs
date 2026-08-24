import {
  DEFAULT_VIEWSHED_HORIZONTAL_FOV,
  DEFAULT_VIEWSHED_VERTICAL_FOV
} from "../Map/Cesium/Viewshed3D";

export type ViewshedTerrainStatus =
  | "updating"
  | "currentTerrain"
  | "unavailable";

/** UI state for the active two-point Viewshed3D interaction. */
export interface Viewshed3DState {
  observerHeight: number;
  targetHeight: number;
  horizontalFov: number;
  verticalFov: number;
  maximumDistance: number;
  showDebug: boolean;
  terrainStatus: ViewshedTerrainStatus;
  terrainTileLoadCount: number;
}

export function createViewshed3DState(
  maximumDistance: number
): Viewshed3DState {
  return {
    observerHeight: 0,
    targetHeight: 0,
    horizontalFov: DEFAULT_VIEWSHED_HORIZONTAL_FOV,
    verticalFov: DEFAULT_VIEWSHED_VERTICAL_FOV,
    maximumDistance,
    showDebug: false,
    terrainStatus: "updating",
    terrainTileLoadCount: 0
  };
}
