import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import DistanceDisplayCondition from "terriajs-cesium/Source/Core/DistanceDisplayCondition";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import BillboardGraphics from "terriajs-cesium/Source/DataSources/BillboardGraphics";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import GeoJsonDataSource from "terriajs-cesium/Source/DataSources/GeoJsonDataSource";
import LabelGraphics from "terriajs-cesium/Source/DataSources/LabelGraphics";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import HorizontalOrigin from "terriajs-cesium/Source/Scene/HorizontalOrigin";
import LabelStyle from "terriajs-cesium/Source/Scene/LabelStyle";
import VerticalOrigin from "terriajs-cesium/Source/Scene/VerticalOrigin";
import isDefined from "../Core/isDefined";
import { getMakiIcon, isMakiIcon } from "../Map/Icons/Maki/MakiIcons";

export const RER_POI_CATALOG_ITEM_TYPE = "rer-poi";
export const RER_POI_DEFAULT_NAME = "rer3d poi";
export const RER_POI_URL_REGEX =
  /^https?:\/\/servizigis\.regione\.emilia-romagna\.it\/geoags\/rest\/services\/portale\/rer3d_poi\/MapServer\/0$/i;

export const RER_POI_NAME_FIELD = "NOME";
export const RER_POI_SCALE_FIELD = "SCALA";
export const RER_POI_LEVEL_ID_FIELD = "LEVEL_ID";
export const RER_POI_DOMAIN_ID_FIELD = "ID_DOMINIO";

export const RER_POI_MIN_LEVEL_ID = 7;
export const RER_POI_MAX_LEVEL_ID = 19;
export const RER_POI_PROGRESSIVE_LEVEL_STEP = 1;
export const RER_POI_DEFAULT_QUERY_BBOX_PADDING_RATIO = 0.2;
export const RER_POI_DEFAULT_DYNAMIC_CACHE_MAX_ENTRIES = 480;
export const RER_POI_DEFAULT_DYNAMIC_REQUEST_DEBOUNCE_MS = 350;
export const RER_POI_DEFAULT_MIN_NEW_VIEWPORT_AREA_RATIO_FOR_RELOAD = 0.12;
export const RER_POI_PROGRESSIVE_FAR_CAMERA_HEIGHT = 140000;
export const RER_POI_PROGRESSIVE_NEAR_CAMERA_HEIGHT = 1800;

