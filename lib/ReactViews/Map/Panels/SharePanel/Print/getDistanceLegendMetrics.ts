import L from "leaflet";
import { runInAction } from "mobx";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import isDefined from "../../../../../Core/isDefined";
import Terria from "../../../../../Models/Terria";

const geodesic = new EllipsoidGeodesic();

const distances = [
  1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000,
  20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000, 2000000,
  3000000, 5000000, 10000000, 20000000, 30000000, 50000000
];

export interface DistanceLegendMetrics {
  label: string;
  barWidth: number;
}

export function getDistanceLegendMetricsFromCesium(
  scene: Scene,
  terria: Terria,
  scale: number = 1
): DistanceLegendMetrics | null {
  const width = scene.canvas.clientWidth;
  const height = scene.canvas.clientHeight;

  const left = scene.camera.getPickRay(
    new Cartesian2((width / 2) | 0, height - 1)
  );
  const right = scene.camera.getPickRay(
    new Cartesian2((1 + width / 2) | 0, height - 1)
  );

  const globe = scene.globe;

  if (!isDefined(left) || !isDefined(right)) {
    return null;
  }

  const leftPosition = globe.pick(left, scene);
  const rightPosition = globe.pick(right, scene);

  if (!isDefined(leftPosition) || !isDefined(rightPosition)) {
    return null;
  }

  const leftCartographic =
    globe.ellipsoid.cartesianToCartographic(leftPosition);
  const rightCartographic =
    globe.ellipsoid.cartesianToCartographic(rightPosition);

  geodesic.setEndPoints(leftCartographic, rightCartographic);
  const pixelDistance = geodesic.surfaceDistance;
  runInAction(() => (terria.mainViewer.scale = pixelDistance));

  const maxBarWidth = 100;
  let distance;
  for (let i = distances.length - 1; !isDefined(distance) && i >= 0; --i) {
    if (distances[i] / pixelDistance < maxBarWidth) {
      distance = distances[i];
    }
  }

  if (!isDefined(distance)) {
    return null;
  }

  const label =
    distance >= 1000
      ? (distance / 1000).toString() + " km"
      : distance.toString() + " m";

  return {
    label,
    barWidth: ((distance / pixelDistance) * scale) | 0
  };
}

export function getDistanceLegendMetricsFromLeaflet(
  map: L.Map,
  terria: Terria,
  scale: number = 1
): DistanceLegendMetrics | null {
  const halfHeight = map.getSize().y / 2;
  const maxPixelWidth = 100;
  const maxMeters = map
    .containerPointToLatLng([0, halfHeight])
    .distanceTo(map.containerPointToLatLng([maxPixelWidth, halfHeight]));

  runInAction(() => (terria.mainViewer.scale = maxMeters / 100));
  // @ts-expect-error Accessing private method
  const meters = L.control.scale()._getRoundNum(maxMeters);
  const label = meters < 1000 ? meters + " m" : meters / 1000 + " km";

  return {
    label,
    barWidth: (meters / maxMeters) * maxPixelWidth * scale
  };
}

export function getDistanceLegendMetrics(
  terria: Terria,
  scale: number = 1
): DistanceLegendMetrics | null {
  if (isDefined(terria.cesium)) {
    return getDistanceLegendMetricsFromCesium(
      terria.cesium.scene,
      terria,
      scale
    );
  } else if (isDefined(terria.leaflet)) {
    return getDistanceLegendMetricsFromLeaflet(terria.leaflet.map, terria, scale);
  }
  return null;
}

export function getMapHeading(terria: Terria): number {
  if (isDefined(terria.cesium)) {
    return terria.cesium.scene.camera.heading;
  }
  return 0;
}
