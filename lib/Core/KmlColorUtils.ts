import Color from "terriajs-cesium/Source/Core/Color";

const KML_ABGR_REGEX = /^[0-9a-fA-F]{8}$/;

export function kmlAbgrToCesiumColor(abgr: string): Color {
  const normalized = abgr.trim();
  if (!KML_ABGR_REGEX.test(normalized)) {
    return Color.WHITE;
  }

  const a = parseInt(normalized.substring(0, 2), 16) / 255;
  const b = parseInt(normalized.substring(2, 4), 16) / 255;
  const g = parseInt(normalized.substring(4, 6), 16) / 255;
  const r = parseInt(normalized.substring(6, 8), 16) / 255;

  return new Color(r, g, b, a);
}

export function cesiumColorToKmlAbgr(color: Color): string {
  const toHex = (val: number) =>
    Math.round(val * 255)
      .toString(16)
      .padStart(2, "0");

  return `${toHex(color.alpha)}${toHex(color.blue)}${toHex(color.green)}${toHex(
    color.red
  )}`;
}
