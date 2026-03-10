import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import PinBuilder from "terriajs-cesium/Source/Core/PinBuilder";
import BillboardGraphics from "terriajs-cesium/Source/DataSources/BillboardGraphics";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import LabelGraphics from "terriajs-cesium/Source/DataSources/LabelGraphics";
import PropertyBag from "terriajs-cesium/Source/DataSources/PropertyBag";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import HorizontalOrigin from "terriajs-cesium/Source/Scene/HorizontalOrigin";
import LabelStyle from "terriajs-cesium/Source/Scene/LabelStyle";
import VerticalOrigin from "terriajs-cesium/Source/Scene/VerticalOrigin";
import { isPoint, FeatureCollectionWithCrs } from "../../../Core/GeoJson";
import { GLYPHS } from "../../../Styled/Icon";

export interface ClusteringOptions {
  enabled: boolean;
  pixelRange: number;
  minimumClusterSize: number;
  pinSize: number;
  pinBackgroundColor: string;
}

export default async function buildMapServerPinDataSource(
  geoJson: FeatureCollectionWithCrs,
  name?: string,
  clustering?: ClusteringOptions
): Promise<CustomDataSource | undefined> {
  const pointFeatures = geoJson.features.filter((f) => isPoint(f));
  if (pointFeatures.length === 0) return undefined;

  const pinBuilder = new PinBuilder();
  const glyphs = getAvailableGlyphs();

  const dataSource = new CustomDataSource(name || "MapServer POI");
  dataSource.entities.suspendEvents();

  const entities = await Promise.all(
    pointFeatures.map(async (feature) => {
      if (!feature.geometry || feature.geometry.type !== "Point") return;

      const coords = feature.geometry.coordinates;
      const props = feature.properties ?? {};
      const nome = props["Nome"] ?? props["nome"] ?? props["NOME"] ?? "";
      const pinImage = await createPinImage(
        pinBuilder,
        randomColor(),
        randomGlyph(glyphs)
      );

      return new Entity({
        position: new ConstantPositionProperty(
          Cartesian3.fromDegrees(coords[0], coords[1], 0)
        ),
        billboard: new BillboardGraphics({
          image: new ConstantProperty(pinImage),
          verticalOrigin: new ConstantProperty(VerticalOrigin.BOTTOM),
          heightReference: new ConstantProperty(
            HeightReference.CLAMP_TO_GROUND
          ),
          width: new ConstantProperty(32),
          height: new ConstantProperty(32),
          disableDepthTestDistance: new ConstantProperty(
            Number.POSITIVE_INFINITY
          )
        }),
        label: new LabelGraphics({
          text: new ConstantProperty(nome),
          font: new ConstantProperty("14px sans-serif"),
          style: new ConstantProperty(LabelStyle.FILL_AND_OUTLINE),
          fillColor: new ConstantProperty(Color.BLACK),
          outlineColor: new ConstantProperty(Color.WHITE),
          outlineWidth: new ConstantProperty(2),
          verticalOrigin: new ConstantProperty(VerticalOrigin.BOTTOM),
          horizontalOrigin: new ConstantProperty(HorizontalOrigin.CENTER),
          pixelOffset: new ConstantProperty(new Cartesian2(0, -36)),
          heightReference: new ConstantProperty(
            HeightReference.CLAMP_TO_GROUND
          ),
          disableDepthTestDistance: new ConstantProperty(
            Number.POSITIVE_INFINITY
          )
        }),
        properties: new PropertyBag(props)
      });
    })
  );

  for (const entity of entities) {
    if (entity) {
      dataSource.entities.add(entity);
    }
  }

  dataSource.entities.resumeEvents();

  if (clustering?.enabled) {
    const clusterPinBuilder = new PinBuilder();
    dataSource.clustering.enabled = true;
    dataSource.clustering.pixelRange = clustering.pixelRange;
    dataSource.clustering.minimumClusterSize = clustering.minimumClusterSize;
    dataSource.clustering.clusterEvent.addEventListener(function (
      entities,
      cluster
    ) {
      cluster.label.show = false;
      cluster.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
      cluster.billboard.image = clusterPinBuilder
        .fromText(
          entities.length.toLocaleString(),
          Color.fromCssColorString(clustering.pinBackgroundColor),
          clustering.pinSize
        )
        .toDataURL();
      cluster.billboard.show = true;
    });
  }

  return dataSource;
}

function randomColor(): Color {
  return new Color(Math.random(), Math.random(), Math.random(), 1.0);
}

function getAvailableGlyphs() {
  return Object.values(GLYPHS).filter(
    (glyph): glyph is { id: string } => typeof glyph?.id === "string"
  );
}

function randomGlyph(glyphs: { id: string }[]) {
  if (glyphs.length === 0) return undefined;
  return glyphs[Math.floor(Math.random() * glyphs.length)];
}

async function createPinImage(
  pinBuilder: PinBuilder,
  pinColor: Color,
  glyph?: { id: string }
): Promise<string> {
  const fallbackPin = pinBuilder.fromColor(pinColor, 48).toDataURL();

  if (!glyph) return fallbackPin;

  const iconUrl = getGlyphDataUrl(glyph.id);
  if (!iconUrl) return fallbackPin;

  try {
    const canvas = await Promise.resolve(
      pinBuilder.fromUrl(iconUrl, pinColor, 48)
    );
    return canvas.toDataURL();
  } catch {
    return fallbackPin;
  }
}

function getGlyphDataUrl(glyphId: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  const symbol = document.getElementById(glyphId);
  if (!symbol) return undefined;

  const viewBox = symbol.getAttribute("viewBox") ?? "0 0 100 100";
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    symbol.innerHTML,
    "</svg>"
  ].join("");

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
