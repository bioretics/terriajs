import Terria from "../../Models/Terria";
import { action, makeObservable, runInAction } from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import EarthGravityModel1996 from "../../Map/Vector/EarthGravityModel1996";
import { JsonObject } from "../../Core/Json";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import PolygonGeometryLibrary from "terriajs-cesium/Source/Core/PolygonGeometryLibrary";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import { profileSamplingStep } from "./MeasurableGeometrySamplingStep";
import geoidFile from "../../../wwwroot/data/WW15MGH.DAC";
export interface MeasurableGeometry {
  isClosed: boolean;
  hasArea: boolean;
  stopPoints: Cartographic[];
  stopGeodeticDistances: number[];
  stopAirDistances?: number[];
  stopGroundDistances?: number[];
  geodeticDistance?: number;
  airDistance?: number;
  groundDistance?: number;
  sampledPoints?: Cartographic[];
  sampledDistances?: number[];
  geodeticArea?: number;
  airArea?: number;
  onlyPoints?: boolean;
  pointDescriptions?: string[];
  showDistanceLabels?: boolean;
  pathNotes?: string;
  isFileUploaded?: boolean;
  isPointAdding?: boolean;
  isCircle?: boolean;
  circleRadius?: number;
  circleDiameter?: number;
  circlePerimeter?: number;
  circleArea?: number;
  circleCenter?: Cartographic;
  indexPath?: number;
  featureProperties?: JsonObject;
  pointProperties?: JsonObject[];
  sourceItemId?: string;
}

export default class MeasurableGeometryManager {
  readonly terria: Terria;

  readonly geoidModel: EarthGravityModel1996;

  constructor(terria: Terria) {
    makeObservable(this);
    this.terria = terria;
    this.geoidModel = new EarthGravityModel1996(geoidFile);
  }

  resample(index: number = this.terria.measurableGeometryIndex) {
    const currentGeometry = this.terria.measurableGeomList[index];
    if (!currentGeometry || !currentGeometry.stopPoints?.length) {
      return;
    }

    const closeGeomProperties = {
      sourceItemId: currentGeometry.sourceItemId,
      ...(currentGeometry?.isCircle
        ? {
            hasArea: true,
            isCircle: true,
            circleRadius: currentGeometry.circleRadius,
            circleDiameter: currentGeometry.circleDiameter,
            circlePerimeter: currentGeometry.circlePerimeter,
            circleArea: currentGeometry.circleArea,
            circleCenter: currentGeometry.circleCenter,
            geodeticDistance:
              currentGeometry.circlePerimeter ??
              currentGeometry.geodeticDistance,
            geodeticArea:
              currentGeometry.circleArea ?? currentGeometry.geodeticArea,
            airArea: currentGeometry.airArea
          }
        : {})
    };

    this.sampleFromCartographics(
      currentGeometry?.stopPoints ?? [],
      currentGeometry?.isClosed,
      currentGeometry?.onlyPoints,
      currentGeometry?.pointDescriptions,
      currentGeometry?.pathNotes,
      currentGeometry?.isFileUploaded,
      currentGeometry?.indexPath ?? index,
      currentGeometry?.isCircle,
      currentGeometry?.circleRadius,
      currentGeometry?.circleCenter,
      closeGeomProperties
    );
  }

  private samplingStepFor(
    cartoPositions: Cartographic[],
    ellipsoid: Ellipsoid
  ): number {
    let step = this.terria.measurableGeomSamplingStep;
    if (this.terria.measurableGeomSamplingStepIsAuto) {
      let pathLength = 0;
      for (let i = 0; i < cartoPositions.length - 1; ++i) {
        pathLength += new EllipsoidGeodesic(
          cartoPositions[i],
          cartoPositions[i + 1],
          ellipsoid
        ).surfaceDistance;
      }
      step =
        profileSamplingStep(pathLength, this.terria.mainViewer.scale) || step;
    }
    runInAction(() => {
      this.terria.measurableGeomSamplingStepInUse = step;
    });
    return step;
  }

