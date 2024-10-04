"use strict";
import i18next from "i18next";
import React from "react";
import ArcType from "terriajs-cesium/Source/Core/ArcType";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import EllipsoidTangentPlane from "terriajs-cesium/Source/Core/EllipsoidTangentPlane";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import PolygonGeometryLibrary from "terriajs-cesium/Source/Core/PolygonGeometryLibrary";
import PolygonHierarchy from "terriajs-cesium/Source/Core/PolygonHierarchy";
import VertexFormat from "terriajs-cesium/Source/Core/VertexFormat";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import { MeasureToolOptions } from "./MeasureLineTool";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";

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

  constructor(props: MeasureToolOptions) {
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
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this)
    });
    this.onOpen = props.onOpen;
    this.onClose = props.onClose;
  }

  get glyph(): any {
    return GLYPHS.measurePolygon;
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
    this.terria.measurableGeometryManager.sampleFromCustomDataSource(
      pointEntities,
      this.userDrawing.closeLoop
    );
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  onMakeDialogMessage = () => {
    return this.totalDistanceMetres === 0 ? "" : `
      <table>
        <tbody>
          <tr>
            <td>${i18next.t("measure.measurePolygonToolMessagePerimeter")}: </td>
            <td>${this.totalDistanceMetres
        ? this.prettifyNumber(this.totalDistanceMetres, false)
        : ""
      }</td>
          </tr>
          <tr>
            <td>${i18next.t("measure.measurePolygonToolMessageArea")}:</td>
            <td>${this.totalAreaMetresSquared
        ? this.prettifyNumber(this.totalAreaMetresSquared, true)
        : ""
      }</td>
          </tr>
          <tr>
            <td></td>
            <td>${this.totalAreaMetresSquared
        ? (this.totalAreaMetresSquared * 0.0001).toFixed(2) + " ha"
        : ""
      }</td>
          </tr>
        </tbody>
      </table>
    `;
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
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}
