import { useEffect, useRef, useState, useCallback } from "react";
import { runInAction } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartesian4 from "terriajs-cesium/Source/Core/Cartesian4";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import CatmullRomSpline from "terriajs-cesium/Source/Core/CatmullRomSpline";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import { Matrix4, Transforms } from "terriajs-cesium";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";

// Constants
const MIN_PITCH = Math.PI / 4;
const INITIAL_CAMERA_OFFSET = new HeadingPitchRange(
  0,
  -CesiumMath.PI_OVER_FOUR,
  1000
);
const PATH_SPEED = 100; // meters per second
const COUNTDOWN_DURATION = 3;
const CAMERA_SETUP_DELAY = 2000;
const VELOCITY_THRESHOLD = 0.001;
const SPLINE_TIME_STEP = 0.001;

interface PathState {
  progress: number;
  currentIndex: number;
  countdown: number | null;
  isMoving: boolean;
  speed: number;
}

interface AnimationRefs {
  frameId: number | null;
  startTime: JulianDate | null;
  pausedTime: JulianDate | null;
  pausedProgress: number;
  isReversed: boolean;
  isInitialized: boolean;
  isAborting: boolean;
  isUserInteracting: boolean;
  lastAnchorPosition: Cartesian3 | null;
  pathDuration: number;
  positionSpline: CatmullRomSpline | null;
  cameraOffset: HeadingPitchRange;
}