  getGeodesicDistance(
    pointOne: Cartesian3,
    pointTwo: Cartesian3,
    ellipsoid: Ellipsoid = Ellipsoid.WGS84
  ): number {
    const pickedPointCartographic = ellipsoid.cartesianToCartographic(pointOne);
    const lastPointCartographic = ellipsoid.cartesianToCartographic(pointTwo);

    if (!pickedPointCartographic || !lastPointCartographic) {
      return 0;
    }

    const geodesic = new EllipsoidGeodesic(
      pickedPointCartographic,
      lastPointCartographic,
      ellipsoid
    );
    return geodesic.surfaceDistance;
  }

  buildCircleRingRadians(
    centerLat: number,
    centerLon: number,
    radius: number,
    segments: number,
    closedRing = true
  ): { lat: number; lon: number }[] {
    const earthRadius = Ellipsoid.WGS84.maximumRadius;
    const angularDistance = radius / earthRadius;
    const sinLat1 = Math.sin(centerLat);
    const cosLat1 = Math.cos(centerLat);
    const sinAd = Math.sin(angularDistance);
    const cosAd = Math.cos(angularDistance);
    const count = closedRing ? segments + 1 : segments;
    const points: { lat: number; lon: number }[] = new Array(count);

    for (let i = 0; i < segments; i++) {
      const bearing = (2 * Math.PI * i) / segments;
      const lat2 = Math.asin(
        sinLat1 * cosAd + cosLat1 * sinAd * Math.cos(bearing)
      );
      const lon2 =
        centerLon +
        Math.atan2(
          Math.sin(bearing) * sinAd * cosLat1,
          cosAd - sinLat1 * Math.sin(lat2)
        );
      points[i] = { lat: lat2, lon: lon2 };
    }

    if (closedRing) {
      points[segments] = points[0];
    }

    return points;
  }

  @action
  updateCircleGeometry(
    center: Cartesian3,
    edge: Cartesian3,
    indexPath: number = this.terria.measurableGeometryIndex
  ) {
    const radius = this.getGeodesicDistance(center, edge);
    const centerCarto = Cartographic.fromCartesian(center);
    const edgeCarto = Cartographic.fromCartesian(edge);
    const currentGeometry = this.terria.measurableGeomList[indexPath];

    const circleGeometry: MeasurableGeometry = {
      ...(currentGeometry ?? {}),
      isClosed: true,
      hasArea: true,
      stopPoints: [centerCarto, edgeCarto],
      stopGeodeticDistances: [0, radius],
      stopAirDistances: [0, radius],
      stopGroundDistances: [0, radius],
      geodeticDistance: 2 * Math.PI * radius,
      geodeticArea: Math.PI * radius * radius,
      onlyPoints: false,
      isCircle: true,
      circleRadius: radius,
      circleDiameter: radius * 2,
      circlePerimeter: 2 * Math.PI * radius,
      circleArea: Math.PI * radius * radius,
      circleCenter: centerCarto,
      showDistanceLabels: false,
      isPointAdding: false,
      indexPath
    };

    while (this.terria.measurableGeomList.length < indexPath) {
      this.terria.measurableGeomList.push(circleGeometry);
    }

    this.terria.measurableGeomList[indexPath] = circleGeometry;
  }

  sampleFromCustomDataSource(
    pointEntities: CustomDataSource,
    closeLoop: boolean = false,
    onlyPoints: boolean = false,
    pointDescriptions?: string[],
    pathNotes?: string,
    isFileUploaded?: boolean
  ) {
    const ellipsoid =
      this.terria.cesium?.scene.globe.ellipsoid ?? Ellipsoid.WGS84;

    // extract valid points from CustomDataSource
    const cartesianEntities = pointEntities.entities.values.filter(
      (elem) => elem?.position !== undefined && elem?.position !== null
    );
    // if the path is a closed loop add the first point also as last point
    if (closeLoop && pointEntities.entities.values.length > 0) {
      cartesianEntities.push(pointEntities.entities.values[0]);
    }
    // convert from cartesian to cartographic because "sampleTerrainMostDetailed" work with cartographic
    const cartoPositions = cartesianEntities
      .map((elem) => {
        return (
          elem.position!.getValue(this.terria.timelineClock.currentTime) ??
          Cartesian3.ZERO
        );
      })
      .filter((elem) => {
        return !elem.equals(Cartesian3.ZERO);
      })
      .map((elem) => {
        return Cartographic.fromCartesian(elem, ellipsoid);
      });

    this.sampleFromCartographics(
      cartoPositions,
      closeLoop,
      onlyPoints,
      pointDescriptions,
      pathNotes,
      isFileUploaded
    );
  }

