import { useEffect, useRef, useState, useCallback } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import CatmullRomSpline from "terriajs-cesium/Source/Core/CatmullRomSpline";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import LinearApproximation from "terriajs-cesium/Source/Core/LinearApproximation";
import LagrangePolynomialApproximation from "terriajs-cesium/Source/Core/LagrangePolynomialApproximation";
import HermitePolynomialApproximation from "terriajs-cesium/Source/Core/HermitePolynomialApproximation";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import SampledPositionProperty from "terriajs-cesium/Source/DataSources/SampledPositionProperty";
import CallbackProperty from "terriajs-cesium/Source/DataSources/CallbackProperty";
import VelocityOrientationProperty from "terriajs-cesium/Source/DataSources/VelocityOrientationProperty";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityView from "terriajs-cesium/Source/DataSources/EntityView";
import { TrackingReferenceFrame } from "terriajs-cesium";
import CameraView from "../../Models/CameraView";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import { runInAction } from "mobx";

type InterpolationMode = "linear" | "lagrange" | "hermite";
type TrackingReferenceFrameValue =
  typeof TrackingReferenceFrame[keyof typeof TrackingReferenceFrame];

export default function usePlayPath(terria: Terria, viewState: ViewState) {
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [interpolationMode, setInterpolationMode] =
    useState<InterpolationMode>("linear");
  const [trackingReferenceFrame, setTrackingReferenceFrame] =
    useState<TrackingReferenceFrameValue>(TrackingReferenceFrame.AUTODETECT);

  const startIdxRef = useRef(0);
  const reverseRef = useRef(false);
  const playSpeedRef = useRef(playSpeed);
  const abortPlayingPathRef = useRef(false);
  const currentPointIndexRef = useRef(currentPointIndex);

  const interpolationModeRef = useRef(interpolationMode);
  const trackingReferenceFrameRef = useRef<TrackingReferenceFrameValue>(
    trackingReferenceFrame
  );
  const rafIdRef = useRef<number | null>(null);
  const playEntityRef = useRef<Entity | null>(null);
  const lastReportedPointIndexRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef<number>(0);
  const lastFramePerfRef = useRef<number | null>(null);
  const timeScratchRef = useRef<JulianDate>(new JulianDate());
  const lastUiUpdatePerfRef = useRef<number>(0);
  const pausedElapsedSecondsRef = useRef<number | null>(null);
  const lastCameraCoordsRef = useRef<{
    position: Cartesian3;
    direction: Cartesian3;
    up: Cartesian3;
  } | null>(null);

  const setPlayingPathState = useCallback(
    (value: boolean) => {
      runInAction(() => {
        viewState.isPlayingPath = value;
      });
    },
    [viewState]
  );

  const restoreCameraAfterTracking = useCallback(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const saved = lastCameraCoordsRef.current;
    camera.lookAtTransform(Matrix4.IDENTITY);

    if (saved) {
      camera.setView({
        destination: saved.position,
        orientation: {
          direction: saved.direction,
          up: saved.up
        }
      });
    }

    terria.currentViewer.notifyRepaintRequired();
  }, [terria]);

  const clearAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const resetPlayPath = useCallback(() => {
    if (viewState.isPlayingPath) {
      abortPlayingPathRef.current = false;
      setPlayingPathState(false);
    }

    setCurrentPointIndex(0);
    setCountdown(null);
    setIsCameraMoving(false);
    startIdxRef.current = 0;
    reverseRef.current = false;
    currentPointIndexRef.current = 0;
    lastReportedPointIndexRef.current = null;
    pausedElapsedSecondsRef.current = null;

    clearAnimation();
    restoreCameraAfterTracking();
    playEntityRef.current = null;
    lastCameraCoordsRef.current = null;
  }, [
    viewState,
    setPlayingPathState,
    restoreCameraAfterTracking,
    clearAnimation
  ]);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;

    const pts = terria.cesium ? geom.sampledPoints : geom.stopPoints;
    if (!pts || pts.length === 0) return;

    return pts;
  }, [terria]);

  useEffect(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const onCameraMoveStart = () => {
      setIsCameraMoving(true);
    };

    const onCameraMoveEnd = () => {
      setIsCameraMoving(false);
    };

    camera.moveStart?.addEventListener(onCameraMoveStart);
    camera.moveEnd.addEventListener(onCameraMoveEnd);

    return () => {
      camera.moveStart?.removeEventListener(onCameraMoveStart);
      camera.moveEnd.removeEventListener(onCameraMoveEnd);
    };
  }, [terria]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      setPlayingPathState(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, setPlayingPathState]);

  useEffect(() => {
    currentPointIndexRef.current = currentPointIndex;
    playSpeedRef.current = playSpeed;
    interpolationModeRef.current = interpolationMode;
  }, [currentPointIndex, playSpeed, interpolationMode]);

  useEffect(() => {
    trackingReferenceFrameRef.current = trackingReferenceFrame;
    if (playEntityRef.current) {
      playEntityRef.current.trackingReferenceFrame =
        trackingReferenceFrameRef.current;
    }
  }, [trackingReferenceFrame]);

  const playPath = useCallback(() => {
    abortPlayingPathRef.current = true;

    const pts = getPoints();
    const cesiumModel = terria.cesium;
    if (!pts?.length || !cesiumModel) {
      setPlayingPathState(false);
      return;
    }

    const scene = cesiumModel.scene;
    const camera = scene.camera;

    lastCameraCoordsRef.current = null;

    const baseStepSeconds = 5;
    const n = pts.length;
    const sampleStart = JulianDate.now();
    const cartesians = pts.map((p) => Cartographic.toCartesian(p));

    const orderIndices = reverseRef.current
      ? Array.from({ length: n }, (_, i) => n - 1 - i)
      : Array.from({ length: n }, (_, i) => i);

    const orderPosByIndex = new Array<number>(n);
    for (let p = 0; p < n; p++) orderPosByIndex[orderIndices[p]] = p;

    const segmentDistances: number[] = [];
    for (let p = 0; p < n - 1; p++) {
      const a = cartesians[orderIndices[p]];
      const b = cartesians[orderIndices[p + 1]];
      segmentDistances[p] = Cartesian3.distance(a, b);
    }

    const totalDistance = segmentDistances.reduce((acc, d) => acc + d, 0);
    const avgDistance =
      n > 1 && totalDistance > 0 ? totalDistance / (n - 1) : 1;

    const sampleSeconds: number[] = new Array(n);
    sampleSeconds[0] = 0;
    for (let p = 1; p < n; p++) {
      const seg = segmentDistances[p - 1] ?? 0;
      const ratio = avgDistance > 0 ? seg / avgDistance : 1;
      const dt = Math.min(10, Math.max(0.2, baseStepSeconds * ratio));
      sampleSeconds[p] = sampleSeconds[p - 1] + dt;
    }

    const totalDuration = sampleSeconds[n - 1] ?? 0;
    const mode = interpolationModeRef.current;
    const orderedCartesians = orderIndices.map((idx) => cartesians[idx]);

    let positionProperty: any;

    if ((mode === "lagrange" || mode === "hermite") && n >= 4) {
      const spline = new CatmullRomSpline({
        times: sampleSeconds,
        points: orderedCartesians
      });

      positionProperty = new CallbackProperty(
        (time: JulianDate | undefined, result?: Cartesian3) => {
          if (!time) {
            return Cartesian3.clone(
              orderedCartesians[0],
              result ?? new Cartesian3()
            );
          }

          const t = JulianDate.secondsDifference(time, sampleStart);
          const clamped = Math.min(totalDuration, Math.max(0, t));
          return spline.evaluate(clamped, result ?? new Cartesian3());
        },
        false
      ) as any;
    } else {
      const position = new SampledPositionProperty();

      for (let p = 0; p < n; p++) {
        const time = JulianDate.addSeconds(
          sampleStart,
          sampleSeconds[p],
          new JulianDate()
        );
        position.addSample(time, orderedCartesians[p]);
      }

      if (mode === "linear") {
        position.setInterpolationOptions({
          interpolationDegree: 1,
          interpolationAlgorithm: LinearApproximation
        });
      } else if (mode === "lagrange") {
        position.setInterpolationOptions({
          interpolationDegree: 5,
          interpolationAlgorithm: LagrangePolynomialApproximation
        });
      } else {
        position.setInterpolationOptions({
          interpolationDegree: 3,
          interpolationAlgorithm: HermitePolynomialApproximation
        });
      }

      positionProperty = position;
    }

    const entity = new Entity({
      position: positionProperty,
      orientation: new VelocityOrientationProperty(positionProperty)
    });
    entity.trackingReferenceFrame = trackingReferenceFrameRef.current;

    const initialIdx = Math.max(
      0,
      Math.min(n - 1, currentPointIndexRef.current)
    );

    let viewFrom: Cartesian3 | undefined;
    if (trackingReferenceFrameRef.current === TrackingReferenceFrame.ENU) {
      const initialEntityPos = (positionProperty as any).getValue(
        sampleStart,
        new Cartesian3()
      ) as Cartesian3 | undefined;

      if (initialEntityPos) {
        const ellipsoid = scene.globe.ellipsoid;
        const enuToFixed = Transforms.eastNorthUpToFixedFrame(
          initialEntityPos,
          ellipsoid,
          new Matrix4()
        );
        const fixedToEnu = Matrix4.inverse(enuToFixed, new Matrix4());
        const camPos = (camera as any).positionWC ?? camera.position;
        viewFrom = Matrix4.multiplyByPoint(
          fixedToEnu,
          camPos,
          new Cartesian3()
        );
      }
    }

    if (!viewFrom) {
      const dist = Cartesian3.distance(camera.position, cartesians[initialIdx]);
      viewFrom = new Cartesian3(-dist, 0, Math.max(10, dist * 0.2));
    }
    (entity as any).viewFrom = viewFrom;

    playEntityRef.current = entity;
    const entityView = new EntityView(entity, scene, scene.globe.ellipsoid);

    const initialOrderPos = orderPosByIndex[initialIdx] ?? 0;
    const resumeElapsed = pausedElapsedSecondsRef.current;
    const startElapsed =
      resumeElapsed !== null
        ? resumeElapsed
        : sampleSeconds[Math.max(0, Math.min(n - 1, initialOrderPos))] ?? 0;

    elapsedSecondsRef.current = Math.min(
      totalDuration,
      Math.max(0, startElapsed)
    );
    lastFramePerfRef.current = performance.now();
    lastUiUpdatePerfRef.current = 0;
    pausedElapsedSecondsRef.current = null;

    const tick = () => {
      if (!abortPlayingPathRef.current) {
        return;
      }

      const speed = Math.max(0.01, playSpeedRef.current);
      const now = performance.now();
      const last = lastFramePerfRef.current ?? now;
      lastFramePerfRef.current = now;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));

      elapsedSecondsRef.current += dt * speed;
      const elapsed = elapsedSecondsRef.current;

      const clampedElapsed = Math.min(totalDuration, Math.max(0, elapsed));
      JulianDate.addSeconds(
        sampleStart,
        clampedElapsed,
        timeScratchRef.current
      );

      entityView.update(timeScratchRef.current);

      let coords = lastCameraCoordsRef.current;
      if (!coords) {
        coords = lastCameraCoordsRef.current = {
          position: new Cartesian3(),
          direction: new Cartesian3(),
          up: new Cartesian3()
        };
      }

      Cartesian3.clone(camera.positionWC, coords.position);
      Cartesian3.clone(camera.directionWC, coords.direction);
      Cartesian3.clone(camera.upWC, coords.up);

      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (sampleSeconds[mid] <= clampedElapsed) lo = mid;
        else hi = mid - 1;
      }

      const idx = orderIndices[lo] ?? 0;
      if (lastReportedPointIndexRef.current !== idx) {
        const lastUi = lastUiUpdatePerfRef.current;
        if (
          lastUi === 0 ||
          now - lastUi > 150 ||
          clampedElapsed >= totalDuration
        ) {
          lastUiUpdatePerfRef.current = now;
          lastReportedPointIndexRef.current = idx;
          setCurrentPointIndex(idx);
        }
      }

      terria.currentViewer.notifyRepaintRequired();

      if (clampedElapsed >= totalDuration) {
        abortPlayingPathRef.current = false;
        const finalIdx = orderIndices[n - 1] ?? n - 1;

        if (lastReportedPointIndexRef.current !== finalIdx) {
          lastReportedPointIndexRef.current = finalIdx;
          setCurrentPointIndex(finalIdx);
        }

        pausedElapsedSecondsRef.current = null;
        restoreCameraAfterTracking();
        setPlayingPathState(false);
        return;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    clearAnimation();
    rafIdRef.current = requestAnimationFrame(tick);
  }, [
    getPoints,
    terria,
    restoreCameraAfterTracking,
    clearAnimation,
    setPlayingPathState
  ]);

  const onPlay = () => {
    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (!pts?.length || !camera) return;

    if (!viewState.isPlayingPath && pausedElapsedSecondsRef.current !== null) {
      setPlayingPathState(true);
      return;
    }

    reverseRef.current = false;
    startIdxRef.current = 0;
    currentPointIndexRef.current = 0;
    setCurrentPointIndex(0);
    pausedElapsedSecondsRef.current = null;
    setCountdown(3);
  };

  const onPause = () => {
    pausedElapsedSecondsRef.current = elapsedSecondsRef.current;
    abortPlayingPathRef.current = false;
    clearAnimation();
    restoreCameraAfterTracking();
    setPlayingPathState(false);
  };

  const onStop = () => {
    abortPlayingPathRef.current = false;
    clearAnimation();
    restoreCameraAfterTracking();
    playEntityRef.current = null;
    lastReportedPointIndexRef.current = null;
    lastCameraCoordsRef.current = null;
    pausedElapsedSecondsRef.current = null;
    setPlayingPathState(false);

    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (!pts?.length || !camera) return;

    const targetIdx = 0;
    startIdxRef.current = 0;
    reverseRef.current = false;

    const point = pts[targetIdx];
    const dist = Cartesian3.distance(
      camera.position,
      Cartographic.toCartesian(point)
    );
    const pitch = camera.pitch ?? 0;
    let hpr: HeadingPitchRange | undefined;

    if (pts.length > 1) {
      const neighborIdx = 1;
      const heading =
        (new EllipsoidGeodesic(point, pts[neighborIdx]).startHeading +
          CesiumMath.TWO_PI) %
        CesiumMath.TWO_PI;
      hpr = new HeadingPitchRange(heading, -pitch, dist);
    }

    const duration = 3 / playSpeedRef.current;
    terria.currentViewer.doZoomTo(
      hpr
        ? CameraView.fromLookAt(point, hpr)
        : Rectangle.fromCartographicArray([point]),
      duration
    );
    setCurrentPointIndex(targetIdx);
    currentPointIndexRef.current = targetIdx;
    terria.currentViewer.notifyRepaintRequired();
  };

  useEffect(() => {
    if (viewState.isPlayingPath) playPath();
  }, [viewState.isPlayingPath, playPath]);

  return {
    playSpeed,
    setPlaySpeed,
    interpolationMode,
    setInterpolationMode,
    trackingReferenceFrame,
    setTrackingReferenceFrame,
    playingPath: viewState.isPlayingPath,
    isCameraMoving,
    countdown,
    currentPointIndex,
    pointsSize: getPoints()?.length,
    onPlay,
    onPause,
    onStop,
    resetPlayPath
  };
}
