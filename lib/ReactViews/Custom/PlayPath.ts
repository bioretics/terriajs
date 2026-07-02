import { useEffect, useRef, useState, useCallback } from "react";
import { computed, makeObservable } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
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
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import VelocityOrientationProperty from "terriajs-cesium/Source/DataSources/VelocityOrientationProperty";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityView from "terriajs-cesium/Source/DataSources/EntityView";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import { TrackingReferenceFrame } from "terriajs-cesium";
import CameraView from "../../Models/CameraView";
import CreateModel from "../../Models/Definition/CreateModel";
import MappableMixin from "../../ModelMixins/MappableMixin";
import MappableTraits from "../../Traits/TraitsClasses/MappableTraits";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import ViewerMode from "../../Models/ViewerMode";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import { reaction, runInAction } from "mobx";

type InterpolationMode = "linear" | "lagrange" | "hermite";
type TrackingReferenceFrameValue =
  typeof TrackingReferenceFrame[keyof typeof TrackingReferenceFrame];
type PathPositionGetter = (elapsedSeconds: number) => Cartesian3;

const playPathMarkerSvg =
  "data:image/svg+xml," +
  '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">' +
  '<circle cx="10" cy="10" r="5" stroke="rgb(0,170,215)" stroke-width="4" fill="white" /> ' +
  "</svg>";

function getPlayPathMarkerBillboardOptions(terria: Terria) {
  const isCesium2D = terria.mainViewer.viewerMode === ViewerMode.Cesium2D;

  if (isCesium2D) {
    return {
      image: playPathMarkerSvg,
      heightReference: HeightReference.NONE,
      eyeOffset: Cartesian3.ZERO,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    };
  }

  return {
    image: playPathMarkerSvg,
    heightReference: HeightReference.CLAMP_TO_GROUND,
    eyeOffset: new Cartesian3(0.0, 0.0, -50.0),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  };
}

class PlayPathMarkerModel extends MappableMixin(CreateModel(MappableTraits)) {
  readonly markerDataSource: CustomDataSource;

  constructor(uniqueId: string, terria: Terria) {
    super(uniqueId, terria);
    makeObservable(this);
    this.markerDataSource = new CustomDataSource("PlayPathPositionMarker");
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed get mapItems() {
    return [this.markerDataSource];
  }
}

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
  const [showPositionMarker, setShowPositionMarker] = useState(true);

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
  const showPositionMarkerRef = useRef(showPositionMarker);
  const getPositionAtElapsedRef = useRef<PathPositionGetter | null>(null);
  const markerModelRef = useRef<PlayPathMarkerModel | null>(null);
  const markerEntityRef = useRef<Entity | null>(null);
  const markerPositionRef = useRef<ConstantPositionProperty | null>(null);
  const markerPositionScratchRef = useRef(new Cartesian3());

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

  const resamplePathForFlight = useCallback(
    (
      points: Cartographic[] | undefined,
      samplingStep: number
    ): Cartographic[] | undefined => {
      if (!points || points.length === 0) return points;
      if (!(samplingStep > 0)) return points;

      const ellipsoid =
        terria.cesium?.scene?.globe?.ellipsoid ?? Ellipsoid.WGS84;
      const result: Cartographic[] = [points[0]];

      for (let i = 0; i < points.length - 1; i++) {
        const start = points[i];
        const end = points[i + 1];
        const geodesic = new EllipsoidGeodesic(start, end, ellipsoid);
        const segmentDistance = geodesic.surfaceDistance;

        if (segmentDistance > samplingStep) {
          const segmentsCount = Math.ceil(segmentDistance / samplingStep);
          for (let s = 1; s < segmentsCount; s++) {
            const fraction = s / segmentsCount;
            const interpolated = geodesic.interpolateUsingFraction(fraction);
            interpolated.height =
              start.height + (end.height - start.height) * fraction;
            result.push(interpolated);
          }
        }
        result.push(end);
      }

      return result;
    },
    [terria]
  );

  const getPoints = useCallback(() => {
    const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
    if (!geom) return;

    const pts = resamplePathForFlight(
      geom.stopPoints,
      terria.playPathSamplingStep
    );

    if (!pts || pts.length === 0) return;

    return pts;
  }, [terria, resamplePathForFlight]);

  useEffect(() => {
    startFromLastPointRef.current = startFromLastPoint;
  }, [startFromLastPoint]);

  useEffect(() => {
    showPositionMarkerRef.current = showPositionMarker;
  }, [showPositionMarker]);

  const notifyMarkerRepaint = useCallback(() => {
    terria.currentViewer.notifyRepaintRequired();
    if (terria.leaflet) {
      terria.leaflet.dataSourceDisplay.update(terria.timelineClock.currentTime);
    }
  }, [terria]);

