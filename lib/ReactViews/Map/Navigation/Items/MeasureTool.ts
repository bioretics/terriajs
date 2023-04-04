"use strict";
import i18next from "i18next";
import { action, reaction, IReactionDisposer } from "mobx";
import React from "react";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import isDefined from "../../../../Core/isDefined";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
const PolygonGeometryLibrary =
  require("terriajs-cesium/Source/Core/PolygonGeometryLibrary").default;

interface MeasureToolOptions {
  terria: Terria;
  onClose(): void;
  onOpen(): void;
}

export default class MeasureTool extends MapNavigationItemController {
  static id = "measure-tool";
  static displayName = "MeasureTool";

  private readonly terria: Terria;
  private totalDistanceMetres: number = 0;
  private totalAreaMetresSquared: number = 0;
  private userDrawing: UserDrawing;

  private disposeSamplingPathStep?: IReactionDisposer;

  onClose: () => void;
  onOpen: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: MeasureToolOptions) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measureTool"),
      allowPolygon: true,
      autoClosePolygon: false,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this)
    });
    this.onClose = props.onClose;
    this.onOpen = props.onOpen;

    // sampleEntirePath is the reaction to samplingPathStep changes
    this.disposeSamplingPathStep = reaction(
      () => this.terria.samplingPathStep,
      () => {
        this.sampleEntirePath(this.userDrawing.pointEntities);
      }
    );
  }

  get glyph(): any {
    return GLYPHS.measure;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
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
    numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;
    if (squared) {
      numberStr += "\u00B2";
    }
    return numberStr;
  }

  // sample the entire path (polyline) every "samplingPathStep" meters
  sampleEntirePath(pointEntities: CustomDataSource) {
    const terrainProvider = this.terria.cesium?.scene.terrainProvider;
    const ellipsoid = this.terria.cesium?.scene.globe.ellipsoid;

    if (!terrainProvider || !ellipsoid) {
      return;
    }

    // extract valid points from CustomDataSource
    const cartesianEntities = pointEntities.entities.values.filter(
      (elem) => elem?.position !== undefined && elem?.position !== null
    );
    // if the path is a closed loop add the first point also as last point
    if (
      this.userDrawing.closeLoop &&
      pointEntities.entities.values.length > 0
    ) {
      cartesianEntities.push(pointEntities.entities.values[0]);
    }
    // convert from cartesian to cartographic becouse "sampleTerrainMostDetailed" work with cartographic
    const cartoPositions = cartesianEntities.map((elem) => {
      return Cartographic.fromCartesian(
        elem.position!.getValue(this.terria.timelineClock.currentTime),
        ellipsoid
      );
    });

    // index of the original stops in the new array of sampling points
    const originalStopsIndex: number[] = [0];
    // geodetic distance between two stops
    const stopGeodeticDistances: number[] = [0];

    // compute sampling points every "samplingPathStep" meters
    const interpolatedCartographics = [cartoPositions[0]];
    for (let i = 0; i < cartoPositions.length - 1; ++i) {
      const geodesic = new EllipsoidGeodesic(
        cartoPositions[i],
        cartoPositions[i + 1],
        ellipsoid
      );
      const segmentDistance = geodesic.surfaceDistance;
      stopGeodeticDistances.push(segmentDistance);
      let y = 0;
      while ((y += this.terria.samplingPathStep) < segmentDistance) {
        interpolatedCartographics.push(
          geodesic.interpolateUsingSurfaceDistance(y)
        );
      }
      // original points have to be used
      originalStopsIndex.push(interpolatedCartographics.length);
      interpolatedCartographics.push(cartoPositions[i + 1]);
    }

    // sample points on terrain
    sampleTerrainMostDetailed(terrainProvider, interpolatedCartographics).then(
      (sampledCartographics) => {
        const sampledCartesians =
          ellipsoid.cartographicArrayToCartesianArray(sampledCartographics);

        // compute distances
        const stepDistances: number[] = [];
        for (let i = 0; i < sampledCartesians.length; ++i) {
          const dist: number =
            i > 0
              ? Cartesian3.distance(
                  sampledCartesians[i - 1],
                  sampledCartesians[i]
                )
              : 0;
          stepDistances.push(dist);
        }

        const stopAirDistances: number[] = [0];
        const distances3d: number[] = [0];
        for (let i = 0; i < originalStopsIndex.length - 1; ++i) {
          stopAirDistances.push(
            Cartesian3.distance(
              sampledCartesians[originalStopsIndex[i + 1]],
              sampledCartesians[originalStopsIndex[i]]
            )
          );
          distances3d.push(
            stepDistances
              .filter(
                (_, index) =>
                  index > originalStopsIndex[i] &&
                  index <= originalStopsIndex[i + 1]
              )
              .reduce((sum: number, current: number) => sum + current, 0)
          );
        }

        // update state of Terria
        this.updatePath(
          cartoPositions,
          stopGeodeticDistances,
          stopAirDistances,
          distances3d,
          sampledCartographics,
          stepDistances,
          this.userDrawing.closeLoop
        );
      }
    );
  }

  // action to update state of the path in Terria
  @action
  updatePath(
    stopPoints: Cartographic[],
    stopGeodeticDistances: number[],
    stopAirDistances: number[],
    stopGroundDistances: number[],
    sampledPoints: Cartographic[],
    sampledDistances: number[],
    isClosed: boolean
  ) {
    this.terria.path = {
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
        (sum, current) => sum + current,
        0
      ),
      sampledPoints: sampledPoints,
      sampledDistances: sampledDistances
    };
  }

  @action
  updateDistance(pointEntities: CustomDataSource) {
    this.totalDistanceMetres = 0;
    if (pointEntities.entities.values.length < 1) {
      return;
    }

    const prevPoint = pointEntities.entities.values[0];
    let prevPointPos = prevPoint.position!.getValue(
      this.terria.timelineClock.currentTime
    );
    for (let i = 1; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );

      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, currentPointPos);

      prevPointPos = currentPointPos;
    }
    if (this.userDrawing.closeLoop) {
      const firstPoint = pointEntities.entities.values[0];
      const firstPointPos = firstPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );
      this.totalDistanceMetres =
        this.totalDistanceMetres +
        this.getGeodesicDistance(prevPointPos, firstPointPos);
    }
  }

  // unused since the split of MeasureAreaTool from MeasureTool
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
      positions.push(currentPointPos);
    }

    // Request the triangles that make up the polygon from Cesium.
    const tangentPlane = EllipsoidTangentPlane.fromPoints(
      positions,
      Ellipsoid.WGS84
    );
    const polygons = PolygonGeometryLibrary.polygonsFromHierarchy(
      new PolygonHierarchy(positions),
      tangentPlane.projectPointsOntoPlane.bind(tangentPlane),
      !perPositionHeight,
      Ellipsoid.WGS84
    );

    const geom = PolygonGeometryLibrary.createGeometryFromPositions(
      Ellipsoid.WGS84,
      polygons.polygons[0],
      CesiumMath.RADIANS_PER_DEGREE,
      perPositionHeight,
      VertexFormat.POSITION_ONLY
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
    }
    this.totalAreaMetresSquared = area;
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
    //super.deactivate();
    this.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.updateDistance(pointEntities);
    // avoid to compute area
    //this.updateArea(pointEntities);

    // compute sampled path
    this.sampleEntirePath(pointEntities);
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    const distance = this.prettifyNumber(this.totalDistanceMetres, false);
    let message = distance ? `<br/>Dist. geodetica: ${distance}` : "";
    if (this.totalAreaMetresSquared !== 0) {
      message +=
        "<br>" +
        `Area: ${this.prettifyNumber(this.totalAreaMetresSquared, true)}`;
    }
    return message;
  };

  /**
   * @overrides
   */
  deactivate() {
    this.onClose();
    //this.userDrawing.endDrawing();
    //super.deactivate();

    if (isDefined(this.disposeSamplingPathStep)) {
      this.disposeSamplingPathStep();
    }
  }

  /**
   * @overrides
   */
  activate() {
    this.onOpen();
    this.userDrawing.enterDrawMode();
    //super.activate();
  }
}
