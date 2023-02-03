"use strict";
import i18next from "i18next";
import { action } from "mobx";
import React from "react";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
//import PolygonGeometryLibrary from "terriajs-cesium/Source/Core/PolygonGeometryLibrary";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
//import ViewState from "../../../../ReactViewModels/ViewState";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import TerrainProvider from "terriajs-cesium/Source/Core/TerrainProvider";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
const PolylinePipeline =
  require("terriajs-cesium/Source/Core/PolylinePipeline").default;
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

  async updateSampledPath(
    index: number,
    pointA: Cartographic,
    pointB: Cartographic,
    terrainProvider: TerrainProvider,
    ellipsoid: Ellipsoid
  ) {
    const granularity = 0.00001;
    const cartesians = ellipsoid.cartographicArrayToCartesianArray([
      pointA,
      pointB
    ]);
    const interpolatedCartographics =
      ellipsoid.cartesianArrayToCartographicArray(
        PolylinePipeline.generateCartesianArc({
          positions: cartesians,
          granularity: granularity
        })
      );

    const sampledCartographics = await sampleTerrainMostDetailed(
      terrainProvider,
      interpolatedCartographics
    );
    const sampledCartesians =
      ellipsoid.cartographicArrayToCartesianArray(sampledCartographics);

    let totalDistance: number = 0;
    const stepDistances: number[] = [];
    for (let i = 0; i < sampledCartesians.length; ++i) {
      const dist: number =
        i > 0
          ? Cartesian3.distance(sampledCartesians[i - 1], sampledCartesians[i])
          : 0;
      totalDistance += dist;
      stepDistances.push(dist);
    }

    const res = {
      key: `${JSON.stringify(pointA)} ${JSON.stringify(pointB)}`,
      index: index,
      totalDistance: totalDistance,
      stepDistances: stepDistances,
      stepHeights: sampledCartographics.map((elem) => elem.height)
    };

    return res;
  }

  @action
  updateDistance(pointEntities: CustomDataSource) {
    this.totalDistanceMetres = 0;
    if (pointEntities.entities.values.length < 1) {
      return;
    }

    const pathPoints: Cartographic[] = [];
    const pathDistances: number[] = [];
    const prevPoint = pointEntities.entities.values[0];
    let prevPointPos = prevPoint.position!.getValue(
      this.terria.timelineClock.currentTime
    );

    pathPoints.push(Cartographic.fromCartesian(prevPointPos, Ellipsoid.WGS84));
    pathDistances.push(0);

    const terrainProvider = this.terria.cesium?.scene.terrainProvider;
    const ellipsoid = this.terria.cesium?.scene.globe.ellipsoid;

    for (let i = 1; i < pointEntities.entities.values.length; i++) {
      const currentPoint = pointEntities.entities.values[i];
      const currentPointPos = currentPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );

      const dist = this.getGeodesicDistance(prevPointPos, currentPointPos);

      this.totalDistanceMetres = this.totalDistanceMetres + dist;

      const currentCarto = Cartographic.fromCartesian(
        currentPointPos,
        Ellipsoid.WGS84
      );

      if (!!terrainProvider && !!ellipsoid) {
        const key = `${JSON.stringify(
          pathPoints[pathPoints.length - 1]
        )} ${JSON.stringify(currentCarto)}`;
        if (!(key in this.terria.pathSampled)) {
          this.updateSampledPath(
            i,
            pathPoints[pathPoints.length - 1],
            currentCarto,
            terrainProvider,
            ellipsoid
          ).then(
            action((res) => {
              this.terria.pathSampled = {
                ...this.terria.pathSampled,
                [res.key]: res
              };
            })
          );
        }
      }

      pathPoints.push(currentCarto);
      pathDistances.push(dist);

      prevPointPos = currentPointPos;
    }
    if (this.userDrawing.closeLoop) {
      const firstPoint = pointEntities.entities.values[0];
      const firstPointPos = firstPoint.position!.getValue(
        this.terria.timelineClock.currentTime
      );

      const dist = this.getGeodesicDistance(prevPointPos, firstPointPos);

      this.totalDistanceMetres = this.totalDistanceMetres + dist;

      pathPoints.push(
        Cartographic.fromCartesian(firstPointPos, Ellipsoid.WGS84)
      );
      pathDistances.push(dist);
    }

    this.terria.pathPoints = pathPoints;
    this.terria.pathDistances = pathDistances;

    /*if (pathDistances.length > 0) {
      this.viewState.elevationPanelIsVisible = true;
    }*/
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
    this.terria.pathSampled = {};
    this.totalDistanceMetres = 0;
    this.totalAreaMetresSquared = 0;
    //super.deactivate();
    this.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    this.updateDistance(pointEntities);
    //this.updateArea(pointEntities);
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    const distance = this.prettifyNumber(this.totalDistanceMetres, false);
    let message = distance ? `Lunghezza: ${distance}` : "";
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
