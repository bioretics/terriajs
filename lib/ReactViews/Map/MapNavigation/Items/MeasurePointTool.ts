"use strict";
import i18next from "i18next";
import React from "react";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";

export interface MeasureToolOptions {
  terria: Terria;
  onOpen(): void;
  onClose(): void;
}

export class MeasurePointTool extends MapNavigationItemController {
  static id = "measure-point-tool";
  static displayName = "MeasurePointTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawing;

  onOpen: () => void;
  onClose: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: MeasureToolOptions) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("measure.measurePointTool"),
      allowPolygon: false,
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this)
    });
    this.onOpen = props.onOpen;
    this.onClose = props.onClose;
  }

  get glyph(): any {
    return GLYPHS.menuDotted;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  onCleanUp() {
    this.onClose();
    super.deactivate();
  }

  onPointClicked(pointEntities: CustomDataSource) {
    console.log("Ho cliccato su: ", pointEntities);
    this.terria.measurableGeometryManager.sampleFromCustomDataSource(
      pointEntities,
      this.userDrawing.closeLoop,
      true
    );
  }

  onPointMoved(pointEntities: CustomDataSource) {
    console.log("Ho spostato: ", pointEntities);
  }

  onMakeDialogMessage = () => {
    return i18next.t("measure.measurePointToolTitle");
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
    this.userDrawing.enterDrawMode(MeasurePointTool.id);
    super.activate();
  }
}