  /**
   * Returns polygon vertices without a duplicated closing point.
   */
  private normalizePolygonVertices(stopPoints: Cartographic[]): Cartographic[] {
    if (stopPoints.length < 2) {
      return stopPoints;
    }

    const first = stopPoints[0];
    const last = stopPoints[stopPoints.length - 1];
    if (
      first.longitude === last.longitude &&
      first.latitude === last.latitude &&
      first.height === last.height
    ) {
      return stopPoints.slice(0, -1);
    }

    return stopPoints;
  }

  private isSameCartographic(a: Cartographic, b: Cartographic): boolean {
    return (
      a.longitude === b.longitude &&
      a.latitude === b.latitude &&
      a.height === b.height
    );
  }

  /**
   * Ensures closed paths include the closing edge in perimeter calculations.
   */
  private withClosingVertexIfNeeded(
    cartoPositions: Cartographic[],
    closeLoop: boolean
  ): Cartographic[] {
    if (!closeLoop || cartoPositions.length < 3) {
      return cartoPositions;
    }

    const first = cartoPositions[0];
    const last = cartoPositions[cartoPositions.length - 1];
    if (this.isSameCartographic(first, last)) {
      return cartoPositions;
    }

    return [...cartoPositions, Cartographic.clone(first)];
  }

  private heronArea(a: number, b: number, c: number): number {
    const s = (a + b + c) / 2.0;
    const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
    return isNaN(area) ? 0 : area;
  }

  /**
   * Triangulates a polygon via Cesium PolygonGeometryLibrary (supports concave
   * polygons). Returns triangle vertex positions or undefined when triangulation
   * fails.
   */
  private triangulatePolygon(
    stopPoints: Cartographic[],
    ellipsoid: Ellipsoid
  ): Cartesian3[] | undefined {
    const positions = this.normalizePolygonVertices(stopPoints).map((point) =>
      Cartographic.toCartesian(point, ellipsoid)
    );

    if (positions.length < 3) {
      return undefined;
    }

    try {
      const perPositionHeight = true;
      const tangentPlane = EllipsoidTangentPlane.fromPoints(
        positions,
        ellipsoid
      );
      const polygons = PolygonGeometryLibrary.polygonsFromHierarchy(
        new PolygonHierarchy(positions),
        false,
        tangentPlane.projectPointsOntoPlane.bind(tangentPlane),
        !perPositionHeight,
        ellipsoid
      );

      const geom = PolygonGeometryLibrary.createGeometryFromPositions(
        ellipsoid,
        polygons.polygons[0],
        undefined,
        CesiumMath.RADIANS_PER_DEGREE,
        perPositionHeight,
        VertexFormat.POSITION_ONLY,
        ArcType.GEODESIC
      );

      if (
        geom.indices.length % 3 !== 0 ||
        geom.attributes.position.values.length % 3 !== 0
      ) {
        return undefined;
      }

      const coords: Cartesian3[] = [];
      for (let i = 0; i < geom.attributes.position.values.length; i += 3) {
        coords.push(
          new Cartesian3(
            geom.attributes.position.values[i],
            geom.attributes.position.values[i + 1],
            geom.attributes.position.values[i + 2]
          )
        );
      }

      const triangles: Cartesian3[] = [];
      for (let i = 0; i < geom.indices.length; i += 3) {
        triangles.push(
          coords[geom.indices[i]],
          coords[geom.indices[i + 1]],
          coords[geom.indices[i + 2]]
        );
      }

      return triangles;
    } catch {
      return undefined;
    }
  }

