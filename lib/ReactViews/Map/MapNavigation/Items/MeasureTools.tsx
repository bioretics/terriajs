"use strict";

import { action, computed, makeObservable, runInAction } from "mobx";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import i18next from "i18next";
import React from "react";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import PolygonGeometryLibrary from "terriajs-cesium/Source/Core/PolygonGeometryLibrary";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import MeasureTools from "../../../../Models/MeasureTools";
import ViewState from "../../../../ReactViewModels/ViewState";
import { sampleTerrainMostDetailed } from "terriajs-cesium";

interface IProps {
  terria: Terria;
  viewState: ViewState;
  measureTools: MeasureTools;
  onOpen?(): void;
  onClose?(): void;
}

/*async function requestDeviceMotionPermission(): Promise<"granted" | "denied"> {
  const requestPermission: () => Promise<"granted" | "denied"> =
    window.DeviceMotionEvent &&
    typeof (DeviceMotionEvent as any).requestPermission === "function"
      ? (DeviceMotionEvent as any).requestPermission
      : () => Promise.resolve("granted");
  return requestPermission();
}

async function requestDeviceOrientationPermission(): Promise<
  "granted" | "denied"
> {
  const requestPermission: () => Promise<"granted" | "denied"> =
    window.DeviceOrientationEvent &&
    typeof (DeviceOrientationEvent as any).requestPermission === "function"
      ? (DeviceOrientationEvent as any).requestPermission
      : () => Promise.resolve("granted");
  return requestPermission();
}*/

export class MeasureToolsController extends MapNavigationItemController {
  static id = "measure-tool";
  static displayName = "MeasureTools";

  onOpen: () => void;
  onClose: () => void;
  constructor(private props: IProps) {
    super();
    makeObservable(this);

    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
  }

  @computed
  get active(): boolean {
    return this.props.measureTools.active;
  }

  @computed
  get visible(): boolean {
    return !this.props.viewState.useSmallScreenInterface;
  }

  get glyph(): any {
    return GLYPHS.measureTools;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @action.bound
  activate() {
    this.onOpen();
    this.props.terria.measureTools = this.props.measureTools;

    /*requestDeviceMotionPermission()
      .then((permissionState) => {
        if (permissionState !== "granted") {
          console.error("couldn't get access for motion events");
        }
      })
      .catch(console.error);

    requestDeviceOrientationPermission()
      .then((permissionState) => {
        if (permissionState !== "granted") {
          console.error("couldn't get access for orientation events");
        }
      })
      .catch(console.error);*/

    this.props.measureTools.activate();
  }

  deactivate() {
    this.onClose();
    this.props.measureTools.deactivate();
  }
}

export class MeasureLineTool extends MapNavigationItemController {
  static id = "measure-line-tool";
  static displayName = "MeasureLineTool";

  private readonly terria: Terria;
  private totalDistanceMetres: number = 0;
  private userDrawing: UserDrawing;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: IProps) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measureLineTool"),
      allowPolygon: false,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      invisible: true
    });
    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
  }

  get glyph(): any {
    return GLYPHS.measure;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.measureTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  prettifyNumber(number: number) {
    if (number <= 0) {
      return "";
    }
    // Given a number representing a number in metres, make it human readable
    let label = "m";
    if (number > 999) {
      label = "km";
      number = number / 1000.0;
    }
    let numberStr = number.toFixed(2);
    // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
    numberStr = numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    return numberStr;
  }

  updateDistance(pointEntities: CustomDataSource) {
    this.totalDistanceMetres = 0;
    if (pointEntities.entities.values.length < 1) {
      return;
    }

    let firstPointPos: Cartesian3 | undefined;
    let prevPointPos: Cartesian3 | undefined;
    for (let i = 0; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      if (currentPointPos === undefined) continue;
      if (prevPointPos === undefined) {
        prevPointPos = currentPointPos;
        firstPointPos = prevPointPos;
        continue;
      }

      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, currentPointPos);

      prevPointPos = currentPointPos;
    }
    if (prevPointPos && firstPointPos && this.userDrawing.closeLoop) {
      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, firstPointPos);
    }
  }

  getGeodesicDistance(pointOne: Cartesian3, pointTwo: Cartesian3) {
    // Note that Cartesian.distance gives the straight line distance between the two points, ignoring
    // curvature. This is not what we want.
    const pickedPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointOne);
    const lastPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointTwo);
    const geodesic = new EllipsoidGeodesic(
      pickedPointCartographic,
      lastPointCartographic
    );
    return geodesic.surfaceDistance;
  }

  onCleanUp() {
    this.totalDistanceMetres = 0;
    this.onClose();
    super.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.updateDistance(pointEntities);
    // compute sampled path
    this.terria.measurableGeometryManager[
      this.terria.measurableGeometryIndex
    ].sampleFromCustomDataSource(
      pointEntities,
      this.userDrawing.closeLoop,
      false,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pointDescriptions,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pathNotes
    );
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    return "";
  };

  /**
   * @overrides
   */
  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  /**
   * @overrides
   */
  activate() {
    this.onOpen();
    this.userDrawing.cleanUp(true);
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}

