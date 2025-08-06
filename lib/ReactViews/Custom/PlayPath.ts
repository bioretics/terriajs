import { useEffect, useRef, useState, useCallback } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import HeadingPitchRange from "terriajs-cesium/Source/Core/HeadingPitchRange";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import CameraView from "../../Models/CameraView";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import { runInAction } from "mobx";

export default function usePlayPath(terria: Terria, viewState: ViewState) {
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const distRef = useRef(0);
  const startIdxRef = useRef(0);
  const reverseRef = useRef(false);
  const playSpeedRef = useRef(playSpeed);
  const abortPlayingPathRef = useRef(false);
  const currentPointIndexRef = useRef(currentPointIndex);

  const resetPlayPath = useCallback(() => {
    if (viewState.isPlayingPath) {
      abortPlayingPathRef.current = false;
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
    }

    setCurrentPointIndex(0);
    setCountdown(null);
    setIsCameraMoving(false);
    setIsNavigating(false);
    startIdxRef.current = 0;
    reverseRef.current = false;
    currentPointIndexRef.current = 0;
  }, [viewState]);

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;
    const pts = terria.cesium ? geom.sampledPoints : geom.stopPoints;
    return pts;
  }, [terria]);

  const getStopPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;
    return geom.stopPoints;
  }, [terria]);

  const navigateToPoint = useCallback(
    async (pointIndex: number, useStopPointsOnly = false) => {
      if (isNavigating) {
        return;
      }

      const pts = useStopPointsOnly ? getStopPoints() : getPoints();
      const camera = terria.cesium?.scene.camera;

      if (
        !pts?.length ||
        !camera ||
        pointIndex < 0 ||
        pointIndex >= pts.length
      ) {
        console.warn("Invalid navigation parameters", {
          pointIndex,
          ptsLength: pts?.length
        });
        return;
      }

      try {
        setIsNavigating(true);

        const point = pts[pointIndex];
        const cartesian = Cartographic.toCartesian(point);
        const currentDist = Cartesian3.distance(camera.position, cartesian);
        const pitch = camera.pitch ?? 0;

        let hpr: HeadingPitchRange | undefined;

        if (pts.length > 1) {
          let neighborIdx: number;

          if (pointIndex === 0 && pts.length > 1) {
            neighborIdx = 1;
          } else if (pointIndex === pts.length - 1 && pts.length > 1) {
            neighborIdx = pts.length - 2;
          } else {
            neighborIdx = pointIndex + 1;
          }

          const heading =
            (new EllipsoidGeodesic(point, pts[neighborIdx]).startHeading +
              CesiumMath.TWO_PI) %
            CesiumMath.TWO_PI;
          hpr = new HeadingPitchRange(heading, -pitch, currentDist);
        }

        const duration = 2 / playSpeedRef.current;

        const navigationPromise = terria.currentViewer.doZoomTo(
          hpr
            ? CameraView.fromLookAt(point, hpr)
            : Rectangle.fromCartographicArray([point]),
          duration
        );

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Navigation timeout")),
            duration * 1000 + 2000
          );
        });

        await Promise.race([navigationPromise, timeoutPromise]);

        setCurrentPointIndex(pointIndex);
        currentPointIndexRef.current = pointIndex;
        terria.currentViewer.notifyRepaintRequired();
      } catch (error) {
        console.error("Navigation error:", error);
      } finally {
        setIsNavigating(false);
      }
    },
    [getPoints, getStopPoints, terria, isNavigating]
  );

  const onPrevious = useCallback(async () => {
    const pts = getStopPoints();
    if (!pts?.length || currentPointIndex <= 0 || isNavigating) {
      return;
    }

    const newIndex = currentPointIndex - 1;
    try {
      await navigateToPoint(newIndex, true);
    } catch (error) {
      console.error("Previous navigation failed:", error);
    }
  }, [currentPointIndex, getStopPoints, navigateToPoint, isNavigating]);

  const onNext = useCallback(async () => {
    const pts = getStopPoints();
    if (!pts?.length || currentPointIndex >= pts.length - 1 || isNavigating) {
      return;
    }

    const newIndex = currentPointIndex + 1;
    try {
      await navigateToPoint(newIndex, true);
    } catch (error) {
      console.error("Next navigation failed:", error);
    }
  }, [currentPointIndex, getStopPoints, navigateToPoint, isNavigating]);

  const isPreviousDisabled = useCallback(() => {
    const pts = getStopPoints();
    return (
      !pts?.length ||
      currentPointIndex <= 0 ||
      viewState.isPlayingPath ||
      isCameraMoving ||
      isNavigating
    );
  }, [
    currentPointIndex,
    getStopPoints,
    viewState.isPlayingPath,
    isCameraMoving,
    isNavigating
  ]);

  const isNextDisabled = useCallback(() => {
    const pts = getStopPoints();
    return (
      !pts?.length ||
      currentPointIndex >= pts.length - 1 ||
      viewState.isPlayingPath ||
      isCameraMoving ||
      isNavigating
    );
  }, [
    currentPointIndex,
    getStopPoints,
    viewState.isPlayingPath,
    isCameraMoving,
    isNavigating
  ]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, viewState]);

  useEffect(() => {
    currentPointIndexRef.current = currentPointIndex;
  }, [currentPointIndex]);

  useEffect(() => {
    playSpeedRef.current = playSpeed;
  }, [playSpeed]);

  useEffect(() => {
    const camera = terria.cesium?.scene.camera;
    if (!camera) return;

    const updateDist = () => {
      const pts = getPoints();
      if (!pts?.length) return;
      const cartesians = pts.map((p) => Cartographic.toCartesian(p));
      const idx = currentPointIndexRef.current;
      if (idx < cartesians.length) {
        distRef.current = Cartesian3.distance(camera.position, cartesians[idx]);
      }
      setIsCameraMoving(false);
    };

    const onMoveStart = () => {
      setIsCameraMoving(true);
    };

    camera.moveStart?.addEventListener(onMoveStart);
    camera.moveEnd.addEventListener(updateDist);

    return () => {
      camera.moveStart?.removeEventListener(onMoveStart);
      camera.moveEnd.removeEventListener(updateDist);
    };
  }, [getPoints, terria, viewState]);

  const playPath = useCallback(async () => {
    abortPlayingPathRef.current = true;
    const pts = getPoints();
    if (!pts?.length) return;
    const scene = terria.cesium?.scene;
    const camera = scene?.camera;
    const viewer = terria.currentViewer;
    const cartesians = pts.map((p) => Cartographic.toCartesian(p));
    const useLookAt = Boolean(camera && cartesians.length);
    const pitch = camera?.pitch ?? 0;
    const initialIdx = currentPointIndexRef.current;
    const dist = camera
      ? Cartesian3.distance(camera.position, cartesians[initialIdx])
      : 1000;

    const isResume = initialIdx !== startIdxRef.current;

    const waitForRender = () =>
      new Promise<boolean>((resolve) => {
        const handler = () => {
          scene?.postRender.removeEventListener(handler);
          resolve(true);
        };
        scene?.postRender.addEventListener(handler);
      });

    const waitForAbort = () =>
      new Promise<boolean>((resolve) => {
        const check = () => {
          if (!abortPlayingPathRef.current) {
            resolve(false);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

    const tryStep = async (i: number) => {
      const duration = 3 / playSpeedRef.current;
      let hpr: HeadingPitchRange | undefined;
      if (
        useLookAt &&
        ((i < pts.length - 1 && !reverseRef.current) ||
          (reverseRef.current && i > 0))
      ) {
        const next = reverseRef.current ? pts[i - 1] : pts[i + 1];
        const heading =
          (new EllipsoidGeodesic(pts[i], next).startHeading +
            CesiumMath.TWO_PI) %
          CesiumMath.TWO_PI;
        hpr = new HeadingPitchRange(heading, -pitch, dist);
      }

      try {
        await viewer.doZoomTo(
          useLookAt && hpr
            ? CameraView.fromLookAt(pts[i], hpr)
            : Rectangle.fromCartographicArray([pts[i]]),
          duration
        );
        const rendered = await Promise.race([waitForRender(), waitForAbort()]);
        return rendered;
      } catch (error) {
        console.error("PlayPath step error:", error);
        return false;
      }
    };

    const loop = async (start: number, end: number, step: number) => {
      for (let i = start; abortPlayingPathRef.current && i !== end; i += step) {
        if (!(isResume && i === currentPointIndexRef.current)) {
          const ok = await tryStep(i);
          if (!ok) break;
        }

        const nextIndex = i + step;

        if (nextIndex === end || nextIndex < 0 || nextIndex >= pts.length) {
          const finalIndex = step > 0 ? pts.length - 1 : 0;
          setCurrentPointIndex(finalIndex);
          break;
        }

        setCurrentPointIndex(nextIndex);
        viewer.notifyRepaintRequired();
      }
    };

    try {
      if (!reverseRef.current) {
        await loop(currentPointIndexRef.current, pts.length, 1);
      } else {
        const lastIdx = pts.length - 1;
        await loop(Math.min(currentPointIndexRef.current, lastIdx), -1, -1);
      }
    } catch (error) {
      console.error("PlayPath error:", error);
    } finally {
      runInAction(() => {
        viewState.isPlayingPath = false;
      });
    }
  }, [getPoints, terria, viewState]);

  const onPlay = () => {
    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (!pts?.length || !camera) return;

    if (
      !viewState.isPlayingPath &&
      !(currentPointIndex === 0 || currentPointIndex === pts.length - 1)
    ) {
      runInAction(() => {
        viewState.isPlayingPath = true;
      });
      return;
    }
    const cartesian = pts.map((p) => Cartographic.toCartesian(p));
    const distFirst = Cartesian3.distance(camera.position, cartesian[0]);
    const distLast = Cartesian3.distance(camera.position, cartesian.at(-1)!);
    reverseRef.current = distFirst > distLast;
    startIdxRef.current = reverseRef.current ? pts.length - 1 : 0;
    setCurrentPointIndex(startIdxRef.current);
    setCountdown(3);
  };

  const onPause = () => {
    abortPlayingPathRef.current = false;
    runInAction(() => {
      viewState.isPlayingPath = false;
    });
  };

  const onStop = () => {
    abortPlayingPathRef.current = false;
    runInAction(() => {
      viewState.isPlayingPath = false;
    });
    const pts = getPoints();
    const camera = terria.cesium?.scene.camera;
    if (!pts?.length || !camera) return;
    const targetIdx = startIdxRef.current;
    reverseRef.current = startIdxRef.current === pts.length - 1;
    const point = pts[targetIdx];
    const dist = Cartesian3.distance(
      camera.position,
      Cartographic.toCartesian(point)
    );
    const pitch = camera.pitch ?? 0;
    let hpr: HeadingPitchRange | undefined;
    if (pts.length > 1) {
      const neighborIdx = reverseRef.current ? targetIdx - 1 : targetIdx + 1;
      const heading =
        (new EllipsoidGeodesic(point, pts[neighborIdx]).startHeading +
          CesiumMath.TWO_PI) %
        CesiumMath.TWO_PI;
      hpr = new HeadingPitchRange(heading, -pitch, dist);
    }
    const duration = 3 / playSpeedRef.current;

    try {
      terria.currentViewer.doZoomTo(
        hpr
          ? CameraView.fromLookAt(point, hpr)
          : Rectangle.fromCartographicArray([point]),
        duration
      );
      setCurrentPointIndex(targetIdx);
      terria.currentViewer.notifyRepaintRequired();
    } catch (error) {
      console.error("Stop navigation error:", error);
    }
  };

  useEffect(() => {
    if (viewState.isPlayingPath) playPath();
  }, [viewState.isPlayingPath, playPath]);

  return {
    playSpeed,
    setPlaySpeed,
    playingPath: viewState.isPlayingPath,
    isCameraMoving,
    countdown,
    currentPointIndex,
    pointsSize: getStopPoints()?.length,
    onPlay,
    onPause,
    onStop,
    resetPlayPath,
    onPrevious,
    onNext,
    isPreviousDisabled,
    isNextDisabled,
    navigateToPoint
  };
}
