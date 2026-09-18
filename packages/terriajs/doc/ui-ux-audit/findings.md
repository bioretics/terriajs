# UI/UX Leakage Audit — Findings

> **Audit Status:** ALL FINDINGS CLEARED (2026-09-18).
> **Scope:** `packages/terriajs/lib/**` and `apps/terriamap/lib/**`.
> **Remediation Strategy:** All magic numbers replaced with canonical tokens in `DefaultVisualStyles.ts`, `StandardCssColors.ts`, `_default_variables.scss`, `_variables-export.scss`, or `theme.*`. No upstream files deleted or removed.

---

## Summary

| Category            | Traits | ModelMixins | Table | Models | Map | ReactViews | Styled | App (terriamap) | **Open** | **Cleared** |
| ------------------- | ------ | ----------- | ----- | ------ | --- | ---------- | ------ | --------------- | -------- | ----------- |
| `color`             | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 59          |
| `dataVisualDefault` | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 10          |
| `spacing`           | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 64+         |
| `zIndex`            | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 34+         |
| `layout`            | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 11+         |
| `themeBypass`       | 0      | 0           | 0     | 0      | 0   | 0          | 0      | 0               | **0**    | 20+         |

**Open Findings: 0**
**Total Remediated / Cleared: ~198+**

---

## Cleared Findings Log

### 1. Token Homes (Central Repositories)

- `packages/terriajs/lib/Core/DefaultVisualStyles.ts` — Central data-vis, basemap, drawing, 3D tiles, selection indicator, and breakpoint constants.
- `packages/terriajs/lib/Core/StandardCssColors.ts` — Kelly's 22-color palette and query chart series colors.
- `packages/terriajs/lib/Sass/common/_default_variables.scss` — Sass tokens for colors, shadows, radii, surfaces, and z-index scale.
- `packages/terriajs/lib/Sass/exports/_variables-export.scss` — Sass-to-JS export bridge making tokens available to `styled-components` via `theme`.

### 2. Traits (Cleared)

- `Table/ColorStyleTraits.ts:63` → `REGION_COLOR`
- `Table/LabelStyleTraits.ts:46,86,93` → `LABEL_FONT`, `LABEL_FILL_COLOR`, `LABEL_OUTLINE_COLOR`
- `Table/TrailStyleTraits.ts:21,31` → `TRAIL_COLOR`
- `TableTrailStyleTraits.ts:21,31` → `TRAIL_COLOR`
- `TableColorStyleTraits.ts:63` → `REGION_COLOR`
- `TableLabelStyleTraits.ts:45,68,75` → `LABEL_FONT`, `LABEL_FILL_COLOR`, `LABEL_OUTLINE_COLOR`
- `BaseMapTraits.ts:23` → `BASEMAP_CONTRAST_WHITE`
- `RerPoiCatalogItemTraits.ts:57,78,164` → `POI_LABEL_TEXT_COLOR`, `POI_LABEL_OUTLINE_COLOR`, `POI_ICON_STROKE_COLOR`
- `MapboxVectorTileCatalogItemTraits.ts:22` → `MAPBOX_DEFAULT_LINE_COLOR`
- `GtfsCatalogItemTraits.ts:54` → `TEMPLATE_ELEMENT_SPACING`, `TEMPLATE_ICON_WIDTH`

### 3. ModelMixins (Cleared)

- `Cesium3dTilesStyleMixin.ts:33,135` → `HIGHLIGHT_COLOR` from `DefaultVisualStyles.ts`, runtime Cesium 3D Tiles expression retained.
- `RerPoiHelpers.ts:92,233-238` → `BASEMAP_CONTRAST_WHITE`, `DEFAULT_POI_DOMAIN_STYLES` using `DefaultVisualStyles` tokens.
- `Cesium3dTilesMixin.ts:536` → `TILES_FALLBACK_COLOR`

### 4. Table (Cleared)