export function normalizeRerPoiUrl(url: string | undefined) {
  return (url || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

export function isRerPoiUrl(url: string | undefined) {
  return RER_POI_URL_REGEX.test(normalizeRerPoiUrl(url));
}

const DEFAULT_MARKER_COLOR = "royalblue";
const MARKER_SIZE = 36;
const ICON_STROKE_WIDTH = 1;
const ICON_STROKE_COLOR = "#ffffff";
const MARKER_IMAGE_CACHE = new Map<string, string>();

type PoiDomainStyle = { symbol: string; color?: string };
type PoiDomainStyleGroup = PoiDomainStyle & { domainIds: number[] };

const POI_DOMAIN_STYLE_GROUPS: PoiDomainStyleGroup[] = [
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
];

const POI_DOMAIN_ICON_MAP = POI_DOMAIN_STYLE_GROUPS.reduce<
  Record<number, PoiDomainStyle>
>((acc, group) => {
  for (let i = 0; i < group.domainIds.length; i++) {
    const domainId = group.domainIds[i];
    acc[domainId] = {
      symbol: group.symbol,
      color: group.color
    };
  }
  return acc;
}, {});

const LABEL_VERTICAL_ORIGIN = new ConstantProperty(VerticalOrigin.BOTTOM);
const LABEL_HORIZONTAL_ORIGIN = new ConstantProperty(HorizontalOrigin.CENTER);
const LABEL_DEPTH_TEST_DISTANCE = new ConstantProperty(
  Number.POSITIVE_INFINITY
);

const BILLBOARD_VERTICAL_ORIGIN = new ConstantProperty(VerticalOrigin.BOTTOM);
const BILLBOARD_HEIGHT_REFERENCE = new ConstantProperty(
  HeightReference.CLAMP_TO_GROUND
);
const BILLBOARD_SIZE = new ConstantProperty(MARKER_SIZE);
const BILLBOARD_EYE_OFFSET = new ConstantProperty(new Cartesian3(0, 0, -12));
const BILLBOARD_DEPTH_TEST_DISTANCE = new ConstantProperty(
  Number.POSITIVE_INFINITY
);

function getRerPoiVisibilityRange(
  scalaValue: number | undefined
): DistanceDisplayCondition | undefined {
  const maxDistance = Number(scalaValue);
  if (Number.isFinite(maxDistance)) {
    return new DistanceDisplayCondition(0, maxDistance);
  }
  return undefined;
}

function getCachedMarkerImage(iconId: string, color: string) {
  const markerCacheKey = `${iconId}|${color}|${MARKER_SIZE}`;
  let markerImage = MARKER_IMAGE_CACHE.get(markerCacheKey);

  if (!markerImage) {
    markerImage = getMakiIcon(
      iconId,
      color,
      ICON_STROKE_WIDTH,
      ICON_STROKE_COLOR,
      MARKER_SIZE,
      MARKER_SIZE
    );

    if (markerImage) {
      MARKER_IMAGE_CACHE.set(markerCacheKey, markerImage);
    }
  }

  return markerImage;
}

export function applyRerPoiLabels(dataSource: GeoJsonDataSource) {
  const entities = dataSource.entities.values;
  const now = JulianDate.now();

  dataSource.entities.suspendEvents();
  try {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const properties = entity.properties;
      const rawValueName = properties?.[RER_POI_NAME_FIELD]?.getValue(now);
      if (!isDefined(rawValueName) || String(rawValueName).length === 0)
        continue;

      const visibilityRange = getRerPoiVisibilityRange(
        properties?.[RER_POI_SCALE_FIELD]?.getValue(now)
      );

      entity.label = new LabelGraphics({
        text: String(rawValueName),
        font: "12px sans-serif",
        fillColor: Color.BLACK,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: LABEL_VERTICAL_ORIGIN,
        horizontalOrigin: LABEL_HORIZONTAL_ORIGIN,
        heightReference: undefined,
        pixelOffset: new Cartesian2(0, -40),
        distanceDisplayCondition: visibilityRange
          ? new ConstantProperty(visibilityRange)
          : undefined,
        disableDepthTestDistance: LABEL_DEPTH_TEST_DISTANCE
      });
    }
  } finally {
    dataSource.entities.resumeEvents();
  }
}

export function applyRerPoiMakiBillboards(dataSource: GeoJsonDataSource) {
  const entities = dataSource.entities.values;
  const now = JulianDate.now();

  dataSource.entities.suspendEvents();
  try {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.position) continue;

      const properties = entity.properties;
      const domainRaw = properties?.[RER_POI_DOMAIN_ID_FIELD]?.getValue(now);
      const domainId = Number(domainRaw);
      const mapped = Number.isFinite(domainId)
        ? POI_DOMAIN_ICON_MAP[domainId]
        : undefined;

      const symbol = mapped?.symbol ?? "marker";
      const color = mapped?.color ?? DEFAULT_MARKER_COLOR;
      const iconId = isMakiIcon(symbol) ? symbol : "marker";
      const markerImage = getCachedMarkerImage(iconId, color);

      if (!markerImage) {
        continue;
      }

      const visibilityRange = getRerPoiVisibilityRange(
        properties?.[RER_POI_SCALE_FIELD]?.getValue(now)
      );

      entity.billboard = new BillboardGraphics({
        image: new ConstantProperty(markerImage),
        verticalOrigin: BILLBOARD_VERTICAL_ORIGIN,
        heightReference: BILLBOARD_HEIGHT_REFERENCE,
        width: BILLBOARD_SIZE,
        height: BILLBOARD_SIZE,
        eyeOffset: BILLBOARD_EYE_OFFSET,
        distanceDisplayCondition: visibilityRange
          ? new ConstantProperty(visibilityRange)
          : undefined,
        disableDepthTestDistance: BILLBOARD_DEPTH_TEST_DISTANCE
      });
      entity.point = undefined;
    }
  } finally {
    dataSource.entities.resumeEvents();
  }
}