  const updatePositionMarker = useCallback(
    (elapsedOverride?: number) => {
      const markerModel = markerModelRef.current;
      const entity = markerEntityRef.current;
      if (!markerModel || !entity) return;

      const visible = showPositionMarkerRef.current;
      markerModel.markerDataSource.show = visible;

      if (!visible) {
        notifyMarkerRepaint();
        return;
      }

      const pts = getPoints();
      if (!pts?.length) return;

      const getter = getPositionAtElapsedRef.current;
      const pausedElapsed = pausedElapsedSecondsRef.current;
      const isPlaying = viewState.isPlayingPath;
      let position: Cartesian3;

      if (
        getter &&
        (elapsedOverride !== undefined || isPlaying || pausedElapsed !== null)
      ) {
        const elapsed =
          elapsedOverride ??
          (isPlaying ? elapsedSecondsRef.current : pausedElapsed ?? 0);
        position = getter(elapsed);
      } else {
        const idx = Math.max(
          0,
          Math.min(pts.length - 1, currentPointIndexRef.current)
        );
        position = Cartographic.toCartesian(pts[idx]);
      }

      markerPositionRef.current?.setValue(position);
      notifyMarkerRepaint();
    },
    [getPoints, notifyMarkerRepaint, viewState.isPlayingPath]
  );

  const refreshMarkerBillboardForViewerMode = useCallback(() => {
    const entity = markerEntityRef.current;
    if (!entity?.billboard) return;

    entity.billboard = {
      ...getPlayPathMarkerBillboardOptions(terria)
    } as any;
    updatePositionMarker();
  }, [terria, updatePositionMarker]);

  useEffect(() => {
    const markerModel = new PlayPathMarkerModel(createGuid(), terria);
    markerModelRef.current = markerModel;
    void terria.overlays.add(markerModel);
    void markerModel.loadMapItems();

    const markerPosition = new ConstantPositionProperty(new Cartesian3());
    const markerEntity = new Entity({
      position: markerPosition,
      billboard: getPlayPathMarkerBillboardOptions(terria)
    } as any);

    markerModel.markerDataSource.show = showPositionMarkerRef.current;
    markerModel.markerDataSource.entities.add(markerEntity);

    markerEntityRef.current = markerEntity;
    markerPositionRef.current = markerPosition;
    updatePositionMarker();

    return () => {
      markerModel.markerDataSource.entities.removeAll();
      terria.overlays.remove(markerModel);
      markerModelRef.current = null;
      markerEntityRef.current = null;
      markerPositionRef.current = null;
    };
  }, [terria, updatePositionMarker]);

  useEffect(() => {
    const dispose = reaction(
      () => terria.mainViewer.viewerMode,
      () => {
        refreshMarkerBillboardForViewerMode();
      }
    );
    return () => dispose();
  }, [terria, refreshMarkerBillboardForViewerMode]);

  useEffect(() => {
    updatePositionMarker();
  }, [showPositionMarker, currentPointIndex, updatePositionMarker]);

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

    // Clear stale data BEFORE restoring camera
    lastCameraCoordsRef.current = null;
    getPositionAtElapsedRef.current = null;
    playEntityRef.current = null;

