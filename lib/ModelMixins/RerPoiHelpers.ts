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
import { getMakiIcon, isMakiIcon } from "../Map/Icons/Maki/MakiIcons";

const RER3D_POI_MAX_VISIBLE_DISTANCE = 100000;
const RER3D_POI_DEFAULT_MARKER_COLOR = "royalblue";
const RER3D_POI_MARKER_SIZE = 36;
const RER3D_POI_ICON_STROKE_WIDTH = 1;
const RER3D_POI_ICON_STROKE_COLOR = "#ffffff";

type RerPoiDomainStyle = { symbol: string; color?: string };
type RerPoiDomainStyleGroup = RerPoiDomainStyle & { domainIds: number[] };

const RER3D_POI_DOMAIN_STYLE_GROUPS: RerPoiDomainStyleGroup[] = [
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

const RER3D_POI_DOMAIN_ICON_MAP = RER3D_POI_DOMAIN_STYLE_GROUPS.reduce<
  Record<number, RerPoiDomainStyle>
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
const LABEL_EYE_OFFSET = new ConstantProperty(new Cartesian3(0, 0, -12));
const LABEL_DEPTH_TEST_DISTANCE = new ConstantProperty(
  Number.POSITIVE_INFINITY
);

const BILLBOARD_VERTICAL_ORIGIN = new ConstantProperty(VerticalOrigin.BOTTOM);
const BILLBOARD_HEIGHT_REFERENCE = new ConstantProperty(
  HeightReference.CLAMP_TO_GROUND
);
const BILLBOARD_SIZE = new ConstantProperty(RER3D_POI_MARKER_SIZE);
const BILLBOARD_EYE_OFFSET = new ConstantProperty(new Cartesian3(0, 0, -12));
const BILLBOARD_DEPTH_TEST_DISTANCE = new ConstantProperty(
  Number.POSITIVE_INFINITY
);

function getRerPoiVisibilityRange(
  scalaValue: unknown
): DistanceDisplayCondition | undefined {
  const maxDistance = Number(scalaValue);
  if (Number.isFinite(maxDistance)) {
    return new DistanceDisplayCondition(0, maxDistance);
  }
  return new DistanceDisplayCondition(0, RER3D_POI_MAX_VISIBLE_DISTANCE);
}

export function applyRerPoiLabels(
  dataSource: GeoJsonDataSource,
  clampToGround: boolean
) {
  const entities = dataSource.entities.values;
  const now = JulianDate.now();

  dataSource.entities.suspendEvents();
  try {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const properties = entity.properties;
      const rawValueName = properties?.["NOME"]?.getValue(now);
      if (!rawValueName) continue;

      const visibilityRange = getRerPoiVisibilityRange(
        properties?.["SCALA"]?.getValue(now)
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
        heightReference: clampToGround
          ? new ConstantProperty(HeightReference.CLAMP_TO_GROUND)
          : undefined,
        eyeOffset: LABEL_EYE_OFFSET,
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
  const markerImageCache = new Map<string, string>();

  dataSource.entities.suspendEvents();
  try {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.position) continue;

      const properties = entity.properties;
      const domainRaw = properties?.["ID_DOMINIO"]?.getValue(now);
      const domainId = Number(domainRaw);
      const mapped = Number.isFinite(domainId)
        ? RER3D_POI_DOMAIN_ICON_MAP[domainId]
        : undefined;

      const symbol = mapped?.symbol ?? "marker";
      const color = mapped?.color ?? RER3D_POI_DEFAULT_MARKER_COLOR;
      const iconId = isMakiIcon(symbol) ? symbol : "marker";
      const markerCacheKey = `${iconId}|${color}|${RER3D_POI_MARKER_SIZE}`;

      let markerImage = markerImageCache.get(markerCacheKey);
      if (!markerImage) {
        markerImage = getMakiIcon(
          iconId,
          color,
          RER3D_POI_ICON_STROKE_WIDTH,
          RER3D_POI_ICON_STROKE_COLOR,
          RER3D_POI_MARKER_SIZE,
          RER3D_POI_MARKER_SIZE
        );

        if (markerImage) {
          markerImageCache.set(markerCacheKey, markerImage);
        }
      }

      if (!markerImage) {
        continue;
      }

      const visibilityRange = getRerPoiVisibilityRange(
        properties?.["SCALA"]?.getValue(now)
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
