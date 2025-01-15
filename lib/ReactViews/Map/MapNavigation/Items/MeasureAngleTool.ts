"use strict";
import i18next from "i18next";
import React from "react";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";

export interface MeasureAngleToolOptions {
  terria: Terria;
  onOpen(): void;
  onClose(): void;
}

export class MeasureAngleTool extends MapNavigationItemController {
  static id = "measure-angle-tool";
  static displayName = "MeasureAngleTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawing;

  angleMeasurements: number[] = [];

  onOpen: () => void;
  onClose: () => void;

  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: MeasureAngleToolOptions) {
    super();
    this.terria = props.terria;

    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measureAngleTool"),
      allowPolygon: false,
      autoClosePolygon: false,
      onPointClicked: this.onPointUpdated.bind(this),
      onPointMoved: this.onPointUpdated.bind(this),
      onCleanUp: this.onCleanUp.bind(this)
    });

    this.onOpen = props.onOpen;
    this.onClose = props.onClose;
  }

  get glyph(): any {
    return GLYPHS.share;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  onPointUpdated(pointEntities: CustomDataSource) {
    const points = pointEntities.entities.values
      .map((entity) =>
        entity.position?.getValue(this.terria.timelineClock.currentTime)
      )
      .filter((pos): pos is Cartesian3 => pos !== undefined);

    this.angleMeasurements = [];

    if (points.length >= 3) {
      for (let i = 0; i < points.length - 2; i++) {
        const angle = this.calculateAngle(
          points[i],
          points[i + 1],
          points[i + 2]
        );
        this.angleMeasurements.push(angle);
      }
    }
  }

  calculateAngle(p1: Cartesian3, p2: Cartesian3, p3: Cartesian3): number {
    const carto1 = Ellipsoid.WGS84.cartesianToCartographic(p1);
    const carto2 = Ellipsoid.WGS84.cartesianToCartographic(p2);
    const carto3 = Ellipsoid.WGS84.cartesianToCartographic(p3);

    const x1 = carto1.longitude;
    const y1 = carto1.latitude;
    const x2 = carto2.longitude;
    const y2 = carto2.latitude;
    const x3 = carto3.longitude;
    const y3 = carto3.latitude;

    const v1 = { x: x1 - x2, y: y1 - y2 };
    const v2 = { x: x3 - x2, y: y3 - y2 };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const norm1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const norm2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (norm1 === 0 || norm2 === 0) return 0;

    let angleRad = Math.acos(dot / (norm1 * norm2));

    const angleDeg = angleRad * (180 / Math.PI);
    return angleDeg;
  }

  onMakeDialogMessage = () => {
    if (this.angleMeasurements.length === 0) return "";
    let message = "";
    this.angleMeasurements.forEach((angle, index) => {
      message += `${i18next.t("measure.angle")} ${index + 1}: ${angle.toFixed(
        2
      )}°<br/>`;
    });
    return message;
  };

  onCleanUp() {
    this.angleMeasurements = [];
    this.onClose();
    super.deactivate();
  }

  activate() {
    this.onOpen();
    this.userDrawing.enterDrawMode(MeasureAngleTool.id);
    super.activate();
  }

  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }
}