export class MeasurePolygonTool extends MapNavigationItemController {
  static id = "measure-polygon-tool";
  static displayName = "MeasurePolygonTool";

  private readonly terria: Terria;
  private totalDistanceMetres: number = 0;
  private totalAreaMetresSquared: number = 0;
  private totalFlatAreaMetresSquared: number = 0;
  private userDrawing: UserDrawing;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: IProps) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measurePolygonTool"),
      allowPolygon: true,
      autoClosePolygon: true,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      invisible: true
    });
    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
  }

  get glyph(): any {
    return GLYPHS.measurePolygon;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.measureTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  prettifyNumber(number: number, squared: boolean) {
    if (number <= 0) {
      return "";
    }
    // Given a number representing a number in metres, make it human readable
    let label = "m";
    if (squared) {
      if (number > 999999) {
        label = "km";
        number = number / 1000000.0;
      }
    } else {
      if (number > 999) {
        label = "km";
        number = number / 1000.0;
      }
    }
    let numberStr = number.toFixed(2);
    // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
    numberStr = numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    if (squared) {
      numberStr += "\u00B2";
    }
    return numberStr;
  }

  updateDistance(pointEntities: CustomDataSource) {
    this.totalDistanceMetres = 0;
    if (pointEntities.entities.values.length < 1) {
      return;
    }

    let firstPointPos: Cartesian3 | undefined;
    let prevPointPos: Cartesian3 | undefined;
    for (let i = 0; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      if (currentPointPos === undefined) continue;
      if (prevPointPos === undefined) {
        prevPointPos = currentPointPos;
        firstPointPos = prevPointPos;
        continue;
      }

      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, currentPointPos);

      prevPointPos = currentPointPos;
    }
    if (prevPointPos && firstPointPos && this.userDrawing.closeLoop) {
      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, firstPointPos);
    }
  }

  updateArea(pointEntities: CustomDataSource) {
    this.totalAreaMetresSquared = 0;
    if (!this.userDrawing.closeLoop) {
      // Not a closed polygon? Don't calculate area.
      return;
    }
    if (pointEntities.entities.values.length < 3) {
      return;
    }
    const perPositionHeight = true;

    const positions = [];
    for (let i = 0; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      if (currentPointPos !== undefined) {
        positions.push(currentPointPos);
      }
    }

    // Request the triangles that make up the polygon from Cesium.
    const tangentPlane = EllipsoidTangentPlane.fromPoints(
      positions,
      Ellipsoid.WGS84
    );
    const polygons = PolygonGeometryLibrary.polygonsFromHierarchy(
      new PolygonHierarchy(positions),
      false,
      tangentPlane.projectPointsOntoPlane.bind(tangentPlane),
      !perPositionHeight,
      Ellipsoid.WGS84
    );

    const geom = PolygonGeometryLibrary.createGeometryFromPositions(
      Ellipsoid.WGS84,
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
      // Something has gone wrong. We expect triangles. Can't calcuate area.
      return;
    }

    const coords = [];
    for (let i = 0; i < geom.attributes.position.values.length; i += 3) {
      coords.push(
        new Cartesian3(
          geom.attributes.position.values[i],
          geom.attributes.position.values[i + 1],
          geom.attributes.position.values[i + 2]
        )
      );
    }
    let area = 0;
    let flatArea = 0;
    for (let i = 0; i < geom.indices.length; i += 3) {
      const ind1 = geom.indices[i];
      const ind2 = geom.indices[i + 1];
      const ind3 = geom.indices[i + 2];

      const a = Cartesian3.distance(coords[ind1], coords[ind2]);
      const b = Cartesian3.distance(coords[ind2], coords[ind3]);
      const c = Cartesian3.distance(coords[ind3], coords[ind1]);

      // Heron's formula
      const s = (a + b + c) / 2.0;
      area += Math.sqrt(s * (s - a) * (s - b) * (s - c));

      // Flat area with Heron's formula
      const carto1 = Cartographic.fromCartesian(coords[ind1], Ellipsoid.WGS84);
      const carto2 = Cartographic.fromCartesian(coords[ind2], Ellipsoid.WGS84);
      const carto3 = Cartographic.fromCartesian(coords[ind3], Ellipsoid.WGS84);
      const aGeod = new EllipsoidGeodesic(carto1, carto2, Ellipsoid.WGS84);
      const aDist = aGeod.surfaceDistance;
      const bGeod = new EllipsoidGeodesic(carto2, carto3, Ellipsoid.WGS84);
      const bDist = bGeod.surfaceDistance;
      const cGeod = new EllipsoidGeodesic(carto3, carto1, Ellipsoid.WGS84);
      const cDist = cGeod.surfaceDistance;
      const s2 = (aDist + bDist + cDist) / 2.0;
      flatArea += Math.sqrt(s2 * (s2 - aDist) * (s2 - bDist) * (s2 - cDist));
    }
    this.totalAreaMetresSquared = area;
    this.totalFlatAreaMetresSquared = flatArea;
  }

  getGeodesicDistance(pointOne: Cartesian3, pointTwo: Cartesian3) {
    // Note that Cartesian.distance gives the straight line distance between the two points, ignoring
    // curvature. This is not what we want.
    const pickedPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointOne);
    const lastPointCartographic =
      Ellipsoid.WGS84.cartesianToCartographic(pointTwo);
    const geodesic = new EllipsoidGeodesic(
      pickedPointCartographic,
      lastPointCartographic
    );
    return geodesic.surfaceDistance;
  }

  onCleanUp() {
    this.totalDistanceMetres = 0;
    this.totalAreaMetresSquared = 0;
    this.totalFlatAreaMetresSquared = 0;
    this.onClose();
    super.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.updateDistance(pointEntities);
    this.updateArea(pointEntities);
    // compute sampled path
    this.terria.measurableGeometryManager[
      this.terria.measurableGeometryIndex
    ].sampleFromCustomDataSource(
      pointEntities,
      this.userDrawing.closeLoop,
      false,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pointDescriptions,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pathNotes
    );
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    return "";
  };

  /**
   * @overrides
   */
  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  /**
   * @overrides
   */
  activate() {
    this.onOpen();
    this.userDrawing.cleanUp(true);
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}

