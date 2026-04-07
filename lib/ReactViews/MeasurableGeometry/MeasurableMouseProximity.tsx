import { useEffect } from "react";
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

      const getDynamicRangeThreshold = (): number => {
        const fallback = 0.000025;
        if (!terria?.cesium) return fallback;

        const { scene } = terria.cesium;
        const canvas = scene.canvas;
        const centerX = Math.floor(canvas.clientWidth / 2);
        const bottomY = canvas.clientHeight - 1;

        const leftRay = scene.camera.getPickRay(
          new Cartesian2(centerX, bottomY)
        );
        const rightRay = scene.camera.getPickRay(
          new Cartesian2(centerX + 1, bottomY)
        );
        if (!isDefined(leftRay) || !isDefined(rightRay)) return fallback;

        const globe = scene.globe;
        const leftPosition = globe.pick(leftRay, scene);
        const rightPosition = globe.pick(rightRay, scene);
        if (!isDefined(leftPosition) || !isDefined(rightPosition))
          return fallback;

        const distance = Cartesian3.distance(leftPosition, rightPosition);
        const proximityPixels = 5;
        const proximityMeters = distance * proximityPixels;
        const earthRadius = 6372797;

        const threshold = proximityMeters / earthRadius;
        return Math.max(threshold, fallback);
      };

      const findNearbyPoint = (
        points: Cartographic[],
        action: (point: Cartographic | null, idx: number | null) => void
      ) => {
        const rangeThreshold = getDynamicRangeThreshold();

        const nearbyPoint = points.find((point) => {
          const latDiff = Math.abs(mouseCoords.latitude - point.latitude);
          const lonDiff = Math.abs(mouseCoords.longitude - point.longitude);
          return latDiff <= rangeThreshold && lonDiff <= rangeThreshold;
        });

        if (nearbyPoint) {
          const idx = points.indexOf(nearbyPoint);
          action(nearbyPoint, idx);
        } else {
          action(null, null);
        }
      };

      if (
        terria?.measurableGeomList[terria.measurableGeometryIndex]
          ?.onlyPoints === false
      ) {
        if (
          terria.measurableGeomList[terria.measurableGeometryIndex]
            .sampledPoints
        ) {
          findNearbyPoint(
            terria.measurableGeomList[terria.measurableGeometryIndex]
              .sampledPoints ?? [],
            (point, idx) => {
              if (point) {
                MeasurablePanelManager.addMarker(point);
                viewState.setSelectedSampledPointIdx(idx);
              } else {
                MeasurablePanelManager.removeAllMarkers();
                viewState.setSelectedSampledPointIdx(null);
              }
            }
          );
        }
      }

      if (
        terria.measurableGeomList[terria.measurableGeometryIndex].stopPoints
      ) {
        findNearbyPoint(
          terria.measurableGeomList[terria.measurableGeometryIndex].stopPoints,
          (point, idx) => {
            if (point) {
              MeasurablePanelManager.addMarker(point);
              onHighlightedRowChange(idx);
              viewState.setSelectedStopPointIdx(idx);
            } else {
              if (
                terria?.measurableGeomList[terria.measurableGeometryIndex]
                  ?.onlyPoints
              )
                MeasurablePanelManager.removeAllMarkers();
              onHighlightedRowChange(null);
              viewState.setSelectedStopPointIdx(null);
            }
          }
        );
      }

      terria.currentViewer.notifyRepaintRequired();
    };

    const disposer =
      terria.currentViewer.mouseCoords.updateEvent.addEventListener(
        handleMouseProximity
      );

    return () => disposer();
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
