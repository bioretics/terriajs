# Magic Number Remediation — Implementation Plan

Remediate all ~198+ findings from `findings.md` by introducing canonical token homes and wiring every consumer to import from those homes.

## User Review Required

> [!IMPORTANT]
> This plan touches **~60+ source files** across Traits, ModelMixins, Table, Models, Map, ReactViews, Styled, and apps/terriamap. Every change preserves the same runtime visual value — only the _source_ of the value moves from inline literal to a named import. No visual behavior changes unless explicitly noted.

> [!WARNING]
> **Phase 0 creates 1 new file** (`DefaultVisualStyles.ts`) and modifies 3 existing files (`_default_variables.scss`, `_variables-export.scss`, `StandardCssColors.ts`). All subsequent phases depend on Phase 0. If the build breaks on Phase 0, everything else blocks.

## Proposed Changes

### Phase 0 — Expand Token Homes

#### [NEW] [`lib/Core/DefaultVisualStyles.ts`](file:///home/vasi/Documents/VS/8_13_0/terriajs/packages/terriajs/lib/Core/DefaultVisualStyles.ts)

New TypeScript constants file for data-visual / map / drawing defaults. Contains named constants for every hardcoded value found in Traits/Models/Map/Table/Mixins:

- Region, label, trail, basemap contrast, POI colors
- Highlight colors (`DEFAULT_HIGHLIGHT_COLOR`, `GLOBE_HIGHLIGHT_COLOR`)
- UserDrawing colors, Esri null, workflow preview, MyLocation
- Font strings for labels/protomaps
- Leaflet layer z-index base
- Transparent null color

#### [MODIFY] [`lib/Core/StandardCssColors.ts`](file:///home/vasi/Documents/VS/8_13_0/terriajs/packages/terriajs/lib/Core/StandardCssColors.ts)

Add `queryChartSeries` export: move QueryChart.tsx's 137-color inline palette here.

#### [MODIFY] [`lib/Sass/common/_default_variables.scss`](file:///home/vasi/Documents/VS/8_13_0/terriajs/packages/terriajs/lib/Sass/common/_default_variables.scss)

Add z-index scale variables mapping existing ad-hoc values:

- `$z-base: 1`, `$z-chrome: 3`, `$z-dropdown: 10`, `$z-panel-float: 100`, `$z-splitter: 999`, `$z-modal: 1000`, `$z-toast: 99989`, `$z-overlay-top: 99999`
- Map existing `$front-component-z-index` and `$notification-window-z-index` into scale
- Add `$chart-base-color: #efefef` for the recurring chart grid/label/axis color (distinct from existing `$chart-grid-color` which is `rgba(#fff, 0.085)` for the bottom dock)
- Add `$warning-accent: #f69900` for the WarningBox amber
- Add `$focus-ring: #c390f9` for Checkbox focus outline

#### [MODIFY] [`lib/Sass/exports/_variables-export.scss`](file:///home/vasi/Documents/VS/8_13_0/terriajs/packages/terriajs/lib/Sass/exports/_variables-export.scss)

Export new z-index scale + chart/warning/focus tokens to JS:

- `zBase`, `zChrome`, `zDropdown`, `zPanelFloat`, `zSplitter`, `zModal`, `zToast`, `zOverlayTop`
- `chartBaseColor`, `warningAccent`, `focusRing`

---

### Phase 1 — Traits / ModelMixins / Table / Models / Map (30+ files)

Replace inline hex/rgba/px literals with imports from `DefaultVisualStyles`:

#### [MODIFY] Traits (8 files)

- `Table/ColorStyleTraits.ts` + `TableColorStyleTraits.ts` — import `REGION_COLOR`
- `Table/LabelStyleTraits.ts` + `TableLabelStyleTraits.ts` — import `LABEL_FILL_COLOR`, `LABEL_OUTLINE_COLOR`, `LABEL_FONT`
- `Table/TrailStyleTraits.ts` + `TableTrailStyleTraits.ts` — import `TRAIL_COLOR`
- `BaseMapTraits.ts` — import `BASEMAP_CONTRAST_WHITE`
- `RerPoiCatalogItemTraits.ts` — import `POI_LABEL_TEXT_COLOR`, `POI_LABEL_OUTLINE_COLOR`, `POI_ICON_STROKE_COLOR`
- `MapboxVectorTileCatalogItemTraits.ts` — import `MAPBOX_DEFAULT_LINE_COLOR`

#### [MODIFY] ModelMixins (3 files)

- `Cesium3dTilesStyleMixin.ts` — import `HIGHLIGHT_COLOR`
- `Cesium3dTilesMixin.ts` — import `TILES_FALLBACK_COLOR`
- `RerPoiHelpers.ts` — import `POI_ICON_COLOR` + domain colors from `DefaultVisualStyles`

