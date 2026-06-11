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
import ViewerMode from "../../Models/ViewerMode";
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
  const [startFromLastPoint, setStartFromLastPoint] = useState(false);

  const startIdxRef = useRef(0);
  const reverseRef = useRef(false);
  const playSpeedRef = useRef(playSpeed);
  const abortPlayingPathRef = useRef(false);
  const currentPointIndexRef = useRef(currentPointIndex);

  const interpolationModeRef = useRef(interpolationMode);
  const trackingReferenceFrameRef = useRef<TrackingReferenceFrameValue>(
    trackingReferenceFrame
  );
  const startFromLastPointRef = useRef(startFromLastPoint);
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
    if (!camera || terria.currentViewer.type === "Leaflet") {
      return;
    }

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

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;

    const isCesium2D = terria.mainViewer.viewerMode === ViewerMode.Cesium2D;
    const isLeaflet = terria.mainViewer.viewerMode === ViewerMode.Leaflet;

    const pts =
      isCesium2D || isLeaflet || !terria.cesium
        ? geom.stopPoints
        : geom.sampledPoints;
    if (!pts || pts.length === 0) return;

    return pts;
  }, [terria]);

  useEffect(() => {
    startFromLastPointRef.current = startFromLastPoint;
  }, [startFromLastPoint]);

  const resetPlayPath = useCallback(() => {
    const pts = getPoints();
    const targetIdx =
      pts?.length && startFromLastPointRef.current ? pts.length - 1 : 0;

    if (viewState.isPlayingPath) {
      abortPlayingPathRef.current = false;
      setPlayingPathState(false);
    }

    setCurrentPointIndex(targetIdx);
    setCountdown(null);
    setIsCameraMoving(false);
    startIdxRef.current = targetIdx;
    reverseRef.current = startFromLastPointRef.current;
    currentPointIndexRef.current = targetIdx;
    lastReportedPointIndexRef.current = null;
    pausedElapsedSecondsRef.current = null;

    clearAnimation();
    restoreCameraAfterTracking();
    playEntityRef.current = null;
    lastCameraCoordsRef.current = null;
  }, [
    getPoints,
    viewState,
    setPlayingPathState,
    restoreCameraAfterTracking,
    clearAnimation
  ]);

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
    const viewer = terria.currentViewer;

    if (!pts?.length) {
      setPlayingPathState(false);
      return;
    }

    const runCameraStepPath = async () => {
      playEntityRef.current = null;
      lastCameraCoordsRef.current = null;
      pausedElapsedSecondsRef.current = null;
      elapsedSecondsRef.current = 0;

      const isLeafletViewer = viewer.type === "Leaflet";
      const isCesium2D = terria.mainViewer.viewerMode === ViewerMode.Cesium2D;
      const camera = isLeafletViewer ? undefined : cesiumModel?.scene.camera;
      const cartesians = pts.map((p) => Cartographic.toCartesian(p));
      const initialIdx = Math.max(
        0,
        Math.min(pts.length - 1, currentPointIndexRef.current)
      );
      const pitch = camera?.pitch ?? 0;

      let dist = 1000;
      if (camera) {
        if (isCesium2D) {
          dist = camera.positionCartographic.height || 1000;
        } else {
          const cameraTrueCartesian = Cartographic.toCartesian(
            camera.positionCartographic
          );
          dist = Cartesian3.distance(
            cameraTrueCartesian,
            cartesians[initialIdx]
          );
        }
      }

      const waitForLeafletFlight = (durationSeconds: number) =>
        new Promise<"loaded">((resolve) => {
          window.setTimeout(() => resolve("loaded"), durationSeconds * 1000);
        });

      const waitForAbort = () =>
        new Promise<"abort">((resolve) => {
          const check = () => {
            if (!abortPlayingPathRef.current) {
              resolve("abort");
            } else {
              window.setTimeout(check, 50);
            }
          };
          check();
        });

      const step = reverseRef.current ? -1 : 1;
      const start = Math.max(
        0,
        Math.min(pts.length - 1, currentPointIndexRef.current)
      );

      for (
        let i = start;
        abortPlayingPathRef.current && i >= 0 && i < pts.length;
        i += step
      ) {
        const duration = 2 / Math.max(0.01, playSpeedRef.current);
        let hpr: HeadingPitchRange | undefined;
        const isForwardStep = step > 0;
        const hasNextPoint = isForwardStep ? i < pts.length - 1 : i > 0;
        const isTerminalStep = isForwardStep ? i === pts.length - 1 : i === 0;

        if (camera && hasNextPoint) {
          const next = isForwardStep ? pts[i + 1] : pts[i - 1];
          const heading =
            (new EllipsoidGeodesic(pts[i], next).startHeading +
              CesiumMath.TWO_PI) %
            CesiumMath.TWO_PI;
          hpr = new HeadingPitchRange(heading, -pitch, dist);
        } else if (camera && isCesium2D && isTerminalStep && pts.length > 1) {
          const previous = isForwardStep ? pts[i - 1] : pts[i + 1];
          const heading =
            (new EllipsoidGeodesic(previous, pts[i]).startHeading +
              CesiumMath.TWO_PI) %
            CesiumMath.TWO_PI;
          hpr = new HeadingPitchRange(heading, -pitch, dist);
        }

        const target = hpr
          ? CameraView.fromLookAt(pts[i], hpr)
          : Rectangle.fromCartographicArray([pts[i]]);

        const zoom = viewer.doZoomTo(target, duration).then(() => "loaded");
        const result = await Promise.race([
          isLeafletViewer
            ? zoom.then(() => waitForLeafletFlight(duration))
            : zoom,
          waitForAbort()
        ]);

        if (result === "abort") {
          return;
        }

        const nextIndex = i + step;
        const reachedEnd = nextIndex < 0 || nextIndex >= pts.length;
        const displayIndex = reachedEnd ? i : nextIndex;

        currentPointIndexRef.current = displayIndex;
        lastReportedPointIndexRef.current = displayIndex;
        setCurrentPointIndex(displayIndex);
        viewer.notifyRepaintRequired();

        if (reachedEnd) {
          break;
        }
      }

      if (abortPlayingPathRef.current) {
        abortPlayingPathRef.current = false;
        pausedElapsedSecondsRef.current = null;
        setPlayingPathState(false);
      }
    };

    if (
      !cesiumModel ||
      viewer.type === "Leaflet" ||
      terria.mainViewer.viewerMode === ViewerMode.Cesium2D
    ) {
      clearAnimation();
      void runCameraStepPath();
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
      const cameraPosition = (camera as any).positionWC ?? camera.position;
      const dist = Cartesian3.distance(cameraPosition, cartesians[initialIdx]);
      const safeDist = Number.isFinite(dist) && dist > 0 ? dist : 1000;
      viewFrom = new Cartesian3(-safeDist, 0, Math.max(10, safeDist * 0.2));
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
    if (!pts?.length) return;

    if (!viewState.isPlayingPath && pausedElapsedSecondsRef.current !== null) {
      setPlayingPathState(true);
      return;
    }

    const startIdx = startFromLastPointRef.current ? pts.length - 1 : 0;
    reverseRef.current = startFromLastPointRef.current;
    startIdxRef.current = startIdx;
    currentPointIndexRef.current = startIdx;
    setCurrentPointIndex(startIdx);
    pausedElapsedSecondsRef.current = null;
    lastReportedPointIndexRef.current = null;
    setCountdown(3);
  };

  const onPause = () => {
    pausedElapsedSecondsRef.current = elapsedSecondsRef.current;
    abortPlayingPathRef.current = false;
    clearAnimation();
    (terria.cesium?.scene.camera as any)?.cancelFlight?.();
    restoreCameraAfterTracking();
    setPlayingPathState(false);
  };

  const onStop = () => {
    abortPlayingPathRef.current = false;
    clearAnimation();
    (terria.cesium?.scene.camera as any)?.cancelFlight?.();
    restoreCameraAfterTracking();
    playEntityRef.current = null;
    lastReportedPointIndexRef.current = null;
    lastCameraCoordsRef.current = null;
    pausedElapsedSecondsRef.current = null;
    setPlayingPathState(false);

    const pts = getPoints();
    const camera =
      terria.currentViewer.type === "Leaflet"
        ? undefined
        : terria.cesium?.scene.camera;
    if (!pts?.length) return;

    const targetIdx = Math.max(
      0,
      Math.min(pts.length - 1, startIdxRef.current)
    );
    startIdxRef.current = targetIdx;
    reverseRef.current = startIdxRef.current === pts.length - 1;
    const point = pts[targetIdx];
    let hpr: HeadingPitchRange | undefined;

    const neighborIdx = reverseRef.current ? targetIdx - 1 : targetIdx + 1;
    if (camera && neighborIdx >= 0 && neighborIdx < pts.length) {
      const isCesium2D = terria.mainViewer.viewerMode === ViewerMode.Cesium2D;
      const cameraTrueCartesian = Cartographic.toCartesian(
        camera.positionCartographic
      );
      const dist = isCesium2D
        ? camera.positionCartographic.height || 1000
        : Cartesian3.distance(
            cameraTrueCartesian,
            Cartographic.toCartesian(point)
          );
      const pitch = camera.pitch ?? 0;
      const heading =
        (new EllipsoidGeodesic(point, pts[neighborIdx]).startHeading +
          CesiumMath.TWO_PI) %
        CesiumMath.TWO_PI;
      hpr = new HeadingPitchRange(heading, -pitch, dist);
    }

    const duration = 3 / Math.max(0.01, playSpeedRef.current);
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
    startFromLastPoint,
    setStartFromLastPoint,
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
