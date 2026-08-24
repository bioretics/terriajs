"use strict";
import React from "react";
import { reaction } from "mobx";
import Terria from "../../../../Models/Terria";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import UserDrawingViewshed from "../../../../Models/UserDrawingViewshed";
import i18next from "i18next";

interface ViewshedToolOptions {
  terria: Terria;
  onClose(): void;
  onOpen(): void;
}

export class ViewshedTool extends MapNavigationItemController {
  static id = "viewshed-tool";
  static displayName = "ViewshedTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawingViewshed;

  onClose: () => void;
  onOpen: () => void;
  itemRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: ViewshedToolOptions) {
    super();
    this.terria = props.terria;
    this.userDrawing = new UserDrawingViewshed({
      terria: props.terria,
      messageHeader: i18next.t(($) => $.viewshed.messageHeader),
      numMaxPoints: 2,
      onCleanUp: this.onCleanUp.bind(this)
    });
    this.onClose = props.onClose;
    this.onOpen = props.onOpen;

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
    return GLYPHS.eye;
  }

  get viewerMode(): ViewerMode | undefined {
    return ViewerMode.Cesium;
  }

  onCleanUp() {
    this.onClose();
    super.deactivate();
  }

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