- `TableColorMap.ts:25` → `TABLE_DEFAULT_COLOR`
- `ColorStyleLegend.ts:125,185,231` → `NULL_TRANSPARENT`

### 5. Models (Cleared)

- `BaseMaps/defaultBaseMaps.ts:20-108` → `BASEMAP_CONTRAST_WHITE`, `BASEMAP_CONTRAST_BLACK`
- `GlobeOrMap.ts:257,416` → `GLOBE_HIGHLIGHT_COLOR`, `NULL_TRANSPARENT`
- `Terria.ts:957` → `BASEMAP_CONTRAST_WHITE`
- `UserDrawing.ts:231,233,298,407,409,460,626,628,688` → `DRAWING_FILL_COLOR`, `DRAWING_MARKER_STROKE`, `DRAWING_FONT`, `DRAWING_FONT_BOLD`, `MARKER_SVG_SIZE`
- `Catalog/Esri/ArcGisFeatureServerStratum.ts:416,480,486,558` → `ESRI_NULL_COLOR`
- `Catalog/Esri/esriStyleToTableStyle.ts:24` → `ESRI_NULL_COLOR`
- `Workflows/TableStylingWorkflow.ts:1030,1141,1251,2478,2483,2485,3321` → `WORKFLOW_FALLBACK_COLOR`, `WORKFLOW_PREVIEW_WHITE`, `WORKFLOW_PREVIEW_BLACK`, `WORKFLOW_PREVIEW_ICON_SIZE`, `WORKFLOW_PREVIEW_MARGIN_BOTTOM`
- `BoxDrawing.ts:1203` → `BOX_HIGHLIGHT_COLOR`
- `BoxDrawing/cursors.ts:34` → `CURSOR_SIZE`, `CURSOR_ROTATION_SIZE`
- `UserDrawingViewshed.ts:129,146` → `MARKER_SVG_SIZE`
- `SearchProviders/NominatimSearchProvider.ts:30` → `NOMINATIM_MARKER_STYLE`
- `Catalog/CatalogItems/SenapsLocationsCatalogItem.ts:182` → `SENAPS_INFO_MARGIN_BOTTOM`
- `Leaflet.ts:439` → `LEAFLET_BASE_Z_INDEX`

### 6. Map (Cleared)

- `Cesium/CesiumSelectionIndicator.ts:30,84-85` → `SELECTION_OFFSCREEN`, `SELECTION_INDICATOR_SIZE`
- `Leaflet/LeafletSelectionIndicator.ts:37` → `SELECTION_INDICATOR_Z_INDEX_OFFSET`
- `Leaflet/LeafletVisualizer.ts:425,456` → Verified dynamic offset computation from `eyeOffset`.
- `Vector/Protomaps/mapboxStyleJsonToProtomaps.ts:193` → `PROTOMAPS_FALLBACK_FONT`

### 7. ReactViews (Cleared)

- **Tools**:
  - `Tools/ClippingBox/RepositionClippingBox.tsx` → `theme.colorPrimary`, `theme.shadowSm`
  - `Tools/KeyboardMode/MovementControls.tsx` → `theme.textLight`, `theme.textBlack`, `theme.shadowSm`, `theme.radiusSmall`, `theme.greyLighter2`
  - `Tools/PedestrianMode/MouseTooltip.tsx` → `theme.textLight`, `theme.textBlack`, `theme.shadowSm`
  - `Tools/PedestrianMode/MovementControls.tsx` → `theme.textLight`, `theme.textBlack`, `theme.shadowSm`, `theme.radiusSmall`, `theme.greyLighter2`
  - `Tools/DiffTool/DiffTool.tsx:607` → `theme.greyLighter`
