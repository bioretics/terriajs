/**
 * Canonical home for data-visual / map / drawing default values.
 *
 * Every hardcoded hex, rgba, px-font, or named CSS color that was embedded
 * inline in Traits, ModelMixins, Table, Models, or Map layers is collected
 * here as a named constant. Consumers import these constants instead of
 * duplicating magic literals.
 *
 * UI-chrome tokens (chart chrome, workflow preview sizes, compass print
 * fills, breakpoints, spacing, shadows, overlay z-index) live in the Sass
 * layer — see `_default_variables.scss` → `_variables-export.scss` → theme.
 * This module covers non-chrome visual defaults only.
 */

// ---------------------------------------------------------------------------
// Colors — basemap & globe
// ---------------------------------------------------------------------------

/** Default contrast color for basemaps with dark backgrounds. */
export const BASEMAP_CONTRAST_WHITE = "#ffffff";

/** Default contrast color for basemaps with light backgrounds. */
export const BASEMAP_CONTRAST_BLACK = "#000000";

/**
 * Default highlight color for the globe/map when no item-level highlight is
 * defined. Uses near-white (#fffffe) instead of pure white to avoid Cesium
 * special-casing Color.WHITE in some code paths.
 */
export const GLOBE_HIGHLIGHT_COLOR = "#fffffe";

// ---------------------------------------------------------------------------
// Colors — 3D Tiles
// ---------------------------------------------------------------------------

/** Default highlight color for Cesium 3D Tiles features. */
export const HIGHLIGHT_COLOR = "#ff3f00";

/** Fallback color for 3D tiles that have no style assigned. */
export const TILES_FALLBACK_COLOR = "#ffffff";

// ---------------------------------------------------------------------------
// Colors — table / data-vis
// ---------------------------------------------------------------------------

/** Default region fill color for choropleth maps. */
export const REGION_COLOR = "#02528d";

/** Default label fill (text) color. */
export const LABEL_FILL_COLOR = "#ffffff";

/** Default label outline color. */
export const LABEL_OUTLINE_COLOR = "#000000";

/** Default trail color. */
export const TRAIL_COLOR = "#ffffff";

/** Fallback color when no data color is specified for a table series. */
export const TABLE_DEFAULT_COLOR = "yellow";

/** Transparent null: used when a legend/style has no assigned color. */
export const NULL_TRANSPARENT = "rgba(0, 0, 0, 0)";

/** Default gradient color for globe elevation color ramp panel. */
export const ELEVATION_GRADIENT_DEFAULT_COLOR = "#0000FF";

/** Elevation chart ground profile line color. */
export const ELEVATION_GROUND_COLOR = "#0f0";

/** Elevation chart air profile line color. */
export const ELEVATION_AIR_COLOR = "#f00";

// ---------------------------------------------------------------------------
// Colors — ESRI / ArcGIS
// ---------------------------------------------------------------------------

/** Null / fallback color for ESRI feature server symbology. */
export const ESRI_NULL_COLOR = "#FFFFFF";

// ---------------------------------------------------------------------------
// Colors — POI (RER)
// ---------------------------------------------------------------------------

/** Default POI icon (maki) color rendered inside the pin. */
export const POI_ICON_COLOR = "#ffffff";

/** Default fallback icon color for Maki icons (e.g. in Legend). */
export const MAKI_ICON_DEFAULT_COLOR = "#ffffff";

/** Default POI label text color. */
export const POI_LABEL_TEXT_COLOR = "#ffffff";

/** Default POI label outline color (semi-transparent black). */
export const POI_LABEL_OUTLINE_COLOR = "rgba(0, 0, 0, 0.65)";

/** Default POI icon stroke color. */
export const POI_ICON_STROKE_COLOR = "#000000";

/** Default POI domain styles — mapping domain IDs to symbol + color overrides. */
export const POI_DOMAIN_STYLES = [
  { symbol: "village", domainIds: [1, 2] },
  { symbol: "industrial", domainIds: [3] },
  { symbol: "village", color: "#ff0", domainIds: [4] },
  { symbol: "village", color: "#333", domainIds: [5] },
  { symbol: "village", color: "#fff", domainIds: [6] },
  { symbol: "square", domainIds: [7] },
  { symbol: "cross", domainIds: [8] },
  { symbol: "mountain", color: "#ff00ff", domainIds: [9] },
  { symbol: "triangle", domainIds: [10] },
  { symbol: "triangle-stroked", domainIds: [11] },
  { symbol: "marker", domainIds: [12, 15, 19, 20, 21, 22, 24] },
  { symbol: "water", domainIds: [13, 14, 16, 17, 18, 23] },
  { symbol: "town", domainIds: [601] },
  { symbol: "city", domainIds: [602, 603] }
] as const;

