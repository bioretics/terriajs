import { useEffect, useRef } from "react";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import { observer } from "mobx-react";
import isDefined from "../../Core/isDefined";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import MeasurablePanelManager from "../Custom/MeasurablePanelManager";

interface Props {
  terria: Terria;
  viewState: ViewState;
  measurablePanelIsVisible: boolean;
  onHighlightedRowChange: (idx: number | null) => void;
}

const MeasurableMouseProximity = observer((props: Props) => {
  const {
    terria,
    viewState,
    measurablePanelIsVisible,
    onHighlightedRowChange
  } = props;

  const currentGeom = terria.measurableGeomList[terria.measurableGeometryIndex];
  const lastMarkerRef = useRef<Cartographic | null>(null);

  useEffect(() => {
    if (!measurablePanelIsVisible) return;

    const handleMouseProximity = () => {
      const mouseCoords = terria.currentViewer.mouseCoords.cartographic;
      if (
        !mouseCoords ||
        !terria.measurableGeomList ||
        !terria.measurableGeomList[terria.measurableGeometryIndex]
      )
        return;

      const getDynamicProximityMeters = (): number => {
        const fallbackMeters = 150;
        if (!terria?.cesium) return fallbackMeters;

        const { scene } = terria.cesium;
        const canvas = scene.canvas;
        const centerX = Math.floor(canvas.clientWidth / 2);
        const centerY = Math.floor(canvas.clientHeight / 2);

        const leftRay = scene.camera.getPickRay(
          new Cartesian2(centerX, centerY)
        );
        const rightRay = scene.camera.getPickRay(
          new Cartesian2(centerX + 1, centerY)
        );
        if (!isDefined(leftRay) || !isDefined(rightRay)) return fallbackMeters;

        const globe = scene.globe;
        const leftPosition = globe.pick(leftRay, scene);
        const rightPosition = globe.pick(rightRay, scene);
        if (!isDefined(leftPosition) || !isDefined(rightPosition))
          return fallbackMeters;

        const metersPerPixel = Cartesian3.distance(leftPosition, rightPosition);
        const proximityPixels = 8;
        const minProximityMeters = 1;
        const maxProximityMeters = 25000;
        const proximityMeters = metersPerPixel * proximityPixels;

        return Math.min(
          maxProximityMeters,
          Math.max(minProximityMeters, proximityMeters)
        );
      };

      const findNearestPointInRange = (
        points: Cartographic[],
        proximityMeters: number
      ): { point: Cartographic; idx: number } | null => {
        if (!points.length) return null;

        const ellipsoid = terria?.cesium?.scene?.globe?.ellipsoid;
        if (!ellipsoid) return null;

        const mouseCartesian = Cartographic.toCartesian(mouseCoords, ellipsoid);
        if (!isDefined(mouseCartesian)) return null;

        let nearestPoint: Cartographic | null = null;
        let nearestIdx: number | null = null;
        let nearestDistanceSquared = Number.POSITIVE_INFINITY;
        const proximityMetersSquared = proximityMeters * proximityMeters;

        points.forEach((point, idx) => {
          const pointCartesian = Cartographic.toCartesian(point, ellipsoid);
          if (!isDefined(pointCartesian)) return;

          const distanceSquared = Cartesian3.distanceSquared(
            mouseCartesian,
            pointCartesian
          );
          if (
            distanceSquared <= proximityMetersSquared &&
            distanceSquared < nearestDistanceSquared
          ) {
            nearestDistanceSquared = distanceSquared;
            nearestPoint = point;
            nearestIdx = idx;
          }
        });

        if (nearestPoint && nearestIdx !== null) {
          return {
            point: nearestPoint,
            idx: nearestIdx
          };
        }

        return null;
      };

      const currentGeometry =
        terria.measurableGeomList[terria.measurableGeometryIndex];
      const proximityMeters = getDynamicProximityMeters();
      const clearProximityMeters = proximityMeters * 1.5;

      const sampledNearby =
        currentGeometry?.onlyPoints === false
          ? findNearestPointInRange(
              currentGeometry.sampledPoints ?? [],
              proximityMeters
            )
          : null;

      if (sampledNearby) {
        viewState.setSelectedSampledPointIdx(sampledNearby.idx);
      } else {
        viewState.setSelectedSampledPointIdx(null);
      }

      const stopNearby = findNearestPointInRange(
        currentGeometry.stopPoints ?? [],
        proximityMeters
      );

      if (stopNearby) {
        onHighlightedRowChange(stopNearby.idx);
        viewState.setSelectedStopPointIdx(stopNearby.idx);
      } else {
        onHighlightedRowChange(null);
        viewState.setSelectedStopPointIdx(null);
      }

      const markerPoint = stopNearby?.point ?? sampledNearby?.point;

      const stopFar = findNearestPointInRange(
        currentGeometry.stopPoints ?? [],
        clearProximityMeters
      );

      const sampledFar =
        currentGeometry?.onlyPoints === false
          ? findNearestPointInRange(
              currentGeometry.sampledPoints ?? [],
              clearProximityMeters
            )
          : null;

      const mouseDefinitelyOutside = !stopFar && !sampledFar;
      console.log(viewState.measurableChartIsHovered);
      if (markerPoint) {
        lastMarkerRef.current = markerPoint;
        MeasurablePanelManager.addMarker(markerPoint);
      } else if (
        mouseDefinitelyOutside &&
        !viewState.measurableChartIsHovered
      ) {
        lastMarkerRef.current = null;
        MeasurablePanelManager.removeAllMarkers();
      }

      terria.currentViewer.notifyRepaintRequired();
    };

    let animationFrameId: number | null = null;

    const scheduleMouseProximity = () => {
      if (animationFrameId !== null) return;

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        handleMouseProximity();
      });
    };

    const disposer =
      terria.currentViewer.mouseCoords.updateEvent.addEventListener(
        scheduleMouseProximity
      );

    return () => {
      disposer();
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    viewState,
    terria.cesium,
    terria.currentViewer,
    terria.measurableGeomList,
    terria.measurableGeometryIndex,
    currentGeom,
    measurablePanelIsVisible,
    onHighlightedRowChange
  ]);

  return null;
});

export default MeasurableMouseProximity;