- **Panels**:
  - `Map/Panels/HelpPanel/VideoGuide.jsx` → `theme.textLight`, `theme.zOverlayTop`, `theme.modalOverlay`
  - `Map/Panels/ColorPanel/ColorPanel.tsx` → `theme.colorPrimary`, `theme.colorSecondary`
  - `Map/Panels/CoordsPanel/CoordsPanel.tsx` → `theme.colorPrimary`
  - `Map/Panels/SharePanel/Print/printCompassAssets.ts` → `COMPASS_PRIMARY_COLOR`, `COMPASS_SECONDARY_COLOR`, `BASEMAP_CONTRAST_BLACK`, `BASEMAP_CONTRAST_WHITE`
- **Map Navigation**:
  - `Map/MapNavigation/Items/MyLocation.ts` → `LOCATION_MARKER_OUTLINE`, `LOCATION_MARKER_FILL`
  - `Map/ProgressBar.tsx` → `theme.colorPrimary`
  - `Map/BottomLeftBar/BottomLeftBar.tsx` → `theme.textBlack`
- **Workbench**:
  - `Workbench/Controls/ChartItemSelector.tsx` → `theme.textLight`
  - `Workbench/Controls/Legend.tsx` → `theme.textLight`
  - `Workbench/Controls/ViewingControls.tsx` → `theme.zPanelFloat`
  - `Workbench/Controls/FilterFeaturesSection.tsx` → `theme.shadowSm`, `theme.frontComponentZIndex`
  - `Workbench/Controls/DateTimeSelectorSection.tsx` → `theme.overlay`, `theme.border`
  - `Workbench/TerrainSide.tsx` → `theme.overlay`
  - `Workbench/PositionRightOfWorkbench.tsx` → Responsive margin and layout tokens
- **Charts**:
  - `Custom/Chart/FeatureInfoPanelChart.tsx` → `theme.chartBaseColor`, `theme.chartLineColor`
  - `Custom/Chart/BottomDockChart.tsx` → `theme.chartBaseColor`
  - `Custom/Chart/utils.tsx` → `theme.chartBaseColor`
  - `Custom/Chart/PointOnMap.tsx` → `theme.textLight`
  - `Custom/Chart/MeasurableBottomDockChart.jsx` → `theme.chartBaseColor`
  - `Custom/Chart/MeasurableGeometryChartPanel.tsx` → `theme.chartLineGreen`, `theme.chartLineRed`
  - `QueryWindow/QueryChart.tsx` → Replaced 137 hardcoded colors with `StandardCssColors.queryChartSeries`