    clearAnimation();
    restoreCameraAfterTracking();
    updatePositionMarker();
  }, [
    getPoints,
    viewState,
    setPlayingPathState,
    restoreCameraAfterTracking,
    clearAnimation,
    updatePositionMarker
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

    getPositionAtElapsedRef.current = (elapsedSeconds: number) => {
      const clamped = Math.min(totalDuration, Math.max(0, elapsedSeconds));
      JulianDate.addSeconds(sampleStart, clamped, timeScratchRef.current);
      return (positionProperty as any).getValue(
        timeScratchRef.current,
        markerPositionScratchRef.current
      ) as Cartesian3;
    };

    const runCameraStepPath = async () => {
      playEntityRef.current = null;
      lastCameraCoordsRef.current = null;
      const initialIdx = Math.max(
        0,
        Math.min(pts.length - 1, currentPointIndexRef.current)
      );
      const initialOrderPos = orderPosByIndex[initialIdx] ?? 0;
      const resumeElapsed = pausedElapsedSecondsRef.current;
      const startElapsed =
        resumeElapsed !== null
          ? resumeElapsed
          : sampleSeconds[Math.max(0, Math.min(n - 1, initialOrderPos))] ?? 0;

      pausedElapsedSecondsRef.current = null;
      elapsedSecondsRef.current = Math.min(
        totalDuration,
        Math.max(0, startElapsed)
      );

      const isLeafletViewer = viewer.type === "Leaflet";
      const isCesium2D = terria.mainViewer.viewerMode === ViewerMode.Cesium2D;
      const camera = isLeafletViewer ? undefined : cesiumModel?.scene.camera;
      const followCameraToPosition = (position: Cartesian3) => {
        if (isLeafletViewer) {
          const leafletMap = terria.leaflet?.map;
          if (!leafletMap) return;

          const carto = Cartographic.fromCartesian(position);
          leafletMap.panTo(
            [
              CesiumMath.toDegrees(carto.latitude),
              CesiumMath.toDegrees(carto.longitude)
            ],
            { animate: false }
          );
          return;
        }

        if (isCesium2D && camera) {
          const carto = Cartographic.fromCartesian(position);
          const destination = Cartographic.toCartesian(
            new Cartographic(
              carto.longitude,
              carto.latitude,
              camera.positionCartographic.height || 1000
            )
          );

          camera.setView({
            destination,
            orientation: {
              heading: camera.heading,
              pitch: camera.pitch,
              roll: camera.roll
            }
          });
        }
      };

      const stepToElapsedPosition = () => {
        if (!abortPlayingPathRef.current) {
          return;
        }

        const speed = Math.max(0.01, playSpeedRef.current);
        const now = performance.now();
        const last = lastFramePerfRef.current ?? now;
        lastFramePerfRef.current = now;
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));

        elapsedSecondsRef.current = Math.min(
          totalDuration,
          elapsedSecondsRef.current + dt * speed
        );

        const clampedElapsed = Math.min(
          totalDuration,
          Math.max(0, elapsedSecondsRef.current)
        );
        const currentPosition =
          getPositionAtElapsedRef.current?.(clampedElapsed);

        if (currentPosition) {
          followCameraToPosition(currentPosition);
        }

        if (showPositionMarkerRef.current) {
          updatePositionMarker(clampedElapsed);
        }

        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
          const mid = Math.floor((lo + hi + 1) / 2);
          if (sampleSeconds[mid] <= clampedElapsed) lo = mid;
          else hi = mid - 1;
        }

        const idx = orderIndices[lo] ?? 0;
        if (lastReportedPointIndexRef.current !== idx) {
          lastReportedPointIndexRef.current = idx;
          setCurrentPointIndex(idx);
        }

        viewer.notifyRepaintRequired();

        if (clampedElapsed < totalDuration) {
          rafIdRef.current = requestAnimationFrame(stepToElapsedPosition);
        } else {
          abortPlayingPathRef.current = false;
          pausedElapsedSecondsRef.current = null;
          setPlayingPathState(false);
        }
      };

      lastFramePerfRef.current = performance.now();

      const initialPosition = getPositionAtElapsedRef.current?.(
        elapsedSecondsRef.current
      );
      if (initialPosition) {
        followCameraToPosition(initialPosition);
      }

      updatePositionMarker(elapsedSecondsRef.current);
      rafIdRef.current = requestAnimationFrame(stepToElapsedPosition);
      return;
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
    updatePositionMarker(elapsedSecondsRef.current);

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

      if (showPositionMarkerRef.current) {
        updatePositionMarker(clampedElapsed);
      }

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
        updatePositionMarker(totalDuration);
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
    setPlayingPathState,
    updatePositionMarker
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
    updatePositionMarker(pausedElapsedSecondsRef.current);
  };

  const onStop = () => {
    abortPlayingPathRef.current = false;
    clearAnimation();
    (terria.cesium?.scene.camera as any)?.cancelFlight?.();
    restoreCameraAfterTracking();
    playEntityRef.current = null;
    lastReportedPointIndexRef.current = null;
    lastCameraCoordsRef.current = null;
    getPositionAtElapsedRef.current = null;
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
    updatePositionMarker();
    terria.currentViewer.notifyRepaintRequired();
  };

  const changePlayPathSamplingStep = useCallback(
    (val: number) => {
      runInAction(() => {
        terria.playPathSamplingStep = val;
      });
      resetPlayPath();
    },
    [terria, resetPlayPath]
  );

  useEffect(() => {
    if (viewState.isPlayingPath) playPath();
  }, [viewState.isPlayingPath, playPath]);

  // Handle stopping the playpath when isPlayingPath becomes false
  useEffect(() => {
    if (!viewState.isPlayingPath) {
      abortPlayingPathRef.current = false;
      clearAnimation();
      (terria.cesium?.scene.camera as any)?.cancelFlight?.();
      restoreCameraAfterTracking();

      // Remove the marker when playpath is stopped
      const markerModel = markerModelRef.current;
      if (markerModel) {
        markerModel.markerDataSource.entities.removeAll();
        terria.overlays.remove(markerModel);
        markerModelRef.current = null;
        markerEntityRef.current = null;
        markerPositionRef.current = null;
      }
    }
  }, [
    viewState.isPlayingPath,
    clearAnimation,
    restoreCameraAfterTracking,
    terria
  ]);

  return {
    playSpeed,
    setPlaySpeed,
    interpolationMode,
    setInterpolationMode,
    trackingReferenceFrame,
    setTrackingReferenceFrame,
    startFromLastPoint,
    setStartFromLastPoint,
    showPositionMarker,
    setShowPositionMarker,
    playingPath: viewState.isPlayingPath,
    isCameraMoving,
    countdown,
    currentPointIndex,
    pointsSize: getPoints()?.length,
    onPlay,
    onPause,
    onStop,
    resetPlayPath,
    playPathSamplingStep: terria.playPathSamplingStep,
    changePlayPathSamplingStep
  };
}
