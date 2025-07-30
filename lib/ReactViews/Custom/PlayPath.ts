import { useEffect, useRef, useState, useCallback } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import CatmullRomSpline from "terriajs-cesium/Source/Core/CatmullRomSpline";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import { runInAction } from "mobx";
import { Matrix4, Transforms } from "terriajs-cesium";
import Cartesian4 from "terriajs-cesium/Source/Core/Cartesian4";

export default function usePlayPath(terria: Terria, viewState: ViewState) {
  const MIN_PITCH = Math.PI / 4;

  const [playSpeed, setPlaySpeed] = useState(1);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loadPercentage, setLoadPercentage] = useState(0);
  const [pathProgress, setPathProgress] = useState(0);

  const reverseRef = useRef(false);
  const playSpeedRef = useRef(playSpeed);
  const abortPlayingPathRef = useRef(false);
  const loadPercentageRef = useRef(loadPercentage);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<JulianDate | null>(null);
  const positionSplineRef = useRef<CatmullRomSpline | null>(null);
  const pathDurationRef = useRef(0);
  const userCameraOffsetRef = useRef<HeadingPitchRange>(
    new HeadingPitchRange(0, -CesiumMath.PI_OVER_FOUR, 1000)
  );
  const isUserInteractingRef = useRef(false);
  const lastAnchorPositionRef = useRef<Cartesian3 | null>(null);
  const pausedProgressRef = useRef(0);
  const pausedTimeRef = useRef<JulianDate | null>(null);

  const isPitchTooLow = useCallback(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return false;
    return Math.abs(camera.pitch ?? 0) < MIN_PITCH;
  }, [terria, MIN_PITCH]);

  const releaseCamera = useCallback(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const controller = terria.cesium?.scene.screenSpaceCameraController;
    if (controller) {
      controller.enableRotate = true;
      controller.enableTranslate = true;
      controller.enableZoom = true;
      controller.enableTilt = true;
      controller.enableLook = true;
    }

    camera.lookAtTransform(Matrix4.IDENTITY);
  }, [terria]);

  const resetPlayPath = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (viewState.isPlayingPath) {
      abortPlayingPathRef.current = false;
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
    }

    releaseCamera();

    setCurrentPointIndex(0);
    setCountdown(null);
    setIsCameraMoving(false);
    setPathProgress(0);
    startTimeRef.current = null;
    positionSplineRef.current = null;
    lastAnchorPositionRef.current = null;
    pausedProgressRef.current = 0;
    pausedTimeRef.current = null;
  }, [viewState, releaseCamera]);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;
    const pts = geom.stopPoints;
    if (!pts || pts.length === 0) return;
    return pts;
  }, [terria]);

  const createPathSpline = useCallback((points: Cartographic[]) => {
    if (points.length < 2) return null;

    const cartesians = points.map((p) => Cartographic.toCartesian(p));
    const times: number[] = [];
    let totalDistance = 0;

    for (let i = 0; i < cartesians.length; i++) {
      if (i === 0) {
        times.push(0);
      } else {
        totalDistance += Cartesian3.distance(cartesians[i - 1], cartesians[i]);
        times.push(totalDistance);
      }
    }

    const duration = totalDistance / 100;
    pathDurationRef.current = duration;

    for (let i = 0; i < times.length; i++) {
      times[i] = (times[i] / totalDistance) * duration;
    }

    let firstTangent, lastTangent;

    if (cartesians.length > 2) {
      firstTangent = new Cartesian3();
      Cartesian3.subtract(cartesians[1], cartesians[0], firstTangent);
      Cartesian3.multiplyByScalar(firstTangent, 0.5, firstTangent);

      lastTangent = new Cartesian3();
      const lastIdx = cartesians.length - 1;
      Cartesian3.subtract(
        cartesians[lastIdx],
        cartesians[lastIdx - 1],
        lastTangent
      );
      Cartesian3.multiplyByScalar(lastTangent, 0.5, lastTangent);
    }

    return new CatmullRomSpline({
      times: times,
      points: cartesians,
      firstTangent: firstTangent,
      lastTangent: lastTangent
    });
  }, []);

  useEffect(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const onCameraMove = () => {
      if (
        !lastAnchorPositionRef.current ||
        !isUserInteractingRef.current ||
        !viewState.isPlayingPath
      )
        return;

      const offset = new Cartesian3();
      Cartesian3.subtract(
        camera.position,
        lastAnchorPositionRef.current,
        offset
      );

      const enu = Transforms.eastNorthUpToFixedFrame(
        lastAnchorPositionRef.current
      );
      const inverseEnu = Matrix4.inverseTransformation(enu, new Matrix4());
      const localOffset = Matrix4.multiplyByPoint(
        inverseEnu,
        camera.position,
        new Cartesian3()
      );

      const distance = Cartesian3.magnitude(localOffset);
      const heading =
        Math.atan2(localOffset.y, localOffset.x) - CesiumMath.PI_OVER_TWO;
      const pitch = Math.asin(localOffset.z / distance);

      userCameraOffsetRef.current = new HeadingPitchRange(
        heading,
        pitch,
        distance
      );
    };

    const onMoveStart = () => {
      if (viewState.isPlayingPath) {
        isUserInteractingRef.current = true;
      }
    };

    const onMoveEnd = () => {
      isUserInteractingRef.current = false;
      if (viewState.isPlayingPath) {
        onCameraMove();
      }
    };

    camera.moveStart?.addEventListener(onMoveStart);
    camera.moveEnd?.addEventListener(onMoveEnd);

    return () => {
      camera.moveStart?.removeEventListener(onMoveStart);
      camera.moveEnd?.removeEventListener(onMoveEnd);
    };
  }, [terria, viewState.isPlayingPath]);

  useEffect(() => {
    terria.tileLoadProgressEvent.addEventListener(
      (remaining: number, max: number) => {
        const raw = (1 - remaining / max) * 100;
        const percentage =
          remaining === 0 || isNaN(raw) ? 100 : Math.min(100, Math.floor(raw));
        loadPercentageRef.current = percentage;
        setLoadPercentage(percentage);
      }
    );

    return () => {
      terria.tileLoadProgressEvent.removeEventListener(() => {});
      terria.indeterminateTileLoadProgressEvent.removeEventListener(() => {});
    };
  }, [terria]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      const camera = terria.cesium?.scene.camera;
      const pts = getPoints();
      if (camera && pts && pts.length > 0) {
        const firstCartesian = Cartographic.toCartesian(pts[0]);
        const lastCartesian = Cartographic.toCartesian(pts[pts.length - 1]);
        const camPos = camera.position;
        const distFirst = Cartesian3.distance(camPos, firstCartesian);
        const distLast = Cartesian3.distance(camPos, lastCartesian);
        reverseRef.current = distLast < distFirst;
        const startCartesian = reverseRef.current
          ? lastCartesian
          : firstCartesian;
        const offset = userCameraOffsetRef.current;
        camera.lookAt(startCartesian, offset);
      }
      setTimeout(() => {
        runInAction(() => {
          viewState.isPlayingPath = true;
        });
      }, 2000);
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, viewState, getPoints, terria.cesium?.scene.camera]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  const animate = useCallback(() => {
    if (
      !viewState.isPlayingPath ||
      !positionSplineRef.current ||
      !startTimeRef.current
    ) {
      return;
    }

    const scene = terria.cesium?.scene;
    const camera = scene?.camera;
    if (!camera) return;

    const currentTime = JulianDate.now();
    let elapsed: number;

    if (pausedProgressRef.current > 0) {
      const timeSincePause = JulianDate.secondsDifference(
        currentTime,
        pausedTimeRef.current || currentTime
      );
      elapsed =
        pausedProgressRef.current * pathDurationRef.current +
        timeSincePause * playSpeedRef.current;
    } else {
      elapsed =
        JulianDate.secondsDifference(currentTime, startTimeRef.current) *
        playSpeedRef.current;
    }

    const progress = Math.min(elapsed / pathDurationRef.current, 1.0);

    setPathProgress(progress * 100);

    if (progress >= 1.0 || abortPlayingPathRef.current) {
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
      animationFrameRef.current = null;
      releaseCamera();
      return;
    }

    const splineTime = reverseRef.current
      ? pathDurationRef.current * (1 - progress)
      : progress * pathDurationRef.current;
    const anchorPosition = positionSplineRef.current.evaluate(splineTime);
    lastAnchorPositionRef.current = anchorPosition;

    if (!anchorPosition) {
      animationFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    const dt = 0.001;
    const nextTime = Math.min(splineTime + dt, pathDurationRef.current);
    const nextPosition = positionSplineRef.current.evaluate(nextTime);

    let heading = userCameraOffsetRef.current.heading;

    if (nextPosition && !isUserInteractingRef.current) {
      const velocity = new Cartesian4();
      Cartesian3.subtract(nextPosition, anchorPosition, velocity);

      if (Cartesian3.magnitude(velocity) > 0.001) {
        const enu = Transforms.eastNorthUpToFixedFrame(anchorPosition);
        const inverseEnu = Matrix4.inverseTransformation(enu, new Matrix4());
        const localVelocity = Matrix4.multiplyByVector(
          inverseEnu,
          velocity,
          new Cartesian4()
        );

        heading = Math.atan2(localVelocity.y, localVelocity.x);
        userCameraOffsetRef.current.heading = heading;
      }
    }

    camera.lookAt(anchorPosition, userCameraOffsetRef.current);

    const points = getPoints();
    if (points) {
      const estimatedIndex = reverseRef.current
        ? points.length - 1 - Math.floor(progress * (points.length - 1))
        : Math.floor(progress * (points.length - 1));
      setCurrentPointIndex(estimatedIndex);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [terria, viewState, getPoints, releaseCamera]);

  const playPath = useCallback(async () => {
    const pts = getPoints();
    if (!pts?.length) return;

    const spline = createPathSpline(pts);
    if (!spline) return;

    positionSplineRef.current = spline;

    if (pausedProgressRef.current > 0) {
      pausedTimeRef.current = JulianDate.now();
    } else {
      startTimeRef.current = JulianDate.now();
      pausedProgressRef.current = 0;
    }

    abortPlayingPathRef.current = false;

    animate();
  }, [getPoints, createPathSpline, animate]);

  const onPlay = () => {
    const pts = getPoints();
    if (!pts?.length) return;

    if (!viewState.isPlayingPath && pathProgress > 0 && pathProgress < 100) {
      pausedProgressRef.current = pathProgress / 100;
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
      return;
    }

    setPathProgress(0);
    setCurrentPointIndex(0);
    pausedProgressRef.current = 0;
    pausedTimeRef.current = null;
    setCountdown(3);
  };

  const onPause = () => {
    abortPlayingPathRef.current = true;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    pausedProgressRef.current = pathProgress / 100;

    runInAction(() => {
      viewState.isPlayingPath = false;
    });

    releaseCamera();
  };

  const onStop = () => {
    resetPlayPath();
  };

  useEffect(() => {
    if (viewState.isPlayingPath && !animationFrameRef.current) {
      playPath();
    }
  }, [viewState.isPlayingPath, playPath]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      releaseCamera();
    };
  }, [releaseCamera]);

  return {
    playSpeed,
    setPlaySpeed,
    playingPath: viewState.isPlayingPath,
    isCameraMoving,
    countdown,
    currentPointIndex,
    pointsSize: getPoints()?.length,
    pathProgress,
    onPlay,
    onPause,
    onStop,
    resetPlayPath,
    isPitchTooLow
  };
}