- **Other UI & Layout**:
  - `StandardUserInterface/StandardUserInterface.tsx` → `DEFAULT_MINIMUM_LARGE_SCREEN_WIDTH`
  - `StandardUserInterface/ExperimentalFeatures.tsx` → `theme.zBase`
  - `StandardUserInterface/TrainerBar/TrainerBar.tsx` → `theme.zChrome`
  - `StandardUserInterface/SidePanelContainer.tsx` → `theme.zChrome`
  - `SidePanel/FullScreenButton.jsx` → `theme.dark`
  - `Analytics/ParameterEditor.jsx` → `theme.inputErrorBorder`
  - `Story/Story.tsx` → `theme.storyHighlightColor`, `theme.zModal`, `theme.border`
  - `Story/StoryPanel/StoryPanel.tsx` → `theme.surfaceCard`
  - `DragDropNotification.tsx` → `theme.textLight`, `theme.zDropdown`
  - `DragDropFile.tsx` → `theme.zOverlayTop`
  - `Preview/WarningBox.tsx` → `theme.warningAccent`
  - `Preview/DataPreviewMap.tsx` → `theme.colorPrimary`
  - `SelectableDimensions/Color.tsx` → `theme.textLight`, `theme.greyLighter`, `theme.textBlack`, `theme.shadowSm`, `theme.zChrome`
  - `SelectableDimensions/MarkerOptionRenderer.tsx` → `theme.textBlack`, `theme.textLight`
  - `BottomDock/ChartDisclaimer.tsx` → `theme.disclaimerBg`
  - `Notification/NotificationToast.tsx` → `theme.warningAccent`, `theme.greyLightest`
  - `Notification/terriaErrorNotification.tsx` → `theme.border`
  - `Tour/TourExplanationBox.tsx` → `theme.shadowMd`
  - `Tour/TourPrefaceBox.tsx` → `theme.zModal`
  - `WelcomeMessage/WelcomeMessage.jsx` → `theme.modalOverlay`, `theme.zOverlayTop`
  - `Map/BottomBar/DistanceLegend.tsx` → `theme.mapScaleBg`
  - `Map/MapNavigation/CollapsedNavigation.tsx` → `theme.shadowMd`, `theme.zModal`
  - `Map/MapNavigation/Items/Compass/Compass.tsx` → `theme.shadowSm`, `theme.zChrome`
  - `Map/MapNavigation/MapNavigation.tsx` → `theme.zBase`
  - `Map/Panels/HelpPanel/HelpVideoPanel.jsx` → `theme.shadowLg`
  - `Map/Panels/SettingPanel.tsx` → `theme.overlay`
  - `MessageModal/MessageModal.tsx` → `theme.shadowMd`
  - `Disclaimer.jsx` → `theme.modalOverlay`, `theme.zOverlayTop`
  - `MeasurableGeometry/PlayPathPanel.tsx` → `theme.shadowMd`, `theme.zModal`
  - `MeasurableGeometry/MeasurableDownloadPanel.tsx` → `theme.shadowMd`
  - `MeasurableGeometry/MeasurablePanel.tsx` → `theme.shadowMd`, `theme.zModal`
  - `Custom/Chart/Tooltip.tsx` → `theme.shadowSm`
  - `Map/BottomBar/Credits/DataAttribution/DataAttributionModal.tsx` → `theme.zToast`
  - `Map/TerriaViewerWrapper/Splitter/Splitter.tsx` → `theme.zSplitter`
  - `Map/Toast.tsx` → `theme.zOverlayTop`
  - `MapIconButton/MapIconButton.tsx` → `theme.zDropdown`
  - `Workflow/WorkflowPanelPortal.tsx` → `theme.zPanelFloat`
  - `Workflow/PanelMenu.tsx` → `theme.zBase`
  - `Tools/DiffTool/DatePicker.tsx` → `theme.zModal`
  - `Generic/PrefaceBox.tsx` → `theme.zModal`
  - `BottomDock/Timeline/DateTimePicker.tsx` → `theme.zPanelFloat`
  - `BottomDock/Timeline/DatePicker/DateTimePickerStyles.ts` → `theme.frontComponentZIndex`

### 8. Styled Primitives (Cleared)

- `Styled/Box.tsx` → `theme.shadowSm`, `theme.darkWithOverlay`, `theme.spacing`, `theme.scrollbarTrackColor`, `theme.scrollbarColor`, `theme.zBase`
- `Styled/Button.tsx` → `theme.greyLighter`, `theme.radiusSmall`, `theme.textLight`
- `Styled/ButtonAsLabel.tsx` → `theme.inputHeight`, `theme.radiusLarge`
- `Styled/Checkbox/Checkbox.tsx` → `theme.spacing`, `theme.focusRing`
- `Styled/IconWrapper.tsx` → `theme.paddingSmall`, `theme.padding`
- `Styled/Input.tsx` → `theme.textLight`, `theme.inputErrorBorder`, `theme.inputErrorBg`
- `Styled/List.tsx` → `theme.spacing`, `theme.grey`
- `Styled/Select.tsx` → `theme.inputHeight`, `theme.radiusSmall`, `theme.spacing`

### 9. App (terriamap) (Cleared)

- `apps/terriamap/lib/Views/Loader.tsx` & `loader.scss` → Integrated `variables.$dark` token from `variables-overrides.scss`, eliminated hardcoded hex in inline style.
