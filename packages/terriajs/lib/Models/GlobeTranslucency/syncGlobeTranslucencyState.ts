import { autorun, IReactionDisposer, reaction } from "mobx";
import Color from "terriajs-cesium/Source/Core/Color";
import NearFarScalar from "terriajs-cesium/Source/Core/NearFarScalar";
import type Cesium from "../Cesium";
import hasTraits from "../Definition/hasTraits";
import Terria from "../Terria";
import OpacityTraits from "../../Traits/TraitsClasses/OpacityTraits";
import TerriaViewer from "../../ViewModels/TerriaViewer";

/** Shown where the globe has no imagery yet; matches Cesium.ts globe base colour. */
const GLOBE_BASE_COLOR = Color.fromCssColorString("#22364d");

function clampUnitOpacity(opacityValue: number): number {
  if (opacityValue < 0) {
    return 0;
  }
  if (opacityValue > 1 || isNaN(opacityValue)) {
    return 1;
  }
  return opacityValue;
}

/** Same rules as `Cesium` base map opacity computation (trait default is 0.8). */
function getExplicitBaseMapOpacity(terriaViewer: TerriaViewer): number {
  const baseMap = terriaViewer.baseMap;
  if (baseMap === undefined || !hasTraits(baseMap, OpacityTraits, "opacity")) {
    return 1.0;
  }

  const explicitOpacity: number | undefined =
    OpacityTraits.traits.opacity.getValue(baseMap);
  return explicitOpacity ?? 1.0;
}

function isDistanceBasedGlobeTranslucencyActive(terria: Terria): boolean {
  return (
    !!terria.configParameters.globeTranslucency &&
    terria.globeTranslucencyEnabled
  );
}

/** Cesium's JS API accepts `undefined` here; terriajs-cesium typings do not. */
function disableGlobeTranslucencyByDistance(translucency: {
  frontFaceAlphaByDistance: NearFarScalar;
}): void {
  (
    translucency as {
      frontFaceAlphaByDistance: NearFarScalar | undefined;
    }
  ).frontFaceAlphaByDistance = undefined;
}

function opaqueGlobeBaseColor(terria: Terria): Color {
  return terria.progressiveLoading ? GLOBE_BASE_COLOR : Color.BLUE;
}

function syncGlobeTranslucencyState(cesium: Cesium): void {
  const terria = cesium.terria;
  const globe = cesium.scene.globe;
  const baseMapOpacity = clampUnitOpacity(
    getExplicitBaseMapOpacity(cesium.terriaViewer)
  );
  const terrainOpacity = clampUnitOpacity(terria.terrainOpacity);
  const distanceTranslucencyActive =
    isDistanceBasedGlobeTranslucencyActive(terria);
  const baseMapTranslucent = baseMapOpacity < 1;
  const terrainTranslucent = terrainOpacity < 1;

  const needsTranslucency =
    baseMapTranslucent || terrainTranslucent || distanceTranslucencyActive;

  if (!needsTranslucency) {
    globe.showGroundAtmosphere = true;
    globe.undergroundColor = Color.BLACK;
    globe.translucency.enabled = false;
    globe.translucency.frontFaceAlpha = 1.0;
    globe.translucency.backFaceAlpha = 1.0;
    disableGlobeTranslucencyByDistance(globe.translucency);
    globe.baseColor = opaqueGlobeBaseColor(terria);
    return;
  }

  globe.translucency.enabled = true;

  // Basemap imagery opacity uses a transparent globe shell (see Cesium
  // updateSceneOpacitySettings). Terrain-only opacity must not: a transparent
  // shell plus default backFaceAlpha reveals the opposite hemisphere ("twisted"
  // antipodal imagery).
  if (baseMapTranslucent) {
    globe.showGroundAtmosphere = false;
    globe.undergroundColor = Color.BLACK.withAlpha(0);
    globe.baseColor = Color.TRANSPARENT;
  } else {
    globe.showGroundAtmosphere = true;
    globe.undergroundColor = Color.BLACK;
    globe.baseColor = opaqueGlobeBaseColor(terria);
  }

  if (distanceTranslucencyActive) {
    const cfg = terria.configParameters.globeTranslucency!;
    globe.translucency.frontFaceAlphaByDistance = new NearFarScalar(
      cfg.nearDistance,
      cfg.nearTranslucency,
      cfg.farDistance,
      cfg.farTranslucency
    );
  } else {
    disableGlobeTranslucencyByDistance(globe.translucency);
    globe.translucency.frontFaceAlpha = terrainTranslucent
      ? terrainOpacity
      : 1.0;
  }

  globe.translucency.backFaceAlpha =
    terrainTranslucent && !baseMapTranslucent ? 0 : 1.0;
}

/**
 * Keeps globe translucency in sync with terrain opacity, basemap opacity, and
 * fork globeTranslucency settings. Registered after the Cesium viewer is
 * created so this runs after Cesium's own reactions.
 */
export function attachGlobeTranslucencySync(cesium: Cesium): IReactionDisposer {
  const terria = cesium.terria;
  return autorun(() => {
    // Re-run after Cesium's terrain autorun, which can reset translucency.enabled.
    void terria.terrainSplitDirection;
    void terria.depthTestAgainstTerrainEnabled;
    void terria.globeTranslucencyEnabled;
    void terria.terrainOpacity;
    void terria.progressiveLoading;
    void terria.configParameters.globeTranslucency;
    void cesium.terriaViewer.baseMap?.uniqueId;
    if (
      cesium.terriaViewer.baseMap &&
      hasTraits(cesium.terriaViewer.baseMap, OpacityTraits, "opacity")
    ) {
      void OpacityTraits.traits.opacity.getValue(cesium.terriaViewer.baseMap);
    }

    syncGlobeTranslucencyState(cesium);
  });
}

/**
 * Attach globe translucency sync whenever a Cesium viewer is active on Terria.
 */
export function observeGlobeTranslucency(terria: Terria): () => void {
  let inner: IReactionDisposer | undefined;
  const outer = reaction(
    () => terria.cesium,
    (cesium) => {
      inner?.();
      inner = cesium ? attachGlobeTranslucencySync(cesium) : undefined;
    },
    { fireImmediately: true }
  );
  return () => {
    inner?.();
    outer();
  };
}
