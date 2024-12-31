"use strict";

import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import Terria from "../../../../Models/Terria";
import ViewState from "../../../../ReactViewModels/ViewState";
import { MeasureLineTool } from "./MeasureLineTool";
import { MeasurePolygonTool } from "./MeasurePolygonTool";

export class MeasureToolsController extends MapNavigationItemController {
  static id = "measure-tool";
  static displayName = "MeasureTools";

  private readonly viewState: ViewState;
  private isOpen: boolean;

  constructor(viewState: ViewState) {
    super();
    this.viewState = viewState;
    this.isOpen = false;
  }

  get glyph(): any {
    return GLYPHS.map;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
    this.viewState.terria.currentViewer.notifyRepaintRequired();
    console.log("toggleDropdown");
  }

  activateTool(toolId: string) {
    console.log("activateTool", toolId);
    console.log(
      "this.viewState.terria.mapNavigationModel.items",
      this.viewState.terria.mapNavigationModel.items
    );
    this.viewState.terria.mapNavigationModel.items.forEach((item) => {
      if (item.id.startsWith("measure")) {
        if (
          item.controller.active &&
          (item.controller instanceof MeasureLineTool ||
            item.controller instanceof MeasurePolygonTool)
        ) {
          item.controller.onOpen();
        }
        item.controller.deactivate();
      }
    });

    const tool = this.viewState.terria.mapNavigationModel.findItem(toolId);
    if (tool) {
      if (
        tool.controller instanceof MeasureLineTool ||
        tool.controller instanceof MeasurePolygonTool
      ) {
        tool.controller.onClose();
      }
      tool.controller.activate();
    }
  }
}
