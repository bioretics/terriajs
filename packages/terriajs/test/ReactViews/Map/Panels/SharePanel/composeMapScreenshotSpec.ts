import Terria from "../../../../../lib/Models/Terria";
import { composeMapScreenshot } from "../../../../../lib/ReactViews/Map/Panels/SharePanel/Print/composeMapScreenshot";

const WIDTH = 200;
const HEIGHT = 120;

function blankScreenshot(): string {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#336699";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Counts pixels in a region that are no longer the flat background colour. */
async function paintedPixels(
  dataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<number> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(x, y, width, height);

  let painted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 0x33 || data[i + 1] !== 0x66 || data[i + 2] !== 0x99) {
      painted++;
    }
  }
  return painted;
}

describe("composeMapScreenshot", function () {
  let terria: Terria;
  let screenshot: string;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    screenshot = blankScreenshot();
    spyOn(terria.currentViewer, "getContainer").and.returnValue(
      document.createElement("div")
    );
  });

  it("hands the screenshot straight back when no overlay was asked for", async function () {
    const result = await composeMapScreenshot(screenshot, terria, {
      includeScaleBar: false,
      includeCompass: false
    });

    expect(result).toBe(screenshot);
  });

  it("keeps the screenshot's size when it draws an overlay", async function () {
    const result = await composeMapScreenshot(screenshot, terria, {
      includeScaleBar: false,
      includeCompass: true
    });

    const img = await loadImage(result);
    expect(img.width).toEqual(WIDTH);
    expect(img.height).toEqual(HEIGHT);
    expect(result.startsWith("data:image/png")).toBe(true);
  });

  it("draws the north arrow in the top right corner", async function () {
    const result = await composeMapScreenshot(screenshot, terria, {
      includeScaleBar: false,
      includeCompass: true
    });

    expect(await paintedPixels(result, WIDTH - 60, 0, 60, 60)).toBeGreaterThan(
      0
    );
    expect(await paintedPixels(result, 0, HEIGHT - 60, 60, 60)).toEqual(0);
  });

  it("leaves the map alone when there is no scale to measure", async function () {
    const result = await composeMapScreenshot(screenshot, terria, {
      includeScaleBar: true,
      includeCompass: false
    });

    // No viewer means no distance legend, but the screenshot must survive.
    const img = await loadImage(result);
    expect(img.width).toEqual(WIDTH);
    expect(await paintedPixels(result, 0, 0, WIDTH, HEIGHT)).toEqual(0);
  });
});