export class MeasureAngleTool extends MapNavigationItemController {
  static id = "measure-angle-tool";
  static displayName = "MeasureAngleTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawing;

  private currentAngle: number = 0;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: IProps) {
    super();
    makeObservable(this);

    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measureAngleTool"),
      allowPolygon: false,
      autoClosePolygon: false,
      onPointClicked: this.onPointUpdated.bind(this),
      onPointMoved: this.onPointUpdated.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      invisible: true
    });

    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
  }

  get glyph(): any {
    return GLYPHS.measureAngle;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.measureTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  onPointUpdated(pointEntities: CustomDataSource) {
    const points = pointEntities.entities.values
      .map((entity) =>
        entity.position?.getValue(this.terria.timelineClock.currentTime)
      )
      .filter((pos): pos is Cartesian3 => pos !== undefined);

    this.currentAngle = 0;

    if (points.length === 3) {
      this.currentAngle = this.userDrawing.computeAngleDegrees(
        points[0],
        points[1],
        points[2]
      );
    }
  }

  onMakeDialogMessage = () => {
    return "";
  };

  onCleanUp() {
    this.currentAngle = 0;
    this.onClose();
    super.deactivate();
  }

  activate() {
    this.onOpen();
    this.userDrawing.cleanUp(true);
    this.userDrawing.enterDrawMode(MeasureAngleTool.id);
    super.activate();
  }

  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }
}

export class MeasureCircleTool extends MapNavigationItemController {
  static id = "measure-circle-tool";
  static displayName = "MeasureCircleTool";

