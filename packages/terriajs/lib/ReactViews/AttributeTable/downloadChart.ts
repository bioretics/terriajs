/**
 * Save an inline chart `<svg>` as a standalone SVG or a rasterized PNG. DOM
 * only: the charts already paint with resolved theme colors, so serializing the
 * element is enough to get a file that looks like what is on screen.
 */

import FileSaver from "file-saver";

/**
 * Serialize a chart SVG into a standalone document: a clone with explicit pixel
 * dimensions and the SVG namespace declared, so it opens outside the browser.
 */
export function serializeChartSvg(
  svg: SVGSVGElement,
  width: number,
  height: number
): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  return new XMLSerializer().serializeToString(clone);
}

/** Save the chart as a standalone `.svg` file. */
export function downloadChartSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
  fileName: string
): void {
  const source = serializeChartSvg(svg, width, height);
  FileSaver.saveAs(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
    fileName
  );
}

/**
 * Rasterize the chart to a `.png` at `scale` times its on-screen size, on an
 * opaque white background (the dialog's own background) so the file is not
 * transparent. Resolves once the browser has been handed the file.
 */
export async function downloadChartPng(
  svg: SVGSVGElement,
  width: number,
  height: number,
  fileName: string,
  scale = 2
): Promise<void> {
  const source = serializeChartSvg(svg, width, height);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render chart image."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      source
    )}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode the chart image."));
        return;
      }
      FileSaver.saveAs(blob, fileName);
      resolve();
    }, "image/png");
  });
}