#### [MODIFY] Table (2 files)

- `TableColorMap.ts` — import `TABLE_DEFAULT_COLOR`
- `ColorStyleLegend.ts` — import `NULL_TRANSPARENT`

#### [MODIFY] Models (12+ files)

- `defaultBaseMaps.ts` — import `BASEMAP_CONTRAST_WHITE`, `BASEMAP_CONTRAST_BLACK`
- `GlobeOrMap.ts` — import `GLOBE_HIGHLIGHT_COLOR`, `NULL_TRANSPARENT`
- `Terria.ts` — import `BASEMAP_CONTRAST_WHITE`
- `UserDrawing.ts` — import `DRAWING_FILL_COLOR`, `DRAWING_FONT_*`, `DRAWING_MARKER_STROKE`
- `UserDrawingViewshed.ts` — import `DRAWING_MARKER_SIZE`
- `Leaflet.ts` — import `LEAFLET_BASE_Z_INDEX`
- `ArcGisFeatureServerStratum.ts` — import `ESRI_NULL_COLOR`
- `esriStyleToTableStyle.ts` — import `ESRI_NULL_COLOR`
- `TableStylingWorkflow.ts` — import `WORKFLOW_FALLBACK_COLOR`, `WORKFLOW_PREVIEW_SIZE`
- `NominatimSearchProvider.ts` — import marker style constants
- `SenapsLocationsCatalogItem.ts` — import margin constant
- `BoxDrawing.ts` — import highlight color

#### [MODIFY] Map (2 files)

- `mapboxStyleJsonToProtomaps.ts` — import `PROTOMAPS_FALLBACK_FONT`
- `CesiumSelectionIndicator.ts` — import indicator size constant

---

### Phase 2 — Styled Primitives (7 files)

Replace inline hex/px with `theme.*` tokens:

- `Checkbox.tsx` — `#c390f9` → `theme.focusRing`
- `Input.tsx` — `#FFFFFF` → `theme.textLight`, `#d60000`/`#fdf2f2` → `theme.textWarning`/warning bg token
- `Button.tsx` — `#e4e5e7` → `theme.greyLighter`, `#fff` → `theme.textLight`, px → theme padding
- `List.tsx` — `grey` → `theme.grey`
- `Box.tsx` — `rgba` shadow → `theme.shadowMd`, px → theme padding
- `Text.tsx` — font-size px → exported font-size scale tokens
- `Select.tsx` — px values → theme tokens

---

### Phase 3 — ReactViews (40+ files)

Work through by subsection:

**Tools** — ClippingBox, KeyboardMode, PedestrianMode, DiffTool MovementControls: create co-located `*.styles.ts` or use theme tokens directly.

**Panels** — VideoGuide, ColorPanel, CoordsPanel, SharePanel/Print, HelpPanel: move hex into co-located SCSS or theme.

**Charts** — `#efefef` cluster (FeatureInfoPanelChart, BottomDockChart, utils, MeasurableBottomDockChart, MeasurableGeometryChartPanel): replace with `theme.chartBaseColor`.

**QueryChart** — Replace 137-color inline array with `StandardCssColors.queryChartSeries`.

**Workbench / Map Navigation / Story / Notification / Tour** — Replace inline hex/rgba/z-index with theme tokens.

**terriamap** — `Loader.tsx` `"#11151c"` → `theme.dark` or import from Sass.

---

### Phase 4 — Style Module Extraction

For any ReactViews file with >3 styled-blocks still containing tokens but no dedicated style file, extract to co-located `*.styles.ts`.

---

### Phase 5 — Rescan & Close

Re-run grep patterns from the audit. Remove cleared entries from `findings.md`. Iterate until empty.

## Open Questions

> [!IMPORTANT]
> **Chart color divergence:** The existing Sass `$chart-grid-color` is `rgba(#fff, 0.085)` (semi-transparent white on dark), but the ReactViews chart components use `#efefef` (opaque light grey, intended for FeatureInfoPanel charts which sit on a dark background). Should these converge to a single token, or remain separate? The plan currently keeps them as separate tokens (`$chart-grid-color` vs `$chart-base-color`) to avoid visual changes.

> [!IMPORTANT]
> **`_rer3d_variables.scss` overrides:** The plan mentions mirroring new Sass variables in `_rer3d_variables.scss`. Does this file exist and need updates, or is the fork's variable override handled via the webpack alias mechanism?

## Verification Plan

### Automated Tests

- `yarn build` — ensure TypeScript compilation succeeds with new imports
- `yarn test` — existing tests pass (no visual behavior changes expected)

### Manual Verification

- Visual spot-check: load the app and verify basemap contrast, highlight colors, chart grid lines, movement controls, z-index stacking all look identical to before
- Grep re-scan: run the same audit grep patterns and verify zero non-token-home hits
