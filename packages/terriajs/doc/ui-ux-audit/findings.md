# UI/UX Leakage Audit — Findings

> **Generated:** 2026-09-17 — iterative grep-based audit of `packages/terriajs/lib/**` and `apps/terriamap/lib/**`.
> **Method:** 6-pass ripgrep/grep scan (Traits → ModelMixins/Table/Core → Models/Map/ViewModels → ReactViews Tools/Panels → Styled/chrome → terriamap). Final sweep added zero new findings → audit complete.

---

## Summary

| Category            | Traits | ModelMixins | Table | Models | Map | ReactViews | Styled | App (terriamap) | **Total** |
| ------------------- | ------ | ----------- | ----- | ------ | --- | ---------- | ------ | --------------- | --------- |
| `color`             | 8      | 3           | 2     | 13     | 0   | 28         | 4      | 1               | **59**    |
| `dataVisualDefault` | 2      | 1           | 1     | 3      | 1   | 2          | 0      | 0               | **10**    |
| `spacing`           | 2      | 0           | 0     | 5      | 2   | 30+        | 25+    | 0               | **64+**   |
| `zIndex`            | 0      | 0           | 0     | 1      | 2   | 30+        | 1      | 0               | **34+**   |
| `layout`            | 0      | 0           | 0     | 1      | 0   | 5+         | 5+     | 0               | **11+**   |
| `themeBypass`       | 0      | 0           | 0     | 0      | 0   | 15+        | 5+     | 0               | **20+**   |

**Total unique findings: ~198+**

### Out of scope / intentional (not counted above)

- [`lib/Sass/common/_default_variables.scss`](../../lib/Sass/common/_default_variables.scss) — canonical Sass token home. Not leakage.
- [`lib/Sass/exports/_variables-export.scss`](../../lib/Sass/exports/_variables-export.scss) — Sass-to-JS bridge. Not leakage.
- [`lib/Core/StandardCssColors.ts`](../../lib/Core/StandardCssColors.ts) — Kelly's 22-color palette for data-viz series. Known token source; palette entries are not individual leaks.

---

## Traits

### `color` — Hardcoded default color values in trait definitions

