import Terria from "../../../../../Models/Terria";
import {
  getDistanceLegendMetrics,
  getMapHeading
} from "./getDistanceLegendMetrics";
import {
  BASE_COMPASS_SIZE,
  COMPASS_INNER_DATA_URI,
  COMPASS_OUTER_DATA_URI
} from "./printCompassAssets";

export interface PrintMapOverlayOptions {
  includeScaleBar: boolean;
  includeCompass: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  metrics: { label: string; barWidth: number },
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  const padding = 5 * scaleFactor;
  const containerWidth = 125 * scaleFactor;
  const barLeft =
    padding + (containerWidth - padding * 2 - metrics.barWidth) / 2;
  const labelHeight = 14 * scaleFactor;
  const barBorder = 3 * scaleFactor;
  const boxHeight = padding * 2 + labelHeight + barBorder + padding;
  const margin = 10 * scaleFactor;
  const boxX = canvasWidth - containerWidth - margin;
  const boxY = canvasHeight - boxHeight - 5 * scaleFactor;

  ctx.fillStyle = "white";
  ctx.fillRect(boxX, boxY, containerWidth, boxHeight);

  ctx.fillStyle = "black";
  ctx.font = `${11 * scaleFactor}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(
    metrics.label,
    boxX + containerWidth / 2,
    boxY + padding + labelHeight * 0.8
  );

  const barY = boxY + padding + labelHeight;
  const barX = boxX + barLeft;

  ctx.strokeStyle = "black";
  ctx.lineWidth = barBorder;
  ctx.beginPath();
  ctx.moveTo(barX, barY + barBorder / 2);
  ctx.lineTo(barX + metrics.barWidth, barY + barBorder / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX, barY + barBorder);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(barX + metrics.barWidth, barY);
  ctx.lineTo(barX + metrics.barWidth, barY + barBorder);
  ctx.stroke();
}

async function drawCompass(
  ctx: CanvasRenderingContext2D,
  heading: number,
  scaleFactor: number
) {
  const size = BASE_COMPASS_SIZE * scaleFactor;
  const padding = 5 * scaleFactor;
  const margin = 10 * scaleFactor;
  const totalSize = size + padding * 2;
  const x = margin;
  const y = margin;

  ctx.fillStyle = "white";
  ctx.fillRect(x, y, totalSize, totalSize);

  const [outerImg, innerImg] = await Promise.all([
    loadImage(COMPASS_OUTER_DATA_URI),
    loadImage(COMPASS_INNER_DATA_URI)
  ]);

  const centerX = x + totalSize / 2;
  const centerY = y + totalSize / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-heading);
  ctx.drawImage(outerImg, -size / 2, -size / 2, size, size);
  ctx.restore();

  const innerSize = size * 0.7;
  ctx.drawImage(
    innerImg,
    centerX - innerSize / 2,
    centerY - innerSize / 2,
    innerSize,
    innerSize
  );
}

export async function composeMapScreenshot(
  dataUrl: string,
  terria: Terria,
  options: PrintMapOverlayOptions
): Promise<string> {
  if (!options.includeScaleBar && !options.includeCompass) {
    return dataUrl;
  }

  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return dataUrl;
  }

  ctx.drawImage(img, 0, 0);

  const container = terria.currentViewer.getContainer() as HTMLElement;
  const scaleFactor =
    container.clientWidth > 0 ? img.width / container.clientWidth : 1;

  if (options.includeScaleBar) {
    const metrics = getDistanceLegendMetrics(terria, scaleFactor);
    if (metrics) {
      drawScaleBar(ctx, metrics, canvas.width, canvas.height, scaleFactor);
    }
  }

  if (options.includeCompass) {
    try {
      await drawCompass(ctx, getMapHeading(terria), scaleFactor);
    } catch {
      // If compass assets fail to load, still return the map with any scale bar.
    }
  }

  return canvas.toDataURL("image/png");
}