  private readonly terria: Terria;
  private readonly userDrawing: UserDrawing;
  private circleLocked = false;
  private circleBearingRad: number | undefined;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: IProps) {
    super();
    makeObservable(this);

    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measureCircleTool"),
      allowPolygon: false,
      autoClosePolygon: false,
      onPointClicked: (pts) => this.onPointUpdated(pts, false),
      onPointMoved: (pts) => this.onPointUpdated(pts, true),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      invisible: true
    });

    this.onOpen = props.onOpen ?? (() => {});
    this.onClose = props.onClose ?? (() => {});
  }

  get glyph(): any {
    return GLYPHS.circleEmpty;
  }
  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @computed get visible(): boolean {
    return (
      (this.props.measureTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  static getGeodesicDistance(a: Cartesian3, b: Cartesian3): number {
    const c1 = Cartographic.fromCartesian(a);
    const c2 = Cartographic.fromCartesian(b);
    return new EllipsoidGeodesic(
      new Cartographic(c1.longitude, c1.latitude),
      new Cartographic(c2.longitude, c2.latitude)
    ).surfaceDistance;
  }

  private geodesicBearing(a: Cartographic, b: Cartographic): number {
    const h = new EllipsoidGeodesic(
      new Cartographic(a.longitude, a.latitude),
      new Cartographic(b.longitude, b.latitude)
    ).startHeading;
    return Number.isFinite(h) ? h : 0;
  }

  public static prettifyArea(a: number) {
    if (a <= 0) return "";
    if (a >= 1_000_000) {
      const km2 = a / 1_000_000;
      return `${km2.toFixed(km2 >= 10 ? 1 : 2)} km²`;
    }
    return `${a.toFixed(a >= 10_000 ? 0 : 2)} m²`;
  }

  public static prettifyDistance(d: number) {
    if (d <= 0) return "";
    const isKm = d > 999;
    const value = isKm ? d / 1000 : d;
    return `${value.toFixed(isKm ? 2 : 1)} ${isKm ? "km" : "m"}`;
  }

  private updateGeom(center: Cartesian3, edge: Cartesian3) {
    const radius = MeasureCircleTool.getGeodesicDistance(center, edge);
    const area = Math.PI * radius * radius;
    const centerCarto = Cartographic.fromCartesian(center);
    const edgeCarto = Cartographic.fromCartesian(edge);
    runInAction(() => {
      const idx = this.terria.measurableGeometryIndex;
      const prev = this.terria.measurableGeomList[idx];
      this.terria.measurableGeomList[idx] = {
        ...prev,
        isClosed: true,
        hasArea: true,
        isCircle: true,
        showDistanceLabels: false,
        stopPoints: [centerCarto, edgeCarto],
        stopGeodeticDistances: [0, radius],
        stopAirDistances: [0, radius],
        stopGroundDistances: [0, radius],
        isPointAdding: false,
        circleRadius: radius,
        circleDiameter: radius * 2,
        circlePerimeter: 2 * Math.PI * radius,
        circleArea: area,
        circleCenter: centerCarto,
        geodeticArea: area,
        geodeticDistance: 2 * Math.PI * radius
      };
    });
  }

  async setRadiusFromPanel(radius: number): Promise<boolean> {
    if (!this.circleLocked || radius <= 0 || !Number.isFinite(radius)) {
      return false;
    }
    const [centerE, edgeE] = this.userDrawing.pointEntities.entities.values;
    if (!centerE || !edgeE) return false;
    const t = this.terria.timelineClock.currentTime;
    const center = centerE.position?.getValue(t);
    const edge = edgeE.position?.getValue(t);
    if (!center || !edge) return false;
    const c1 = Cartographic.fromCartesian(center);
    const c2 = Cartographic.fromCartesian(edge);
    const geo = new EllipsoidGeodesic(
      new Cartographic(c1.longitude, c1.latitude),
      new Cartographic(c2.longitude, c2.latitude)
    );
    const newEdgeCarto = geo.interpolateUsingSurfaceDistance(radius);
    try {
      const terrain = (this.terria.currentViewer as any)?.scene
        ?.terrainProvider;
      if (terrain) {
        const [sampled] = await sampleTerrainMostDetailed(terrain, [
          new Cartographic(newEdgeCarto.longitude, newEdgeCarto.latitude)
        ]);
        newEdgeCarto.height = sampled.height ?? c2.height;
      } else {
        newEdgeCarto.height = c2.height;
      }
    } catch {
      newEdgeCarto.height = c2.height;
    }
    const newEdge = Cartographic.toCartesian(newEdgeCarto);
    edgeE.position = new ConstantPositionProperty(newEdge);
    this.updateGeom(center, newEdge);
    this.terria.currentViewer.notifyRepaintRequired();
    return true;
  }

  static buildCircleRingRadians(
    centerLat: number,
    centerLon: number,
    radius: number,
    segments: number,
    closedRing = false
  ): { lat: number; lon: number }[] {
    const earthRadius = Ellipsoid.WGS84.maximumRadius;
    const angularDistance = radius / earthRadius;
    const sinLat1 = Math.sin(centerLat);
    const cosLat1 = Math.cos(centerLat);
    const sinAd = Math.sin(angularDistance);
    const cosAd = Math.cos(angularDistance);
    const count = closedRing ? segments + 1 : segments;
    const points: { lat: number; lon: number }[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const bearing = (2 * Math.PI * (i % segments)) / segments;
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

    return points;
  }

  private onPointUpdated(pointEntities: CustomDataSource, isMove: boolean) {
    const t = this.terria.timelineClock.currentTime;
    const entities = pointEntities.entities.values;
    const points = entities
      .map((e) => e.position?.getValue(t))
      .filter((p): p is Cartesian3 => p !== undefined);
    if (!isMove && this.circleLocked) {
      const last = entities[entities.length - 1];
      pointEntities.entities.removeAll();
      pointEntities.entities.add(last);
      this.circleLocked = false;
      this.terria.currentViewer.notifyRepaintRequired();
      return;
    }

    if (!isMove && points.length >= 2) {
      this.circleLocked = true;
      const center = points[0];
      const edge = points[points.length - 1];
      const centerCarto = Cartographic.fromCartesian(center, Ellipsoid.WGS84);
      const edgeCarto = Cartographic.fromCartesian(edge, Ellipsoid.WGS84);
      this.circleBearingRad = this.geodesicBearing(centerCarto, edgeCarto);
      this.updateGeom(center, edge);
      this.terria.currentViewer.notifyRepaintRequired();
      return;
    }

    if (isMove && points.length >= 2) {
      if (this.circleLocked) this.updateGeom(points[0], points[1]);
      this.terria.currentViewer.notifyRepaintRequired();
    }
  }

  onMakeDialogMessage = () => {
    return "";
  };

  onCleanUp() {
    this.circleLocked = false;
    this.circleBearingRad = undefined;
    this.onClose();
    super.deactivate();
  }

  activate() {
    this.onOpen();
    this.circleLocked = false;
    this.circleBearingRad = undefined;
    this.userDrawing.cleanUp(true);
    this.userDrawing.enterDrawMode(MeasureCircleTool.id);
    super.activate();
  }

  deactivate() {
    this.onClose();
    this.circleLocked = false;
    this.circleBearingRad = undefined;
    this.userDrawing.endDrawing();
    super.deactivate();
  }
}

export class MeasurePointTool extends MapNavigationItemController {
  static id = "measure-point-tool";
  static displayName = "MeasurePointTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawing;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: IProps) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measurePointTool"),
      allowPolygon: false,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      invisible: true
    });
    this.onOpen = props.onOpen || (() => {});
    this.onClose = props.onClose || (() => {});
  }

  get glyph(): any {
    return GLYPHS.measurePoint;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.measureTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  onCleanUp() {
    this.onClose();
    super.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.terria.measurableGeometryManager[
      this.terria.measurableGeometryIndex
    ].sampleFromCustomDataSource(
      pointEntities,
      this.userDrawing.closeLoop,
      true,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pointDescriptions,
      this.terria.measurableGeomList[this.terria.measurableGeometryIndex]
        ?.pathNotes
    );
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    return "";
  };

  /**
   * @overrides
   */
  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  /**
   * @overrides
   */
  activate() {
    this.onOpen();
    this.userDrawing.cleanUp(true);
    this.userDrawing.enterDrawMode(MeasurePointTool.id);
    super.activate();
  }
}
