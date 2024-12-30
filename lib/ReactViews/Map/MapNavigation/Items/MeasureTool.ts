"use strict";

import { runInAction } from "mobx";
import React from "react";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";

export class MeasureTool extends MapNavigationItemController {
  static id = "measure-tool";
  static displayName = "Measure Tool";

  constructor(private terria: any, private viewState: any) {
    super();
  }

  get glyph(): any {
    return GLYPHS.measure;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  activate() {
    runInAction(() => {
      console.log("this.viewState.panel", this.viewState.panel);
      this.viewState.panel = "measureTool";
    });
  }

  deactivate() {
    runInAction(() => {
      this.viewState.panel = undefined; // Chiudi il pannello
    });
  }
}
