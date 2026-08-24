import { act, renderHook } from "@testing-library/react";
import { runInAction } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Terria from "../../../lib/Models/Terria";
import ViewerMode, { setViewerMode } from "../../../lib/Models/ViewerMode";
import ViewState from "../../../lib/ReactViewModels/ViewState";
import usePlayPath from "../../../lib/ReactViews/Custom/PlayPath";
import { MeasurableGeometry } from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryManager";

function carto(longitude: number, latitude: number, height = 0) {
  return new Cartographic(
    CesiumMath.toRadians(longitude),
    CesiumMath.toRadians(latitude),
    height
  );
}

function measuredPath(): MeasurableGeometry {
  const stopPoints = [carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)];
  return {
    isClosed: false,
    hasArea: false,
    stopPoints,
    stopGeodeticDistances: [0, 1300],
    sampledPoints: [
      stopPoints[0],
      carto(11.343, 44.493, 45),
      carto(11.346, 44.496, 60),
      stopPoints[1]
    ]
  };
}

describe("usePlayPath", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({ terria });
  });

  function addPath(geom: MeasurableGeometry = measuredPath()) {
    runInAction(() => {
      terria.measurableGeomList.push(geom);
    });
  }

  function render() {
    return renderHook(() => usePlayPath(terria, viewState));
  }

  describe("before a path is measured", function () {
    it("reports no points to fly through", function () {
      const { result } = render();
      expect(result.current.pointsSize).toBeUndefined();
    });

    it("is not playing", function () {
      const { result } = render();
      expect(result.current.playingPath).toBe(false);
    });

    it("starts at normal speed", function () {
      const { result } = render();
      expect(result.current.playSpeed).toEqual(1);
    });

    it("starts at the first point", function () {
      const { result } = render();
      expect(result.current.currentPointIndex).toEqual(0);
      expect(result.current.countdown).toBeNull();
    });

    it("stays put when asked to play", function () {
      const { result } = render();
      act(() => result.current.onPlay());
      expect(result.current.playingPath).toBe(false);
    });
  });

  describe("once a path is measured", function () {
    it("uses the stop points while there is no Cesium viewer", function () {
      addPath();
      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("flies through the sampled points in the Cesium viewer", function () {
      addPath();
      spyOnProperty(terria, "cesium", "get").and.returnValue({
        scene: {}
      } as any);

      const { result } = render();
      expect(result.current.pointsSize).toEqual(4);
    });

    it("has nothing to fly through in Cesium until the path is sampled", function () {
      addPath({ ...measuredPath(), sampledPoints: undefined });
      spyOnProperty(terria, "cesium", "get").and.returnValue({
        scene: {}
      } as any);

      const { result } = render();
      expect(result.current.pointsSize).toBeUndefined();
    });

    it("still uses the stop points for an unsampled path outside Cesium", function () {
      addPath({ ...measuredPath(), sampledPoints: undefined });
      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("uses only the stop points in the flat Cesium viewer", function () {
      addPath();
      setViewerMode("2dcesium", terria.mainViewer);
      expect(terria.mainViewer.viewerMode).toEqual(ViewerMode.Cesium2D);

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("reads the path the workbench currently has selected", function () {
      addPath();
      addPath({ ...measuredPath(), sampledPoints: undefined });
      runInAction(() => {
        terria.measurableGeometryIndex = 1;
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });
  });

  describe("playback controls", function () {
    it("changes the play speed", function () {
      const { result } = render();
      act(() => result.current.setPlaySpeed(4));
      expect(result.current.playSpeed).toEqual(4);
    });

    it("leaves the map idle when paused", function () {
      addPath();
      const { result } = render();

      act(() => result.current.onPause());

      expect(viewState.isPlayingPath).toBe(false);
    });

    it("leaves the map idle when stopped", function () {
      addPath();
      const { result } = render();

      act(() => result.current.onStop());

      expect(viewState.isPlayingPath).toBe(false);
    });

    it("returns to the first point when reset", function () {
      addPath();
      const { result } = render();
      act(() => result.current.setPlaySpeed(4));

      act(() => result.current.resetPlayPath());

      expect(viewState.isPlayingPath).toBe(false);
      expect(result.current.currentPointIndex).toEqual(0);
      expect(result.current.countdown).toBeNull();
      expect(result.current.isCameraMoving).toBe(false);
    });
  });

  describe("camera pitch warning", function () {
    it("does not warn while there is no Cesium camera to check", function () {
      addPath();
      const { result } = render();
      expect(result.current.isPitchTooLow()).toBe(false);
    });

    it("does not warn in the Leaflet viewer", function () {
      addPath();
      setViewerMode("2d", terria.mainViewer);
      const { result } = render();
      expect(result.current.isPitchTooLow()).toBe(false);
    });
  });
});