// ---------------------------------------------------------------------------
// Colors — Mapbox Vector Tiles
// ---------------------------------------------------------------------------

/** Default line color for MapboxVectorTile catalog items. */
export const MAPBOX_DEFAULT_LINE_COLOR = "hsl(180,80%,30%)";

// ---------------------------------------------------------------------------
// Colors — user drawing
// ---------------------------------------------------------------------------

/** Fill color for user-drawn points and labels (gold/amber). */
export const DRAWING_FILL_COLOR = "#E8A200";

/** SVG marker stroke color for user drawings. */
export const DRAWING_MARKER_STROKE = "rgb(0,170,215)";

// ---------------------------------------------------------------------------
// Colors — location & preview
// ---------------------------------------------------------------------------

/** Marker color for MyLocation and DataPreviewMap. */
export const LOCATION_MARKER_COLOR = "#08ABD5";

/** Marker stroke for MyLocation and DataPreviewMap. */
export const LOCATION_MARKER_STROKE = "#ffffff";

/** Default location marker size for MyLocation. */
export const LOCATION_MARKER_SIZE = "25";

/** Default location marker stroke width for MyLocation. */
export const LOCATION_MARKER_STROKE_WIDTH = 3;

// ---------------------------------------------------------------------------
// Colors — BoxDrawing
// ---------------------------------------------------------------------------

/** Highlight color for 3D box drawing handles (Cesium Color.CYAN equivalent). */
export const BOX_HIGHLIGHT_CYAN_ALPHA = 0.7;

/** Custom cursor SVG width/height dimension. */
export const BOX_CURSOR_SIZE = 64;

/** Custom cursor filter dimensions. */
export const BOX_CURSOR_FILTER_SIZE = "180%";

// ---------------------------------------------------------------------------
// Fonts — data-visual defaults
// ---------------------------------------------------------------------------

/** Default font for table labels (Cesium LabelGraphics). */
export const LABEL_FONT = "30px sans-serif";

/** Default font for protomaps / mapbox style text fallback. */
export const PROTOMAPS_FALLBACK_FONT = "12px sans-serif";

/** Font for user drawing distance labels. */
export const DRAWING_FONT = "18px sans-serif";

/** Font for user drawing distance labels (bold variant). */
export const DRAWING_FONT_BOLD = "bold 17px sans-serif";

// ---------------------------------------------------------------------------
// Layout — map layers
// ---------------------------------------------------------------------------

/** Starting z-index for Leaflet overlay layers. */
export const LEAFLET_BASE_Z_INDEX = 100;

// ---------------------------------------------------------------------------
// Layout — SVG markers
// ---------------------------------------------------------------------------

/** Standard SVG marker width/height in px strings. */
export const MARKER_SVG_SIZE = "20px";

// ---------------------------------------------------------------------------
// Spacing — template & feature info defaults
// ---------------------------------------------------------------------------

/** Default element margin/padding in catalog item featureInfo templates. */
export const TEMPLATE_ELEMENT_SPACING = "5px";

/** Default inline template indicator icon width. */
export const TEMPLATE_ICON_WIDTH = "10px";

// ---------------------------------------------------------------------------
// Colors — search providers
// ---------------------------------------------------------------------------

/** Inline style for Nominatim search result markers. */
export const NOMINATIM_MARKER_STYLE =
  "color: white; font-size: 24px; font-weight: bold; font-family: Helvetica, sans-serif;";

// ---------------------------------------------------------------------------
// Layout — selection indicator
// ---------------------------------------------------------------------------

/** Off-screen CSS position for hidden selection indicators. */
export const SELECTION_OFFSCREEN = "-1000px";

/** Selection indicator image dimension. */
export const SELECTION_INDICATOR_SIZE = "50px";

/** Selection indicator numeric pixel dimension. */
export const SELECTION_INDICATOR_DIMENSION = 50;

/** Selection indicator marker z-index offset. */
export const SELECTION_INDICATOR_Z_INDEX_OFFSET = 1;
