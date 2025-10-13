"use strict";
import { observable, runInAction } from "mobx";
import React from "react";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Terria from "../../../../Models/Terria";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import UserDrawingViewshed from "../../../../Models/UserDrawingViewshed";

interface ViewshedToolOptions {
  terria: Terria;
  onClose(): void;
  onOpen(): void;
}

export default class ViewshedTool extends MapNavigationItemController {
  static id = "viewshed-tool";
  static displayName = "ViewshedTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawingViewshed;

  @observable private distOrig?: number;
  @observable private distInter?: number;

  onClose: () => void;
  onOpen: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: ViewshedToolOptions) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawingViewshed({
      terria: props.terria,
      messageHeader: "Linea di vista",
      numMaxPoints: 2,
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      onPointClicked: this.onPointClicked.bind(this),
      onPointMoved: this.onPointMoved.bind(this),
      onCleanUp: this.onCleanUp.bind(this)
    });
    this.onClose = props.onClose;
    this.onOpen = props.onOpen;
  }

  get glyph(): any {
    return GLYPHS.eye;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  onCleanUp() {
    this.terria.viewshedDistances = undefined;
    this.distOrig = undefined;
    this.distInter = undefined;
    this.deactivate();
  }

  onPointClicked(_: CustomDataSource) {
    runInAction(() => {
      this.distOrig =
        this.terria.viewshedDistances && this.terria.viewshedDistances[0];
      this.distInter =
        this.terria.viewshedDistances && this.terria.viewshedDistances[1];
    });
  }

  onPointMoved(pointEntities: CustomDataSource) {
    // This is no different to clicking a point.
    this.onPointClicked(pointEntities);
  }

  /**
   * @overrides
   */
  deactivate() {
    this.onClose();
  }

  /**
   * @overrides
   */
  activate() {
    this.onOpen();
    this.userDrawing.enterDrawMode();
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
    numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;

    return numberStr;
  }

  onMakeDialogMessage = () => {
    return `
      <br/>
      <table>
        <tbody>
        <tr>
            <td>${
              this.distOrig && this.distInter
                ? Math.abs(this.distOrig - this.distInter) < 0.01
                  ? "VISIBILE"
                  : "COPERTO"
                : ""
            }</td>
          </tr>
          <tr/>
          <tr>
            <td>Distanza:</td>
            <td>${this.distOrig ? this.prettifyNumber(this.distOrig) : ""}</td>
          </tr>
          <tr/>
          <tr>
            <td>Distanza visibile:</td>
            <td>${
              this.distInter ? this.prettifyNumber(this.distInter) : ""
            }</td>
          </tr>
        </tbody>
      </table>
    `;
  };
}
