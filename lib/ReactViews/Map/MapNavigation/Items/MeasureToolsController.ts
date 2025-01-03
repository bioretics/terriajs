"use strict";

import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";

export class MeasureToolsController extends MapNavigationItemController {
  static id = "measure-tool";
  static displayName = "MeasureTools";

  constructor() {
    super();
  }

  get glyph(): any {
    return GLYPHS.map;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }
}
