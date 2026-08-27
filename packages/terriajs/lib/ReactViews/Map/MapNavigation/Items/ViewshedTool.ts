"use strict";
import React from "react";
import { action, computed, makeObservable, observable, reaction } from "mobx";
import Terria from "../../../../Models/Terria";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import UserDrawingViewshed from "../../../../Models/UserDrawingViewshed";
import UserDrawingViewshedArea from "../../../../Models/UserDrawingViewshedArea";
import ViewState from "../../../../ReactViewModels/ViewState";
import i18next from "i18next";

/** Tiny expand/collapse state for the viewshed toolbar group (like MeasureTools). */
export class ViewshedTools {
  @observable private _active = false;

  constructor() {
    makeObservable(this);
  }

  @computed
  get active() {
    return this._active;
  }

  @action
  activate() {
    this._active = true;
  }

  @action
  deactivate() {
    this._active = false;
  }
}

interface ViewshedToolsControllerOptions {
  terria: Terria;
  viewState: ViewState;
  viewshedTools: ViewshedTools;
}

export class ViewshedToolsController extends MapNavigationItemController {
  static id = "viewshed-tools";
  static displayName = "ViewshedTools";

  constructor(private props: ViewshedToolsControllerOptions) {
    super();
    makeObservable(this);
  }

  @computed
  get active(): boolean {
    return this.props.viewshedTools.active;
  }

  get glyph(): any {
    return GLYPHS.eye;
  }

  get viewerMode(): ViewerMode | undefined {
    return ViewerMode.Cesium;
  }

  activate() {
    this.props.viewshedTools.activate();
  }

  deactivate() {
    // Collapse children when the parent is closed.
    const line = this.props.terria.mapNavigationModel.findItem(
      ViewshedTool.id
    )?.controller;
    const area = this.props.terria.mapNavigationModel.findItem(
      ViewshedAreaTool.id
    )?.controller;
    if (line?.active) line.deactivate();
    if (area?.active) area.deactivate();
    this.props.viewshedTools.deactivate();
  }
}

interface ViewshedChildToolOptions {
  terria: Terria;
  viewState: ViewState;
  viewshedTools: ViewshedTools;
  onClose?(): void;
  onOpen?(): void;
}

export class ViewshedTool extends MapNavigationItemController {
  static id = "viewshed-tool";
  static displayName = "ViewshedTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawingViewshed;

  onClose: () => void;
  onOpen: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: ViewshedChildToolOptions) {
    super();
    makeObservable(this);
    this.terria = props.terria;
    this.userDrawing = new UserDrawingViewshed({
      terria: props.terria,
      messageHeader: i18next.t(($) => $.viewshed.messageHeader),
      numMaxPoints: 2,
      onMakeDialogMessage: this.onMakeDialogMessage.bind(this),
      onCleanUp: this.onCleanUp.bind(this)
    });
    this.onClose = props.onClose || (() => {});
    this.onOpen = props.onOpen || (() => {});

    reaction(
      () => this.terria.mainViewer.viewerMode,
      (viewerMode) => {
        if (viewerMode !== ViewerMode.Cesium && this._active) {
          this.deactivate();
        }
      }
    );
  }

  get glyph(): any {
    return GLYPHS.difference;
  }

  get viewerMode(): ViewerMode | undefined {
    return ViewerMode.Cesium;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.viewshedTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  onCleanUp() {
    this.terria.viewshedDistances = undefined;
    this.onClose();
    super.deactivate();
  }

  deactivate() {
    this.onClose();
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  activate() {
    this.onOpen();
    this.userDrawing.enterDrawMode();
    super.activate();
  }

  prettifyNumber(number: number) {
    if (number <= 0) {
      return "";
    }
    let label = "m";
    if (number > 999) {
      label = "Km";
      number = number / 1000.0;
    }
    let numberStr = number.toFixed(2);
    numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    numberStr = `${numberStr} ${label}`;

    return numberStr;
  }

  onMakeDialogMessage = () => {
    const distOrig =
      this.terria.viewshedDistances && this.terria.viewshedDistances[0];
    const distInter =
      this.terria.viewshedDistances && this.terria.viewshedDistances[1];

    return `
      <br/>
      <table>
        <tbody>
        <tr>
            <td>${
              distOrig && distInter
                ? Math.abs(distOrig - distInter) < 0.01
                  ? i18next.t(($) => $.viewshed.resultOk)
                  : i18next.t(($) => $.viewshed.resultKo)
                : ""
            }</td>
          </tr>
          <tr/>
          <tr>
            <td>${i18next.t(($) => $.viewshed.distance)}</td>
            <td>${distOrig ? this.prettifyNumber(distOrig) : ""}</td>
          </tr>
          <tr/>
          <tr>
            <td>${i18next.t(($) => $.viewshed.distanceVisible)}</td>
            <td>${distInter ? this.prettifyNumber(distInter) : ""}</td>
          </tr>
        </tbody>
      </table>
    `;
  };
}

export class ViewshedAreaTool extends MapNavigationItemController {
  static id = "viewshed-area-tool";
  static displayName = "ViewshedAreaTool";

  private readonly terria: Terria;
  private readonly viewState: ViewState;
  private userDrawing: UserDrawingViewshedArea;

  onClose: () => void;
  onOpen: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(private props: ViewshedChildToolOptions) {
    super();
    makeObservable(this);
    this.terria = props.terria;
    this.viewState = props.viewState;
    this.userDrawing = new UserDrawingViewshedArea({
      terria: props.terria,
      messageHeader: i18next.t(($) => $.viewshed.areaMessageHeader),
      onCleanUp: this.onCleanUp.bind(this),
      invisible: true
    });
    this.onClose = props.onClose || (() => {});
    this.onOpen = props.onOpen || (() => {});

    reaction(
      () => this.terria.mainViewer.viewerMode,
      (viewerMode) => {
        if (viewerMode !== ViewerMode.Cesium && this._active) {
          this.deactivate();
        }
      }
    );
  }

  get glyph(): any {
    return GLYPHS.sphere;
  }

  get viewerMode(): ViewerMode | undefined {
    return ViewerMode.Cesium;
  }

  @computed
  get visible(): boolean {
    return (
      (this.props.viewshedTools.active ||
        this.props.viewState.useSmallScreenInterface) &&
      super.visible
    );
  }

  onCleanUp() {
    this.viewState.viewshedAreaPanelIsVisible = false;
    this.onClose();
    super.deactivate();
  }

  deactivate() {
    this.onClose();
    this.viewState.viewshedAreaPanelIsVisible = false;
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  activate() {
    this.onOpen();
    this.viewState.viewshedAreaPanelIsVisible = true;
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}
