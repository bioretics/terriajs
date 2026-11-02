import type { GeoTIFFImage } from "geotiff";
import L from "leaflet";
import { FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WebMapServiceCapabilities from "../../Models/Catalog/Ows/WebMapServiceCapabilities";
import Box from "../../Styled/Box";
import Button from "../../Styled/Button";
import Text from "../../Styled/Text";

const TILE_SIZE = 256;

interface ImageLevel {
  width: number;
  height: number;
}

export const maxNativeZoom = (width: number, height: number) =>
  Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / TILE_SIZE)));

export function tileRequest(
  coords: { x: number; y: number; z: number },
  levels: ImageLevel[]
) {
  const { width, height } = levels[0];
  const scale = 2 ** (maxNativeZoom(width, height) - coords.z);
  const x0 = coords.x * TILE_SIZE * scale;
  const y0 = coords.y * TILE_SIZE * scale;
  if (coords.x < 0 || coords.y < 0 || x0 >= width || y0 >= height) {
    return undefined;
  }
  const x1 = Math.min(x0 + TILE_SIZE * scale, width);
  const y1 = Math.min(y0 + TILE_SIZE * scale, height);

  let level = 0;
  while (
    level + 1 < levels.length &&
    levels[level + 1].width * scale >= width * 0.99
  ) {
    level++;
  }
  const fx = levels[level].width / width;
  const fy = levels[level].height / height;
  return {
    level,
    window: [
      Math.floor(x0 * fx),
      Math.floor(y0 * fy),
      Math.min(Math.ceil(x1 * fx), levels[level].width),
      Math.min(Math.ceil(y1 * fy), levels[level].height)
    ],
    width: Math.ceil((x1 - x0) / scale),
    height: Math.ceil((y1 - y0) / scale)
  };
}

class CogLayer extends L.GridLayer {
  private readonly aborts = new WeakMap<HTMLElement, AbortController>();

  constructor(
    private readonly images: GeoTIFFImage[],
    private readonly levels: ImageLevel[],
    options: L.GridLayerOptions
  ) {
    super(options);
    this.on("tileunload", (event: L.TileEvent) =>
      this.aborts.get(event.tile)?.abort()
    );
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TILE_SIZE;
    const request = tileRequest(coords, this.levels);
    if (!request) {
      setTimeout(() => done(undefined, canvas));
      return canvas;
    }

    const controller = new AbortController();
    this.aborts.set(canvas, controller);
    this.images[request.level]
      .readRGB({
        window: request.window,
        width: request.width,
        height: request.height,
        interleave: true,
        signal: controller.signal
      })
      .then((rgb) => {
        const context = canvas.getContext("2d")!;
        const pixels = context.createImageData(request.width, request.height);
        const source = rgb as unknown as ArrayLike<number>;
        for (let i = 0, j = 0; j < pixels.data.length; i += 3, j += 4) {
          pixels.data[j] = source[i];
          pixels.data[j + 1] = source[i + 1];
          pixels.data[j + 2] = source[i + 2];
          pixels.data[j + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        done(undefined, canvas);
      })
      .catch((error) => done(error, canvas));
    return canvas;
  }
}

async function cogImage(url: string) {
  const { fromUrl } = await import("geotiff");
  const tiff = await fromUrl(url);
  const count = await tiff.getImageCount();
  const images = await Promise.all(
    Array.from({ length: count }, (_, i) => tiff.getImage(i))
  );
  const levels = images.map((image) => ({
    width: image.getWidth(),
    height: image.getHeight()
  }));
  return {
    ...levels[0],
    crs: L.CRS.Simple,
    layer: (options: L.GridLayerOptions) =>
      new CogLayer(images, levels, options)
  };
}

const PIXEL_CRS = "EPSG:404000";

async function wmsImage(url: string, layers: string) {
  const capabilities = await WebMapServiceCapabilities.fromUrl(
    `${url}?service=WMS&version=1.3.0&request=GetCapabilities`
  );
  const box = [(capabilities.findLayer(layers) as any)?.BoundingBox]
    .flat()
    .find((b) => b?.CRS === PIXEL_CRS);
  if (!box) throw new Error(`${layers} has no ${PIXEL_CRS} bounding box`);
  const [minx, miny, maxx, maxy] = [box.minx, box.miny, box.maxx, box.maxy].map(
    Number
  );
  const width = maxx - minx;
  const height = maxy - miny;
  const scale = 2 ** -maxNativeZoom(width, height);
  return {
    width,
    height,
    crs: L.Util.extend({}, L.CRS.Simple, {
      code: PIXEL_CRS,
      transformation: new L.Transformation(
        scale,
        -scale * minx,
        -scale,
        scale * maxy
      )
    }),
    layer: (options: L.TileLayerOptions) =>
      L.tileLayer.wms(url, { ...options, layers, format: "image/jpeg" })
  };
}

interface Props {
  url: string;
  layer?: string;
}

const FontesImageViewer: FC<Props> = ({ url, layer }) => {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<{ map: L.Map; bounds: L.LatLngBounds }>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const image = layer ? await wmsImage(url, layer) : await cogImage(url);
        if (cancelled || !container.current) return;

        const zoom = maxNativeZoom(image.width, image.height);
        const leaflet = L.map(container.current, {
          crs: image.crs,
          minZoom: 0,
          maxZoom: zoom + 2,
          zoomSnap: 0.25,
          attributionControl: false
        });
        const bounds = L.latLngBounds(
          leaflet.unproject([0, image.height], zoom),
          leaflet.unproject([image.width, 0], zoom)
        );
        image
          .layer({
            bounds,
            noWrap: true,
            tileSize: TILE_SIZE,
            maxNativeZoom: zoom,
            maxZoom: zoom + 2
          })
          .addTo(leaflet);
        leaflet.fitBounds(bounds);
        map.current = { map: leaflet, bounds };
        setStatus("ready");
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      map.current?.map.remove();
      map.current = undefined;
    };
  }, [url, layer]);

  return (
    <Box column fullWidth fullHeight position="relative">
      <div
        ref={container}
        css={`
          flex: 1;
          min-height: 0;
          background: #3a3a3a;
        `}
      />
      {status !== "ready" && (
        <Box
          position="absolute"
          centered
          fullWidth
          fullHeight
          css={`
            top: 0;
            pointer-events: none;
          `}
        >
          <Text textLight medium>
            {status === "loading"
              ? t(($) => $.fontes.loadingImage)
              : t(($) => $.fontes.noImage)}
          </Text>
        </Box>
      )}
      {status === "ready" && (
        <Button
          secondary
          css={`
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
          `}
          onClick={() =>
            map.current && map.current.map.fitBounds(map.current.bounds)
          }
        >
          {t(($) => $.fontes.fit)}
        </Button>
      )}
    </Box>
  );
};

export default FontesImageViewer;
