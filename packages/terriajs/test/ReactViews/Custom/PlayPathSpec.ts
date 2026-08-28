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

function longMeasuredPath(): MeasurableGeometry {
  const stopPoints = [
    carto(11.34, 44.49, 30),
    carto(11.35, 44.5, 80),
    carto(11.36, 44.51, 120),
    carto(11.37, 44.52, 160)
  ];
  return {
    isClosed: false,
    hasArea: false,
    stopPoints,
    stopGeodeticDistances: [0, 1300, 2600, 3900],
    sampledPoints: stopPoints
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

  /** Pretends a Cesium viewer is attached, without building a real globe. */
  function useCesium() {
    spyOnProperty(terria, "cesium", "get").and.returnValue({
      scene: {}
    } as any);
  }

  function flushTimers() {
    return act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
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

    it("resamples the stop points for the flight in the Cesium viewer", function () {
      addPath();
      useCesium();

      // The two stops are ~1366 m apart, flown in 500 m steps.
      const { result } = render();
      expect(result.current.pointsSize).toEqual(4);
    });

    it("resamples an unsampled path in Cesium too", function () {
      addPath({ ...measuredPath(), sampledPoints: undefined });
      useCesium();

      const { result } = render();
      expect(result.current.pointsSize).toEqual(4);
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

  describe("flight sampling step", function () {
    it("starts from the sampling step configured on terria", function () {
      const { result } = render();
      expect(result.current.playPathSamplingStep).toEqual(
        terria.playPathSamplingStep
      );
    });

    it("resamples more finely when the step is reduced", function () {
      addPath();
      useCesium();
      runInAction(() => {
        terria.playPathSamplingStep = 200;
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(8);
    });

    it("keeps the bare stop points when the step is longer than the path", function () {
      addPath();
      useCesium();
      runInAction(() => {
        terria.playPathSamplingStep = 2000;
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("keeps the bare stop points when the step is not a positive length", function () {
      addPath();
      useCesium();
      runInAction(() => {
        terria.playPathSamplingStep = 0;
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("does not resample outside the Cesium viewer", function () {
      addPath();
      runInAction(() => {
        terria.playPathSamplingStep = 200;
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("records a new step on terria and rewinds the playback", function () {
      addPath();
      const { result } = render();
      act(() => result.current.onPlay());
      expect(result.current.countdown).toEqual(3);

      act(() => result.current.changePlayPathSamplingStep(200));

      expect(terria.playPathSamplingStep).toEqual(200);
      expect(result.current.playPathSamplingStep).toEqual(200);
      expect(result.current.countdown).toBeNull();
      expect(result.current.currentPointIndex).toEqual(0);
    });
  });

  describe("the path the panel was opened for", function () {
    function pinSnapshotFor(sourceItemId: string) {
      runInAction(() => {
        viewState.measurableGeomBySourceItemId.set(
          sourceItemId,
          viewState.createMeasurableGeomSnapshot()
        );
      });
    }

    it("keeps playing the geometry pinned to its workbench item", function () {
      addPath();
      pinSnapshotFor("layer-a");

      runInAction(() => {
        terria.measurableGeomList.splice(
          0,
          terria.measurableGeomList.length,
          longMeasuredPath()
        );
        viewState.playPathPanelSourceItemId = "layer-a";
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(2);
    });

    it("falls back to the geometry being measured when nothing is pinned", function () {
      addPath(longMeasuredPath());
      runInAction(() => {
        viewState.playPathPanelSourceItemId = "layer-b";
      });

      const { result } = render();
      expect(result.current.pointsSize).toEqual(4);
    });
  });

  describe("switching between measured geometries", function () {
    it("rewinds and drops the countdown when another geometry is selected", async function () {
      addPath();
      addPath(longMeasuredPath());
      const { result, rerender } = render();

      act(() => result.current.onPlay());
      expect(result.current.countdown).toEqual(3);

      act(() => {
        runInAction(() => {
          terria.measurableGeometryIndex = 1;
        });
        rerender();
      });
      await flushTimers();

      expect(result.current.countdown).toBeNull();
      expect(result.current.currentPointIndex).toEqual(0);
      expect(result.current.pointsSize).toEqual(4);
      expect(viewState.isPlayingPath).toBe(false);
    });

    it("leaves the playback alone while the same geometry stays selected", async function () {
      addPath();
      addPath(longMeasuredPath());
      const { result, rerender } = render();

      act(() => result.current.onPlay());
      act(() => rerender());
      await flushTimers();

      expect(result.current.countdown).not.toBeNull();
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