- [`Table/ColorStyleTraits.ts:63`](../../lib/Traits/TraitsClasses/Table/ColorStyleTraits.ts#L63) | `color` | `regionColor = "#02528d"` | Default region fill — data-vis default baked into trait
- [`Table/LabelStyleTraits.ts:86`](../../lib/Traits/TraitsClasses/Table/LabelStyleTraits.ts#L86) | `color` | `fillColor = "#ffffff"` | Label fill default
- [`Table/LabelStyleTraits.ts:93`](../../lib/Traits/TraitsClasses/Table/LabelStyleTraits.ts#L93) | `color` | `outlineColor = "#000000"` | Label outline default
- [`Table/TrailStyleTraits.ts:21,31`](../../lib/Traits/TraitsClasses/Table/TrailStyleTraits.ts#L21) | `color` | `color = "#ffffff"` (×2) | Trail color defaults
- [`TableTrailStyleTraits.ts:21,31`](../../lib/Traits/TraitsClasses/TableTrailStyleTraits.ts#L21) | `color` | `color = "#ffffff"` (×2) | Duplicate trail traits file — same defaults
- [`TableColorStyleTraits.ts:63`](../../lib/Traits/TraitsClasses/TableColorStyleTraits.ts#L63) | `color` | `regionColor = "#02528d"` | Duplicate of Table/ColorStyleTraits
- [`TableLabelStyleTraits.ts:68,75`](../../lib/Traits/TraitsClasses/TableLabelStyleTraits.ts#L68) | `color` | `fillColor = "#ffffff"`, `outlineColor = "#000000"` | Duplicate of Table/LabelStyleTraits
- [`BaseMapTraits.ts:23`](../../lib/Traits/TraitsClasses/BaseMapTraits.ts#L23) | `color` | `contrastColor = "#ffffff"` | Basemap contrast color default
- [`RerPoiCatalogItemTraits.ts:57`](../../lib/Traits/TraitsClasses/RerPoiCatalogItemTraits.ts#L57) | `color` | `labelTextColor = "#ffffff"` | POI label text color default
- [`RerPoiCatalogItemTraits.ts:78`](../../lib/Traits/TraitsClasses/RerPoiCatalogItemTraits.ts#L78) | `color` | `labelOutlineColor = "rgba(0, 0, 0, 0.65)"` | POI label outline color
- [`RerPoiCatalogItemTraits.ts:164`](../../lib/Traits/TraitsClasses/RerPoiCatalogItemTraits.ts#L164) | `color` | `iconStrokeColor = "#000000"` | POI icon stroke color default
- [`MapboxVectorTileCatalogItemTraits.ts:22`](../../lib/Traits/TraitsClasses/MapboxVectorTileCatalogItemTraits.ts#L22) | `color` | `lineColor: "hsl(180,80%,30%)"` | HSL default line color

### `dataVisualDefault` — Font / size defaults in traits

- [`Table/LabelStyleTraits.ts:46`](../../lib/Traits/TraitsClasses/Table/LabelStyleTraits.ts#L46) | `dataVisualDefault` | `font = "30px sans-serif"` | Hardcoded font-size default
- [`TableLabelStyleTraits.ts:45`](../../lib/Traits/TraitsClasses/TableLabelStyleTraits.ts#L45) | `dataVisualDefault` | `font = "30px sans-serif"` | Duplicate font default

### `spacing` — Inline HTML with px in trait description templates

- [`GtfsCatalogItemTraits.ts:54`](../../lib/Traits/TraitsClasses/GtfsCatalogItemTraits.ts#L54) | `spacing` | `padding-right: 5px`, `width: 10px` | Inline HTML template with hardcoded sizes

---

## ModelMixins

### `color` — Hardcoded highlight & POI colors

- [`Cesium3dTilesStyleMixin.ts:33`](../../lib/ModelMixins/Cesium3dTilesStyleMixin.ts#L33) | `color` | `DEFAULT_HIGHLIGHT_COLOR = "#ff3f00"` | Feature highlight color constant — UI concern in mixin
- [`Cesium3dTilesStyleMixin.ts:135`](../../lib/ModelMixins/Cesium3dTilesStyleMixin.ts#L135) | `color` | `rgba(` in computed style expression | Dynamic rgba construction for 3D tiles style
- [`RerPoiHelpers.ts:92`](../../lib/ModelMixins/RerPoiHelpers.ts#L92) | `color` | `"#ffffff"` | Pin icon color hardcoded in helper
- [`RerPoiHelpers.ts:233-238`](../../lib/ModelMixins/RerPoiHelpers.ts#L233) | `color` | `"#ff0"`, `"#333"`, `"#fff"`, `"#ff00ff"` | `DEFAULT_POI_DOMAIN_STYLES` with hardcoded domain colors

### `dataVisualDefault` — Color palette in mixin

- [`Cesium3dTilesMixin.ts:536`](../../lib/ModelMixins/Cesium3dTilesMixin.ts#L536) | `dataVisualDefault` | `color('#ffffff')` | Default 3D tiles fallback color

---

## Table

### `color` — Fallback colors in color map and legend

- [`TableColorMap.ts:25`](../../lib/Table/TableColorMap.ts#L25) | `dataVisualDefault` | `DEFAULT_COLOR = "yellow"` | Named CSS color as fallback
- [`ColorStyleLegend.ts:125,185,231`](../../lib/Table/ColorStyleLegend.ts#L125) | `color` | `"rgba(0, 0, 0, 0)"` (×3) | Null color fallback in legend — transparent black

---

## Models

### `color` — Basemap contrast, drawing, feature server, and styling defaults

- [`BaseMaps/defaultBaseMaps.ts:20-108`](../../lib/Models/BaseMaps/defaultBaseMaps.ts#L20) | `color` | `contrastColor: "#ffffff"` (×5), `"#000000"` (×3) | 8 hardcoded contrast colors across basemap definitions
- [`GlobeOrMap.ts:257`](../../lib/Models/GlobeOrMap.ts#L257) | `color` | `"#fffffe"` | Default highlight color (near-white, off by 1 to avoid Cesium special-casing)
- [`GlobeOrMap.ts:416`](../../lib/Models/GlobeOrMap.ts#L416) | `color` | `nullColor: "rgba(0,0,0,0)"` | Transparent fallback in highlight style
- [`Terria.ts:957`](../../lib/Models/Terria.ts#L957) | `color` | `?? "#ffffff"` | baseMapContrastColor ultimate fallback
- [`UserDrawing.ts:409,628`](../../lib/Models/UserDrawing.ts#L409) | `color` | `"#E8A200"` (×2) | Drawing point fill color — gold/amber
- [`UserDrawing.ts:233`](../../lib/Models/UserDrawing.ts#L233) | `color` | `stroke="rgb(0,170,215)"` | SVG marker stroke in inline template
- [`Catalog/Esri/ArcGisFeatureServerStratum.ts:416,480,486,558`](../../lib/Models/Catalog/Esri/ArcGisFeatureServerStratum.ts#L416) | `color` | `"#ffffff"`, `"#FFFFFF"` (×4) | Null/fallback color for ESRI feature symbology
- [`Catalog/Esri/esriStyleToTableStyle.ts:24`](../../lib/Models/Catalog/Esri/esriStyleToTableStyle.ts#L24) | `color` | `"#FFFFFF"` | Null color fallback
- [`Workflows/TableStylingWorkflow.ts:1030,1141,1251`](../../lib/Models/Workflows/TableStylingWorkflow.ts#L1030) | `color` | `"#aaa"` (×3) | Fallback preview colors in styling workflow
- [`Workflows/TableStylingWorkflow.ts:2483,2485`](../../lib/Models/Workflows/TableStylingWorkflow.ts#L2483) | `color` | `"#fff"`, `"#000"` | Black/white in color preview HTML
- [`Workflows/TableStylingWorkflow.ts:3321`](../../lib/Models/Workflows/TableStylingWorkflow.ts#L3321) | `spacing` | `width:20px; height:20px; margin-bottom: -4px` | Inline style in color preview HTML snippet
- [`BoxDrawing.ts:1203`](../../lib/Models/BoxDrawing.ts#L1203) | `color` | `highlightColor: Color.CYAN.withAlpha(0.7)` | Box highlight — Cesium named color + alpha

### `spacing` — Inline px in SVG and label fonts

- [`UserDrawing.ts:231,298,407,460,626,688`](../../lib/Models/UserDrawing.ts#L231) | `spacing` | `20px` (SVG), `18px sans-serif`, `bold 17px sans-serif` | Multiple hardcoded font sizes and SVG dimensions
- [`UserDrawingViewshed.ts:129,146`](../../lib/Models/UserDrawingViewshed.ts#L129) | `spacing` | `width="20px" height="20px"` (×2) | SVG marker dimensions
- [`SearchProviders/NominatimSearchProvider.ts:30`](../../lib/Models/SearchProviders/NominatimSearchProvider.ts#L30) | `spacing` / `color` | `"color: white; font-size: 24px; font-weight: bold"` | Inline CSS string with named color + px font
- [`Catalog/CatalogItems/SenapsLocationsCatalogItem.ts:182`](../../lib/Models/Catalog/CatalogItems/SenapsLocationsCatalogItem.ts#L182) | `spacing` | `margin-bottom:5px` | Inline HTML style

### `zIndex` — Leaflet layer ordering

- [`Leaflet.ts:439`](../../lib/Models/Leaflet.ts#L439) | `zIndex` | `zIndex = 100` | Arbitrary starting z-index for Leaflet layers

### `dataVisualDefault` — Data-vis font and color defaults

- [`Workflows/TableStylingWorkflow.ts:2478`](../../lib/Models/Workflows/TableStylingWorkflow.ts#L2478) | `spacing` | `height="${24}px"`, `margin-bottom: -4px` | Icon dimensions in workflow HTML
- [`BoxDrawing/cursors.ts:34`](../../lib/Models/BoxDrawing/cursors.ts#L34) | `spacing` | `height='64' width='64'`, `180px` | SVG cursor dimensions

---

## Map

### `spacing` — Selection indicator and font defaults

- [`Cesium/CesiumSelectionIndicator.ts:30`](../../lib/Map/Cesium/CesiumSelectionIndicator.ts#L30) | `spacing` | `"-1000px"` | Off-screen position constant
- [`Cesium/CesiumSelectionIndicator.ts:84-85`](../../lib/Map/Cesium/CesiumSelectionIndicator.ts#L84) | `spacing` | `"50px"` (×2) | Selection indicator image dimensions

### `zIndex` — Leaflet marker z-offset

- [`Leaflet/LeafletSelectionIndicator.ts:37`](../../lib/Map/Leaflet/LeafletSelectionIndicator.ts#L37) | `zIndex` | `zIndexOffset: 1` | Selection marker z-offset
- [`Leaflet/LeafletVisualizer.ts:425,456`](../../lib/Map/Leaflet/LeafletVisualizer.ts#L425) | `zIndex` | `zIndexOffset` computed from eyeOffset | Dynamic z-index offset

### `dataVisualDefault` — Protomaps font default

- [`Vector/Protomaps/mapboxStyleJsonToProtomaps.ts:193`](../../lib/Map/Vector/Protomaps/mapboxStyleJsonToProtomaps.ts#L193) | `dataVisualDefault` | `"12px sans-serif"` | Hardcoded fallback font

---

## ReactViews

### `color` — Hardcoded hex colors in UI components

#### Tools

- [`Tools/ClippingBox/RepositionClippingBox.tsx:197`](../../lib/ReactViews/Tools/ClippingBox/RepositionClippingBox.tsx#L197) | `color` | `background-color: #2563eb` | Button background in styled component
- [`Tools/ClippingBox/RepositionClippingBox.tsx:201`](../../lib/ReactViews/Tools/ClippingBox/RepositionClippingBox.tsx#L201) | `color` | `box-shadow: … #0000001a` | Shadow with hardcoded hex+alpha
- [`Tools/KeyboardMode/MovementControls.tsx:47`](../../lib/ReactViews/Tools/KeyboardMode/MovementControls.tsx#L47) | `color` | `backgroundColor = "#ffffff"` | White background constant
- [`Tools/KeyboardMode/MovementControls.tsx:60`](../../lib/ReactViews/Tools/KeyboardMode/MovementControls.tsx#L60) | `color` | `border-bottom: 1px solid #c0c0c0` | Separator border
- [`Tools/PedestrianMode/MouseTooltip.tsx:59`](../../lib/ReactViews/Tools/PedestrianMode/MouseTooltip.tsx#L59) | `color` | `background-color: #ffffff` | Tooltip background
- [`Tools/PedestrianMode/MovementControls.tsx:66,78`](../../lib/ReactViews/Tools/PedestrianMode/MovementControls.tsx#L66) | `color` | `"#ffffff"`, `#c0c0c0` | Background + border same as keyboard mode
- [`Tools/DiffTool/DiffTool.tsx:607`](../../lib/ReactViews/Tools/DiffTool/DiffTool.tsx#L607) | `color` | `fillColor="#ccc"` | Icon fill color

#### Panels

- [`Map/Panels/HelpPanel/VideoGuide.jsx:91`](../../lib/ReactViews/Map/Panels/HelpPanel/VideoGuide.jsx#L91) | `color` | `fill: #fff` | SVG fill in styled component
- [`Map/Panels/ColorPanel/ColorPanel.tsx:100,102`](../../lib/ReactViews/Map/Panels/ColorPanel/ColorPanel.tsx#L100) | `color` | `"#0000FF"` (×2) | Default gradient colors
- [`Map/Panels/CoordsPanel/CoordsPanel.tsx:101`](../../lib/ReactViews/Map/Panels/CoordsPanel/CoordsPanel.tsx#L101) | `color` | `background: #519ac2` | Panel background
- [`Map/Panels/SharePanel/Print/printCompassAssets.ts:9-15`](../../lib/ReactViews/Map/Panels/SharePanel/Print/printCompassAssets.ts#L9) | `color` | `#000`, `#222`, `#fff`, `#555` | SVG compass print colors

#### Map Navigation

- [`Map/MapNavigation/Items/MyLocation.ts:147-148`](../../lib/ReactViews/Map/MapNavigation/Items/MyLocation.ts#L147) | `color` | `"#08ABD5"`, `"#ffffff"` | Location marker colors
- [`Map/ProgressBar.tsx:38`](../../lib/ReactViews/Map/ProgressBar.tsx#L38) | `themeBypass` | `"#ffffff"` conditional, falls back to `theme.colorPrimary` | Partial theme bypass
- [`Map/BottomLeftBar/BottomLeftBar.tsx:18`](../../lib/ReactViews/Map/BottomLeftBar/BottomLeftBar.tsx#L18) | `color` | `text-shadow: 0 0 2px #000000` | Hardcoded shadow color

#### Workbench

- [`Workbench/Controls/ChartItemSelector.tsx:29`](../../lib/ReactViews/Workbench/Controls/ChartItemSelector.tsx#L29) | `color` | `"#fff"` | Fallback chart color
- [`Workbench/Controls/Legend.tsx:174`](../../lib/ReactViews/Workbench/Controls/Legend.tsx#L174) | `color` | `"#fff"` | getMakiIcon fallback color

#### Charts

- [`Custom/Chart/FeatureInfoPanelChart.tsx:77,196-197`](../../lib/ReactViews/Custom/Chart/FeatureInfoPanelChart.tsx#L77) | `color` | `"#efefef"`, `"#a0a0a0"` (×2) | Chart base color + axis colors
- [`Custom/Chart/BottomDockChart.tsx:21`](../../lib/ReactViews/Custom/Chart/BottomDockChart.tsx#L21) | `color` | `DEFAULT_GRID_COLOR = "#efefef"` | Chart grid color constant
- [`Custom/Chart/utils.tsx:13,121-124`](../../lib/ReactViews/Custom/Chart/utils.tsx#L13) | `color` | `LABEL_COLOR = "#efefef"`, axis `"#efefef"` (×3) | Chart label/axis color
- [`Custom/Chart/PointOnMap.tsx:31`](../../lib/ReactViews/Custom/Chart/PointOnMap.tsx#L31) | `color` | `stroke: "#ffffff"` | Chart point stroke
- [`Custom/Chart/MeasurableBottomDockChart.jsx:38-39,795-798`](../../lib/ReactViews/Custom/Chart/MeasurableBottomDockChart.jsx#L38) | `color` | `"#efefef"` (×5) | Grid + label + axis colors
- [`Custom/Chart/MeasurableGeometryChartPanel.tsx:156,169`](../../lib/ReactViews/Custom/Chart/MeasurableGeometryChartPanel.tsx#L156) | `color` | `"#0f0"`, `"#f00"` | Green/red chart line colors
- [`QueryWindow/QueryChart.tsx:65-201`](../../lib/ReactViews/QueryWindow/QueryChart.tsx#L65) | `color` | 137 hardcoded hex colors | Massive inline color palette for query chart series

#### Other UI

- [`SidePanel/FullScreenButton.jsx:114`](../../lib/ReactViews/SidePanel/FullScreenButton.jsx#L114) | `color` | `backgroundColor: "#111827"` | Dark background
- [`Analytics/ParameterEditor.jsx:73`](../../lib/ReactViews/Analytics/ParameterEditor.jsx#L73) | `color` | `"#ff0000"` | Error validation color
- [`Story/Story.tsx:270,300`](../../lib/ReactViews/Story/Story.tsx#L270) | `color` | `#baebf8` (×2) | Story border/text color
- [`DragDropNotification.tsx:69`](../../lib/ReactViews/DragDropNotification.tsx#L69) | `color` | `background: #ffffff` | Notification background
- [`Preview/WarningBox.tsx:16`](../../lib/ReactViews/Preview/WarningBox.tsx#L16) | `color` | `warningColor = "#f69900"` | Warning amber color constant
- [`Preview/DataPreviewMap.tsx:74`](../../lib/ReactViews/Preview/DataPreviewMap.tsx#L74) | `color` | `stroke: "#08ABD5"` | Preview map stroke
- [`SelectableDimensions/Color.tsx:35,48,60`](../../lib/ReactViews/SelectableDimensions/Color.tsx#L35) | `color` | `"#fff"`, `"#aaa"`, `"#000000"` | Color picker defaults
- [`SelectableDimensions/MarkerOptionRenderer.tsx:10`](../../lib/ReactViews/SelectableDimensions/MarkerOptionRenderer.tsx#L10) | `color` | `"#000"`, `"#fff"` | Marker icon colors
- [`BottomDock/ChartDisclaimer.tsx:43`](../../lib/ReactViews/BottomDock/ChartDisclaimer.tsx#L43) | `color` | `backgroundColor="#9a4b4b"` | Disclaimer background
- [`Notification/NotificationToast.tsx:39,61,68`](../../lib/ReactViews/Notification/NotificationToast.tsx#L39) | `color` | `"#EA580C"`, `#ea580c`, `#f2f2f2` | Toast fill + border + background

### `themeBypass` — rgba hardcoded in styled-components (should use theme tokens)

- [`Tour/TourExplanationBox.tsx:19-20`](../../lib/ReactViews/Tour/TourExplanationBox.tsx#L19) | `themeBypass` | `rgba(0,0,0,0.12)`, `rgba(0,0,0,0.05)` | Box shadow
- [`WelcomeMessage/WelcomeMessage.jsx:26`](../../lib/ReactViews/WelcomeMessage/WelcomeMessage.jsx#L26) | `themeBypass` | `rgba(0, 0, 0, 0.75)` | Overlay background
- [`Workbench/Controls/DateTimeSelectorSection.tsx:178,208,268,276`](../../lib/ReactViews/Workbench/Controls/DateTimeSelectorSection.tsx#L178) | `themeBypass` | `rgba(255, 255, 255, 0.15)` (×2), `rgba(250, 250, 250, 0.2)` (×2) | Borders and backgrounds
- [`Workbench/Controls/FilterFeaturesSection.tsx:209`](../../lib/ReactViews/Workbench/Controls/FilterFeaturesSection.tsx#L209) | `themeBypass` | `rgba(0, 0, 0, 0.3)` | Dropdown shadow
- [`Workbench/TerrainSide.tsx:118`](../../lib/ReactViews/Workbench/TerrainSide.tsx#L118) | `themeBypass` | `rgba(255, 255, 255, 0.5)` | Conditional opacity overlay
- [`Map/BottomBar/DistanceLegend.tsx:183`](../../lib/ReactViews/Map/BottomBar/DistanceLegend.tsx#L183) | `themeBypass` | `rgba(255, 255, 255, 0.75)` | Legend background
- [`Map/MapNavigation/CollapsedNavigation.tsx:36-37`](../../lib/ReactViews/Map/MapNavigation/CollapsedNavigation.tsx#L36) | `themeBypass` | `rgba(0,0,0,0.12)`, `rgba(0,0,0,0.05)` | Box shadow
- [`Map/MapNavigation/Items/Compass/Compass.tsx:62`](../../lib/ReactViews/Map/MapNavigation/Items/Compass/Compass.tsx#L62) | `themeBypass` | `rgba(0, 0, 0, 0.35)` | Drop shadow filter
- [`Map/Panels/HelpPanel/HelpVideoPanel.jsx:81`](../../lib/ReactViews/Map/Panels/HelpPanel/HelpVideoPanel.jsx#L81) | `themeBypass` | `rgba(0,0,0,0.35)` (×2) | Linear gradient overlay
- [`Map/Panels/HelpPanel/VideoGuide.jsx:35`](../../lib/ReactViews/Map/Panels/HelpPanel/VideoGuide.jsx#L35) | `themeBypass` | `rgba(0, 0, 0, 0.75)` | Video overlay background
- [`Map/Panels/SettingPanel.tsx:637,645`](../../lib/ReactViews/Map/Panels/SettingPanel.tsx#L637) | `themeBypass` | `rgba(255, 255, 255, 0.5)` (×2) | Setting panel active state colors
- [`Story/Story.tsx:288`](../../lib/ReactViews/Story/Story.tsx#L288) | `themeBypass` | `rgba(255, 255, 255, 0.15)` | Story border
- [`Story/StoryPanel/StoryPanel.tsx:270`](../../lib/ReactViews/Story/StoryPanel/StoryPanel.tsx#L270) | `themeBypass` | `rgba(255, 255, 255, 0.85)` | Story panel background
- [`MessageModal/MessageModal.tsx:49-50`](../../lib/ReactViews/MessageModal/MessageModal.tsx#L49) | `themeBypass` | `rgba(0,0,0,0.12)`, `rgba(0,0,0,0.05)` | Box shadow
- [`Disclaimer.jsx:27`](../../lib/ReactViews/Disclaimer.jsx#L27) | `themeBypass` | `rgba(0, 0, 0, 0.75)` | Disclaimer overlay
- [`Notification/terriaErrorNotification.tsx:25`](../../lib/ReactViews/Notification/terriaErrorNotification.tsx#L25) | `themeBypass` | `rgba(255,255,255,.1)` | Error notification border
- [`MeasurableGeometry/PlayPathPanel.tsx:186`](../../lib/ReactViews/MeasurableGeometry/PlayPathPanel.tsx#L186) | `themeBypass` | `rgba(0,0,0,0.2)` | Panel shadow
- [`MeasurableGeometry/MeasurableDownloadPanel.tsx:107`](../../lib/ReactViews/MeasurableGeometry/MeasurableDownloadPanel.tsx#L107) | `themeBypass` | `rgba(0,0,0,0.3)` | Download panel shadow
- [`MeasurableGeometry/MeasurablePanel.tsx:427`](../../lib/ReactViews/MeasurableGeometry/MeasurablePanel.tsx#L427) | `themeBypass` | `rgba(0,0,0,0.2)` | Panel shadow
- [`Custom/Chart/Tooltip.tsx:67`](../../lib/ReactViews/Custom/Chart/Tooltip.tsx#L67) | `themeBypass` | `rgba(33,33,33,0.2)` | Tooltip box shadow
- [`SelectableDimensions/Color.tsx:37`](../../lib/ReactViews/SelectableDimensions/Color.tsx#L37) | `themeBypass` | `rgba(0,0,0,.1)` | Color swatch outline

### `zIndex` — Hardcoded z-index stacking values (no central scale)

- [`StandardUserInterface/ExperimentalFeatures.tsx:15`](../../lib/ReactViews/StandardUserInterface/ExperimentalFeatures.tsx#L15) | `zIndex` | `z-index: 1`
- [`StandardUserInterface/SidePanelContainer.tsx:37`](../../lib/ReactViews/StandardUserInterface/SidePanelContainer.tsx#L37) | `zIndex` | `z-index: 3`
- [`Tour/TourPrefaceBox.tsx:9`](../../lib/ReactViews/Tour/TourPrefaceBox.tsx#L9) | `zIndex` | `z-index: 1000`
- [`WelcomeMessage/WelcomeMessage.jsx:25`](../../lib/ReactViews/WelcomeMessage/WelcomeMessage.jsx#L25) | `zIndex` | `z-index: 99999`
- [`Workbench/Controls/ViewingControls.tsx:837`](../../lib/ReactViews/Workbench/Controls/ViewingControls.tsx#L837) | `zIndex` | `z-index: 100`
- [`Workbench/Controls/FilterFeaturesSection.tsx:203`](../../lib/ReactViews/Workbench/Controls/FilterFeaturesSection.tsx#L203) | `zIndex` | `z-index: 99`
- [`MeasurableGeometry/PlayPathPanel.tsx:187`](../../lib/ReactViews/MeasurableGeometry/PlayPathPanel.tsx#L187) | `zIndex` | `zIndex: 1000`
- [`MeasurableGeometry/MeasurablePanel.tsx:428`](../../lib/ReactViews/MeasurableGeometry/MeasurablePanel.tsx#L428) | `zIndex` | `zIndex: 1000`
- [`Map/MapColumn.tsx:56,77`](../../lib/ReactViews/Map/MapColumn.tsx#L56) | `zIndex` | `zIndex: 1`, `zIndex: 0`
- [`Map/BottomBar/Credits/DataAttribution/DataAttributionModal.tsx:43,72`](../../lib/ReactViews/Map/BottomBar/Credits/DataAttribution/DataAttributionModal.tsx#L43) | `zIndex` | `z-index: 99989` (×2)
- [`Map/MapNavigation/CollapsedNavigation.tsx:31`](../../lib/ReactViews/Map/MapNavigation/CollapsedNavigation.tsx#L31) | `zIndex` | `z-index: 1000`
- [`Map/MapNavigation/Items/Compass/Compass.tsx:139`](../../lib/ReactViews/Map/MapNavigation/Items/Compass/Compass.tsx#L139) | `zIndex` | `z-index: 3`
- [`Map/MapNavigation/MapNavigation.tsx:47`](../../lib/ReactViews/Map/MapNavigation/MapNavigation.tsx#L47) | `zIndex` | `z-index: 1`
- [`Map/TerriaViewerWrapper/Splitter/Splitter.tsx:65,79`](../../lib/ReactViews/Map/TerriaViewerWrapper/Splitter/Splitter.tsx#L65) | `zIndex` | `zIndex: 999` (×2)
- [`Map/Panels/HelpPanel/VideoGuide.jsx:30`](../../lib/ReactViews/Map/Panels/HelpPanel/VideoGuide.jsx#L30) | `zIndex` | `z-index: 99999`
- [`Map/Toast.tsx:20`](../../lib/ReactViews/Map/Toast.tsx#L20) | `zIndex` | `z-index: 99999`
- [`MapIconButton/MapIconButton.tsx:240`](../../lib/ReactViews/MapIconButton/MapIconButton.tsx#L240) | `zIndex` | `z-index:10`
- [`Workflow/WorkflowPanelPortal.tsx:36`](../../lib/ReactViews/Workflow/WorkflowPanelPortal.tsx#L36) | `zIndex` | `z-index: 100`
- [`Workflow/PanelMenu.tsx:62`](../../lib/ReactViews/Workflow/PanelMenu.tsx#L62) | `zIndex` | `z-index: 1`
- [`Tools/DiffTool/DatePicker.tsx:190-191`](../../lib/ReactViews/Tools/DiffTool/DatePicker.tsx#L190) | `zIndex` | `z-index: 0` / `z-index: 1000` (conditional)
- [`Story/Story.tsx:184`](../../lib/ReactViews/Story/Story.tsx#L184) | `zIndex` | `z-index: 1000`
- [`Disclaimer.jsx:19,32`](../../lib/ReactViews/Disclaimer.jsx#L19) | `zIndex` | `z-index: 99999`, `z-index: 0`
- [`DragDropNotification.tsx:73`](../../lib/ReactViews/DragDropNotification.tsx#L73) | `zIndex` | `z-index: 9`
- [`DragDropFile.tsx:36`](../../lib/ReactViews/DragDropFile.tsx#L36) | `zIndex` | `z-index: 99999`
- [`SelectableDimensions/Color.tsx:95`](../../lib/ReactViews/SelectableDimensions/Color.tsx#L95) | `zIndex` | `zIndex: 2`
- [`Generic/PrefaceBox.tsx:14`](../../lib/ReactViews/Generic/PrefaceBox.tsx#L14) | `zIndex` | `z-index: 1000`
- [`BottomDock/Timeline/DateTimePicker.tsx:317`](../../lib/ReactViews/BottomDock/Timeline/DateTimePicker.tsx#L317) | `zIndex` | `z-index: 100`
- [`BottomDock/Timeline/DatePicker/DateTimePickerStyles.ts:73`](../../lib/ReactViews/BottomDock/Timeline/DatePicker/DateTimePickerStyles.ts#L73) | `zIndex` | `z-index: 99`
- [`StandardUserInterface/TrainerBar/TrainerBar.tsx:253`](../../lib/ReactViews/StandardUserInterface/TrainerBar/TrainerBar.tsx#L253) | `zIndex` | `z-index:2`

### `spacing` — Representative hardcoded px values (high volume — showing notable patterns)

> **Note:** There are 30+ files in ReactViews with hardcoded `px` values in styled-components. Below are representative samples by area. The full set is captured in the grep patterns above.

- [`SidePanel/SidePanel.tsx`](../../lib/ReactViews/SidePanel/SidePanel.tsx) | `spacing` | `20px`, `2px`, `16px`, `28px`, `8px`, `18px` | Multiple layout values
- [`Workbench/WorkbenchItem.tsx`](../../lib/ReactViews/Workbench/WorkbenchItem.tsx) | `spacing` | `4px`, `6px`, `36px`, `20px`, `24px`, `72px`, `14px`, `8px` | Item layout dimensions
- [`Workbench/WorkbenchButton.tsx`](../../lib/ReactViews/Workbench/WorkbenchButton.tsx) | `spacing` | `3px`, `32px`, `16px` | Button dimensions
- [`Workbench/Controls/ViewingControls.tsx`](../../lib/ReactViews/Workbench/Controls/ViewingControls.tsx) | `spacing` | `35px`, `18px`, `124px`, `180px`, `32px`, `42px` | Control layout
- [`Workbench/Controls/FilterFeaturesSection.tsx`](../../lib/ReactViews/Workbench/Controls/FilterFeaturesSection.tsx) | `spacing` | `2px`, `34px`, `5px`, `10px`, `250px`, `14px`, `8px` | Filter dropdown layout
- [`Workbench/PositionRightOfWorkbench.tsx:40`](../../lib/ReactViews/Workbench/PositionRightOfWorkbench.tsx#L40) | `spacing` | `top: 110px` | Fixed position offset
- [`Tools/KeyboardMode/MovementControls.tsx`](../../lib/ReactViews/Tools/KeyboardMode/MovementControls.tsx) | `spacing` | box-shadow with hardcoded px | Movement control panel
- [`Tools/PedestrianMode/MiniMap.tsx:80`](../../lib/ReactViews/Tools/PedestrianMode/MiniMap.tsx#L80) | `spacing` | box-shadow with hardcoded px | Mini map shadow
- [`QueryWindow/QueryTabAggregation.tsx`](../../lib/ReactViews/QueryWindow/QueryTabAggregation.tsx) | `spacing` | `100px`, `2px`, `5px` | Aggregation tab layout
- [`QueryWindow/QueryTabTable.tsx`](../../lib/ReactViews/QueryWindow/QueryTabTable.tsx) | `spacing` | `100px`, `2px`, `10px` | Table tab layout

### `layout` — Breakpoint magic number

- [`StandardUserInterface/StandardUserInterface.tsx:92`](../../lib/ReactViews/StandardUserInterface/StandardUserInterface.tsx#L92) | `layout` | `1100px` small-screen breakpoint (comment) | Fork-specific breakpoint

---

## Styled

### `color` — Hardcoded colors in shared styled components

- [`Checkbox/Checkbox.tsx:92`](../../lib/Styled/Checkbox/Checkbox.tsx#L92) | `color` | `outline: 3px solid #c390f9` | Focus ring color
- [`Input.tsx:81`](../../lib/Styled/Input.tsx#L81) | `color` | `background: #FFFFFF` | Input background
- [`Input.tsx:94-95`](../../lib/Styled/Input.tsx#L94) | `color` | `border-color: #d60000`, `background-color: #fdf2f2` | Error state colors
- [`Button.tsx:52`](../../lib/Styled/Button.tsx#L52) | `color` | `border: 1px solid #e4e5e7` | Button border
- [`Button.tsx:79`](../../lib/Styled/Button.tsx#L79) | `color` | `color: #fff` | Button text color
- [`List.tsx:38`](../../lib/Styled/List.tsx#L38) | `color` | `border-top: 1px solid grey` | Named CSS color "grey"

### `themeBypass` — Shadow/overlay rgba not using theme tokens

- [`Box.tsx:144`](../../lib/Styled/Box.tsx#L144) | `themeBypass` | `rgba(0,0,0,0.16)` | Box shadow
- [`Box.tsx:191-192`](../../lib/Styled/Box.tsx#L191) | `themeBypass` | `rgba(0, 0, 0, ${props.backgroundBlackOverlay})` | Dynamic overlay (parameterized but uses raw rgba)

### `spacing` — Hardcoded px in shared components (should be design tokens)

- [`Box.tsx:83-84`](../../lib/Styled/Box.tsx#L83) | `spacing` | `0px` (×2) | Position values
- [`Box.tsx:157`](../../lib/Styled/Box.tsx#L157) | `spacing` | `padding: 5px` | Padded prop
- [`Box.tsx:231-232`](../../lib/Styled/Box.tsx#L231) | `spacing` | `5px`, `8px` | Scrollbar dimensions
- [`Checkbox/Elements/CheckboxIcon.tsx:23`](../../lib/Styled/Checkbox/Elements/CheckboxIcon.tsx#L23) | `spacing` | `width: 28px` | Checkbox icon size
- [`Checkbox/Checkbox.tsx:88`](../../lib/Styled/Checkbox/Checkbox.tsx#L88) | `spacing` | `gap: 5px` | Switch gap
- [`ButtonAsLabel.tsx:11,13`](../../lib/Styled/ButtonAsLabel.tsx#L11) | `spacing` | `32px`, `16px` | Button height + border-radius
- [`IconWrapper.tsx:16,19`](../../lib/Styled/IconWrapper.tsx#L16) | `spacing` | `8px`, `16px` | Icon margins
- [`Text.tsx:141-197`](../../lib/Styled/Text.tsx#L141) | `spacing` | `20px`, `13px`, `10px`, `12px`, `16px`, `14px`, `15px`, `16px`, `18px`, `23px`, `31px`, `26px`, `32px` | Type scale — many hardcoded font-size/line-height values
- [`Select.tsx:37,42-43,64`](../../lib/Styled/Select.tsx#L37) | `spacing` | `34px`, `10px`, `30px`, `10px` | Select dimensions
- [`Button.tsx:47-53,82-87,94-95`](../../lib/Styled/Button.tsx#L47) | `spacing` | `40px`, `34px`, `16px`, `4px`, `32px` | Button min-height, padding, border-radius
- [`Input.tsx:43,48-50,89,102-104,111-112`](../../lib/Styled/Input.tsx#L43) | `spacing` | `1px`, `0px`, `10px`, `30px`, `5px`, `10px` | Input padding, border, scrollbar
- [`List.tsx:28,35`](../../lib/Styled/List.tsx#L28) | `spacing` | `5px` (×2) | List padding
- [`Spacing.tsx:15`](../../lib/Styled/Spacing.tsx#L15) | `spacing` | Comment notes difficulty with `1px` | Spacing utility awareness

### `zIndex`

- [`Box.tsx:77`](../../lib/Styled/Box.tsx#L77) | `zIndex` | `z-index:1` | Absolute-positioned Box default

### `layout`

- [`mixins.ts:14-15`](../../lib/Styled/mixins.ts#L14) | `layout` | `5px`, `8px` | Scrollbar mixin dimensions
- [`mixins.ts:97,106`](../../lib/Styled/mixins.ts#L97) | `spacing` | `2px solid`, `1px solid` | Border widths (use theme tokens for colors)

---

## App (terriamap)

### `color` — Loader background

- [`apps/terriamap/lib/Views/Loader.tsx:10`](../../../../apps/terriamap/lib/Views/Loader.tsx#L10) | `color` | `backgroundColor: "#11151c"` | App loader dark background — hardcoded hex

---

## Observations

### Z-index chaos

The z-index values form no coherent stacking system. Values spotted: `0`, `1`, `2`, `3`, `9`, `10`, `99`, `100`, `999`, `1000`, `99989`, `99999`. At least 5 components use `99999`, competing for "top of stack". A centralized z-index scale is needed.

### Duplicate Trait files

Several Traits appear in both `Table/` subdirectory and top-level `TraitsClasses/` with identical hardcoded defaults:

- `ColorStyleTraits` / `TableColorStyleTraits`
- `LabelStyleTraits` / `TableLabelStyleTraits`
- `TrailStyleTraits` / `TableTrailStyleTraits`

### Chart color patterns

Charts consistently use `#efefef` for grids, labels, and axes across 4+ files. This should be a single chart theme token.

### QueryChart palette

`QueryChart.tsx` contains 137 hardcoded hex color strings as an inline array. This is the single largest color-leakage site.

### Shadow/overlay pattern

A recurring `rgba(0,0,0,0.05/0.12/0.16/0.2/0.3)` pattern appears in 10+ locations for box-shadows and overlays. These are prime candidates for a shadow/overlay token scale.