  private sumTriangulatedArea(
    stopPoints: Cartographic[],
    ellipsoid: Ellipsoid,
    useGeodeticEdges: boolean
  ): number {
    const triangles = this.triangulatePolygon(stopPoints, ellipsoid);
    if (!triangles) {
      return useGeodeticEdges
        ? this.calculateGeodeticAreaFan(stopPoints, ellipsoid)
        : this.calculateAirAreaFan(stopPoints, ellipsoid);
    }

    let totalArea = 0;
    for (let i = 0; i < triangles.length; i += 3) {
      const p1 = triangles[i];
      const p2 = triangles[i + 1];
      const p3 = triangles[i + 2];

      if (useGeodeticEdges) {
        const carto1 = Cartographic.fromCartesian(p1, ellipsoid);
        const carto2 = Cartographic.fromCartesian(p2, ellipsoid);
        const carto3 = Cartographic.fromCartesian(p3, ellipsoid);
        const a = new EllipsoidGeodesic(carto1, carto2, ellipsoid)
          .surfaceDistance;
        const b = new EllipsoidGeodesic(carto2, carto3, ellipsoid)
          .surfaceDistance;
        const c = new EllipsoidGeodesic(carto3, carto1, ellipsoid)
          .surfaceDistance;
        totalArea += this.heronArea(a, b, c);
      } else {
        const a = Cartesian3.distance(p1, p2);
        const b = Cartesian3.distance(p2, p3);
        const c = Cartesian3.distance(p3, p1);
        totalArea += this.heronArea(a, b, c);
      }
    }

    return totalArea;
  }

  // sample the entire path (polyline) every "samplingStep" meters
  @action
  sampleFromCartographics(
    cartoPositions: Cartographic[],
    closeLoop: boolean = false,
    onlyPoints: boolean = false,
    pointDescriptions: string[] = [],
    pathNotes?: string,
    isFileUploaded?: boolean,
    indexPath?: number,
    isCircle?: boolean,
    circleRadius?: number,
    circleCenter?: Cartographic,
    geomProperties?: Partial<MeasurableGeometry> | JsonObject
  ) {
    const terrainProvider = this.terria.cesium?.scene.terrainProvider;
    const ellipsoid =
      this.terria.cesium?.scene?.globe?.ellipsoid ?? Ellipsoid.WGS84;
    const canSampleMostDetailed =
      !!terrainProvider &&
      !!(terrainProvider as any).availability &&
      !!ellipsoid &&
      cartoPositions.length > 0;

    const pathPositions = this.withClosingVertexIfNeeded(
      cartoPositions,
      closeLoop
    );
    const samplingStep = this.samplingStepFor(pathPositions, ellipsoid);
    // index of the original stops in the new array of sampling points
    const originalStopsIndex: number[] = [0];
    // geodetic distance between two stops
    const stopGeodeticDistances: number[] = [0];
    // compute sampling points every "samplingStep" meters
    const interpolatedCartographics = [pathPositions[0]];
    for (let i = 0; i < pathPositions.length - 1; ++i) {
      const geodesic = new EllipsoidGeodesic(
        pathPositions[i],
        pathPositions[i + 1],
        ellipsoid
      );
      const segmentDistance = geodesic.surfaceDistance;
      stopGeodeticDistances.push(segmentDistance);
      let y = 0;
      while ((y += samplingStep) < segmentDistance) {
        interpolatedCartographics.push(
          geodesic.interpolateUsingSurfaceDistance(y)
        );
      }
      // original points have to be used
      originalStopsIndex.push(interpolatedCartographics.length);
      interpolatedCartographics.push(pathPositions[i + 1]);
    }
    // sample points on terrain
    const terrainPromises = [
      canSampleMostDetailed
        ? sampleTerrainMostDetailed(
            terrainProvider,
            interpolatedCartographics
          ).catch(() => interpolatedCartographics)
        : Promise.resolve(interpolatedCartographics)
    ];
    if (
      this.terria.configParameters.useElevationMeanSeaLevel &&
      terrainProvider
    ) {
      terrainPromises.push(
        this.geoidModel.getHeights(interpolatedCartographics)
      );
    }
    Promise.all(terrainPromises).then((sampledCartographics) => {
      if (sampledCartographics.length === 2) {
        const geoidHeights = sampledCartographics[1];
        sampledCartographics[0].forEach(
          (elem, i) => (elem.height -= geoidHeights[i].height)
        );
      }

      const sampledPoints = sampledCartographics[0];
      const sampledCartesians =
        ellipsoid.cartographicArrayToCartesianArray(sampledPoints);
      const hasDetailedTerrainSampling = canSampleMostDetailed;

      // compute distances
      const stepDistances: number[] = [0];
      for (let i = 1; i < sampledCartesians.length; ++i) {
        const dist: number = hasDetailedTerrainSampling
          ? Cartesian3.distance(sampledCartesians[i - 1], sampledCartesians[i])
          : new EllipsoidGeodesic(
              sampledPoints[i - 1],
              sampledPoints[i],
              ellipsoid
            ).surfaceDistance;
        stepDistances.push(dist);
      }
      const stopAirDistances: number[] = [0];
      const stopGroundDistances: number[] = [0];
      for (let i = 0; i < originalStopsIndex.length - 1; ++i) {
        pathPositions[i].height = sampledPoints[originalStopsIndex[i]].height;

        stopAirDistances.push(
          Cartesian3.distance(
            sampledCartesians[originalStopsIndex[i + 1]],
            sampledCartesians[originalStopsIndex[i]]
          )
        );

        stopGroundDistances.push(
          hasDetailedTerrainSampling
            ? stepDistances
                .filter(
                  (_, index) =>
                    index > originalStopsIndex[i] &&
                    index <= originalStopsIndex[i + 1]
                )
                .reduce((sum: number, current: number) => sum + current, 0)
            : stopGeodeticDistances[i + 1]
        );
      }
      // update state of Terria
      const updatePathParams: Parameters<typeof this.updatePath> = onlyPoints
        ? [
            pathPositions,
            [],
            [],
            [],
            sampledCartographics[0],
            [],
            closeLoop,
            true,
            pointDescriptions,
            pathNotes,
            isFileUploaded,
            indexPath,
            false,
            circleRadius,
            circleCenter,
            geomProperties
          ]
        : [
            pathPositions,
            stopGeodeticDistances,
            stopAirDistances,
            stopGroundDistances,
            sampledPoints,
            stepDistances,
            closeLoop,
            false,
            [],
            pathNotes,
            isFileUploaded,
            indexPath,
            isCircle,
            circleRadius,
            circleCenter,
            geomProperties
          ];

      this.updatePath(...updatePathParams);
    });
  }