export default function usePlayPath(terria: Terria, viewState: ViewState) {
  // State
  const [pathState, setPathState] = useState<PathState>({
    progress: 0,
    currentIndex: 0,
    countdown: null,
    isMoving: false,
    speed: 1
  });

  // Refs
  const animationRefs = useRef<AnimationRefs>({
    frameId: null,
    startTime: null,
    pausedTime: null,
    pausedProgress: 0,
    isReversed: false,
    isInitialized: false,
    isAborting: false,
    isUserInteracting: false,
    lastAnchorPosition: null,
    pathDuration: 0,
    positionSpline: null,
    cameraOffset: HeadingPitchRange.clone(INITIAL_CAMERA_OFFSET)
  });

  // Utility functions
  const getCamera = useCallback(() => terria.cesium?.scene.camera, [terria]);

  const getCameraController = useCallback(
    () => terria.cesium?.scene.screenSpaceCameraController,
    [terria]
  );

  const getPoints = useCallback((): Cartographic[] | undefined => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    return geom?.stopPoints?.length ? geom.stopPoints : undefined;
  }, [terria]);

  const isPitchTooLow = useCallback(() => {
    const camera = getCamera();
    return camera ? Math.abs(camera.pitch ?? 0) < MIN_PITCH : false;
  }, [getCamera]);

  // Camera control
  const releaseCamera = useCallback(() => {
    const camera = getCamera();
    const controller = getCameraController();
    if (!camera || !controller) return;

    controller.enableRotate = true;
    controller.enableTranslate = true;
    controller.enableZoom = true;
    controller.enableTilt = true;
    controller.enableLook = true;
    camera.lookAtTransform(Matrix4.IDENTITY);
  }, [getCamera, getCameraController]);

  // Path creation
  const createPathSpline = useCallback(
    (points: Cartographic[]): CatmullRomSpline | null => {
      if (points.length < 2) return null;

      const cartesians = points.map((p) => Cartographic.toCartesian(p));

      const { times, totalDistance } = cartesians.reduce(
        (acc, point, i) => {
          if (i === 0) return { times: [0], totalDistance: 0 };

          const distance = Cartesian3.distance(cartesians[i - 1], point);
          acc.totalDistance += distance;
          acc.times.push(acc.totalDistance);
          return acc;
        },
        { times: [] as number[], totalDistance: 0 }
      );

      const duration = totalDistance / PATH_SPEED;
      animationRefs.current.pathDuration = duration;
      const normalizedTimes = times.map((t) => (t / totalDistance) * duration);

      let firstTangent, lastTangent;
      if (cartesians.length > 2) {
        firstTangent = Cartesian3.multiplyByScalar(
          Cartesian3.subtract(cartesians[1], cartesians[0], new Cartesian3()),
          0.5,
          new Cartesian3()
        );

        const lastIdx = cartesians.length - 1;
        lastTangent = Cartesian3.multiplyByScalar(
          Cartesian3.subtract(
            cartesians[lastIdx],
            cartesians[lastIdx - 1],
            new Cartesian3()
          ),
          0.5,
          new Cartesian3()
        );
      }

      return new CatmullRomSpline({
        times: normalizedTimes,
        points: cartesians,
        firstTangent,
        lastTangent
      });
    },
    []
  );

  // Animation frame
  const animate = useCallback(() => {
    const refs = animationRefs.current;
    const camera = getCamera();

    if (!viewState.isPlayingPath || !refs.positionSpline || !camera) {
      return;
    }

    const now = JulianDate.now();
    const baseTime =
      refs.pausedProgress > 0 ? refs.pausedTime! : refs.startTime!;
    const elapsed =
      refs.pausedProgress * refs.pathDuration +
      JulianDate.secondsDifference(now, baseTime) * pathState.speed;

    const progress = Math.min(elapsed / refs.pathDuration, 1);

    setPathState((prev) => ({ ...prev, progress: progress * 100 }));

    if (progress >= 1 || refs.isAborting) {
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
      refs.frameId = null;
      releaseCamera();
      return;
    }

    const t = refs.isReversed
      ? refs.pathDuration * (1 - progress)
      : refs.pathDuration * progress;

    const anchor = refs.positionSpline.evaluate(t);
    if (!anchor) {
      refs.frameId = requestAnimationFrame(animate);
      return;
    }

    refs.lastAnchorPosition = anchor;

    if (!refs.isUserInteracting) {
      const nextT = Math.min(t + SPLINE_TIME_STEP, refs.pathDuration);
      const next = refs.positionSpline.evaluate(nextT);

      if (next) {
        const velocity = Cartesian4.subtract(
          new Cartesian4(next.x, next.y, next.z, 1.0),
          new Cartesian4(anchor.x, anchor.y, anchor.z, 1.0),
          new Cartesian4()
        );

        if (Cartesian3.magnitude(velocity) > VELOCITY_THRESHOLD) {
          const enu = Transforms.eastNorthUpToFixedFrame(anchor);
          const local = Matrix4.multiplyByVector(
            Matrix4.inverseTransformation(enu, new Matrix4()),
            velocity,
            new Cartesian4()
          );
          refs.cameraOffset.heading = Math.atan2(local.y, local.x);
        }
      }
    }

    camera.lookAt(anchor, refs.cameraOffset);

    const points = getPoints()!;
    const index = refs.isReversed
      ? points.length - 1 - Math.floor(progress * (points.length - 1))
      : Math.floor(progress * (points.length - 1));

    setPathState((prev) => ({ ...prev, currentIndex: index }));

    refs.frameId = requestAnimationFrame(animate);
  }, [viewState, pathState.speed, getCamera, getPoints, releaseCamera]);

  // Reset function
  const resetPlayPath = useCallback(() => {
    const refs = animationRefs.current;

    if (refs.frameId) {
      cancelAnimationFrame(refs.frameId);
      refs.frameId = null;
    }

    if (viewState.isPlayingPath) {
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
    }

    Object.assign(refs, {
      frameId: null,
      startTime: null,
      pausedTime: null,
      pausedProgress: 0,
      isReversed: false,
      isInitialized: false,
      isAborting: false,
      lastAnchorPosition: null,
      positionSpline: null
    });

    // Reset state
    setPathState({
      progress: 0,
      currentIndex: 0,
      countdown: null,
      isMoving: false,
      speed: pathState.speed
    });

    releaseCamera();
  }, [viewState, pathState.speed, releaseCamera]);

  // Start path animation
  const startPathAnimation = useCallback(() => {
    const points = getPoints();
    if (!points?.length) return;

    const spline = createPathSpline(points);
    if (!spline) return;

    const refs = animationRefs.current;
    refs.positionSpline = spline;
    refs.isAborting = false;

    if (refs.pausedProgress > 0) {
      refs.pausedTime = JulianDate.now();
    } else {
      refs.startTime = JulianDate.now();
    }

    refs.frameId = requestAnimationFrame(animate);
  }, [getPoints, createPathSpline, animate]);

  // Initialize camera position
  const initializeCameraPosition = useCallback(() => {
    const points = getPoints();
    const camera = getCamera();
    if (!points?.length || !camera) return;

    const refs = animationRefs.current;
    const first = Cartographic.toCartesian(points[0]);
    const last = Cartographic.toCartesian(points[points.length - 1]);

    const distFirst = Cartesian3.distance(camera.position, first);
    const distLast = Cartesian3.distance(camera.position, last);
    refs.isReversed = distLast < distFirst;

    const startPosition = refs.isReversed ? last : first;
    camera.lookAt(startPosition, refs.cameraOffset);

    // Delay initialization for smooth camera movement
    setTimeout(() => {
      refs.isInitialized = true;
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
    }, CAMERA_SETUP_DELAY);
  }, [getPoints, getCamera, viewState]);

  const onPlay = useCallback(() => {
    const points = getPoints();
    if (!points?.length) return;

    const refs = animationRefs.current;
    const { progress } = pathState;

    // Resume from pause
    if (!viewState.isPlayingPath && progress > 0 && progress < 100) {
      refs.pausedProgress = progress / 100;
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
      return;
    }

    // Reset progress
    setPathState((prev) => ({ ...prev, progress: 0, currentIndex: 0 }));
    refs.pausedProgress = 0;
    refs.pausedTime = null;

    if (!refs.isInitialized) {
      initializeCameraPosition();
      setPathState((prev) => ({ ...prev, countdown: COUNTDOWN_DURATION }));
      return;
    }

    setPathState((prev) => ({ ...prev, countdown: COUNTDOWN_DURATION }));
  }, [getPoints, pathState, viewState, initializeCameraPosition]);

  const onPause = useCallback(() => {
    const refs = animationRefs.current;
    refs.isAborting = true;

    if (refs.frameId) {
      cancelAnimationFrame(refs.frameId);
      refs.frameId = null;
    }

    runInAction(() => {
      viewState.isPlayingPath = false;
    });
    releaseCamera();
  }, [viewState, releaseCamera]);

  const onChangePlaySpeed = useCallback(
    (newSpeed: number) => {
      const refs = animationRefs.current;

      if (viewState.isPlayingPath) {
        const now = JulianDate.now();
        const baseTime =
          refs.pausedProgress > 0 ? refs.pausedTime! : refs.startTime!;
        const elapsed =
          refs.pausedProgress * refs.pathDuration +
          JulianDate.secondsDifference(now, baseTime) * pathState.speed;

        refs.pausedProgress = Math.min(elapsed / refs.pathDuration, 1);
        refs.pausedTime = now;
        refs.startTime = now;
      }

      setPathState((prev) => ({ ...prev, speed: newSpeed }));
    },
    [viewState, pathState.speed]
  );

  // Use Effects functions
  useEffect(() => {
    if (viewState.isPlayingPath && !animationRefs.current.frameId) {
      startPathAnimation();
    }
  }, [viewState.isPlayingPath, startPathAnimation]);

  useEffect(() => {
    const { countdown } = pathState;
    if (countdown === null) return;

    if (countdown === 0) {
      setPathState((prev) => ({ ...prev, countdown: null }));
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
      return;
    }

    const timer = setTimeout(() => {
      setPathState((prev) => ({
        ...prev,
        countdown: prev.countdown ? prev.countdown - 1 : null
      }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathState.countdown, viewState, pathState]);

  useEffect(() => {
    const refs = animationRefs.current;
    return () => {
      if (refs.frameId) {
        cancelAnimationFrame(refs.frameId);
      }
      releaseCamera();
    };
  }, [releaseCamera]);

  return {
    playSpeed: pathState.speed,
    onChangePlaySpeed,
    playingPath: viewState.isPlayingPath,
    isCameraMoving: pathState.isMoving,
    countdown: pathState.countdown,
    currentPointIndex: pathState.currentIndex,
    pointsSize: getPoints()?.length,
    pathProgress: pathState.progress,
    onPlay,
    onPause,
    onStop: resetPlayPath,
    resetPlayPath,
    isPitchTooLow
  };
}