  @action
  updatePath(
    stopPoints: Cartographic[],
    stopGeodeticDistances: number[],
    stopAirDistances: number[],
    stopGroundDistances: number[],
    sampledPoints: Cartographic[],
    sampledDistances: number[],
    isClosed: boolean,
    onlyPoints: boolean = false,
    pointDescriptions: string[] = [],
    pathNotes?: string,
    isFileUploaded?: boolean,
    indexPath?: number,
    isCircle?: boolean,
    circleRadius?: number,
    circleCenter?: Cartographic,
    geomProperties?: Partial<MeasurableGeometry> | JsonObject
  ) {
    let geodeticArea = 0;
    let airArea = 0;

    if (isClosed && stopPoints.length >= 3 && !onlyPoints) {
      geodeticArea = this.calculateGeodeticArea(stopPoints);
      airArea = this.calculateAirArea(stopPoints);
    }

    const newGeometry: MeasurableGeometry = {
      isClosed: isClosed,
      hasArea: false,
      stopPoints: stopPoints,
      stopGeodeticDistances: stopGeodeticDistances,
      stopAirDistances: stopAirDistances,
      stopGroundDistances: stopGroundDistances,
      geodeticDistance: stopGeodeticDistances.reduce(
        (sum: number, current: number) => sum + current,
        0
      ),
      airDistance: stopAirDistances.reduce((sum, current) => sum + current, 0),
      groundDistance: stopGroundDistances.reduce(
        (sum: number, current: number) => sum + current,
        0
      ),
      sampledPoints: sampledPoints,
      sampledDistances: sampledDistances,
      airArea: airArea,
      geodeticArea: geodeticArea,
      onlyPoints: onlyPoints,
      pointDescriptions: pointDescriptions,
      pathNotes: pathNotes,
      isFileUploaded: isFileUploaded,
      isCircle: isCircle,
      circleRadius: circleRadius,
      circleDiameter: circleRadius ? circleRadius * 2 : undefined,
      circlePerimeter: circleRadius ? 2 * Math.PI * circleRadius : undefined,
      circleArea: circleRadius
        ? Math.PI * circleRadius * circleRadius
        : undefined,
      circleCenter: circleCenter,
      indexPath: indexPath,
      ...(geomProperties ?? {})
    };

    if (indexPath !== undefined) {
      while (this.terria.measurableGeomList.length < indexPath) {
        this.terria.measurableGeomList.push(newGeometry);
      }
      this.terria.measurableGeomList[indexPath] = newGeometry;
    } else if (
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
    ) {
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex] =
        newGeometry;
    } else {
      this.terria.measurableGeomList.push(newGeometry);
    }
  }

  /**
   * Geodetic (horizontal) area in m². Projects the polygon onto the ellipsoid
   * using geodesic edge lengths and Heron's formula on each triangulated facet.
   * Vertex height is ignored. Displayed by MeasurablePanel as "Geodetic area".
   */
  public calculateGeodeticArea(stopPoints: Cartographic[]): number {
    if (stopPoints.length < 3) return 0;

    const ellipsoid =
      this.terria.cesium?.scene.globe.ellipsoid ?? Ellipsoid.WGS84;
    if (!ellipsoid) return 0;

    return this.sumTriangulatedArea(stopPoints, ellipsoid, true);
  }

  /**
   * Air (3D vertex-based) area in m². Uses 3D chord distances between vertex
   * positions (including elevation) and Heron's formula on each triangulated
   * facet. Displayed by MeasurablePanel as "Air area".
   */
  public calculateAirArea(stopPoints: Cartographic[]): number {
    if (stopPoints.length < 3) return 0;

    const ellipsoid =
      this.terria.cesium?.scene.globe.ellipsoid ?? Ellipsoid.WGS84;
    if (!ellipsoid) return 0;

    return this.sumTriangulatedArea(stopPoints, ellipsoid, false);
  }

  /** Fallback triangle-fan decomposition when PolygonGeometryLibrary fails. */
  private calculateGeodeticAreaFan(
    stopPoints: Cartographic[],
    ellipsoid: Ellipsoid
  ): number {
    const vertices = this.normalizePolygonVertices(stopPoints);
    if (vertices.length < 3) return 0;

    let totalArea = 0;
    for (let i = 1; i < vertices.length - 1; i++) {
      const p1 = vertices[0];
      const p2 = vertices[i];
      const p3 = vertices[i + 1];

      const a = new EllipsoidGeodesic(p1, p2, ellipsoid).surfaceDistance;
      const b = new EllipsoidGeodesic(p2, p3, ellipsoid).surfaceDistance;
      const c = new EllipsoidGeodesic(p3, p1, ellipsoid).surfaceDistance;
      totalArea += this.heronArea(a, b, c);
    }

    return totalArea;
  }

  /** Fallback triangle-fan decomposition when PolygonGeometryLibrary fails. */
  private calculateAirAreaFan(
    stopPoints: Cartographic[],
    ellipsoid: Ellipsoid
  ): number {
    const vertices = this.normalizePolygonVertices(stopPoints);
    if (vertices.length < 3) return 0;

    const cartesianPoints = vertices.map((point) =>
      Cartographic.toCartesian(point, ellipsoid)
    );

    let totalArea = 0;
    for (let i = 1; i < cartesianPoints.length - 1; i++) {
      const p1 = cartesianPoints[0];
      const p2 = cartesianPoints[i];
      const p3 = cartesianPoints[i + 1];

      const a = Cartesian3.distance(p1, p2);
      const b = Cartesian3.distance(p2, p3);
      const c = Cartesian3.distance(p3, p1);
      totalArea += this.heronArea(a, b, c);
    }

    return totalArea;
  }
}
