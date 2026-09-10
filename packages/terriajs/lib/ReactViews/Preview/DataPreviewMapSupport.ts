import type { TFunction } from "i18next";
import { action } from "mobx";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";
import DataSource from "terriajs-cesium/Source/DataSources/DataSource";
import CatalogMemberMixin from "../../ModelMixins/CatalogMemberMixin";
import MappableMixin, {
  ImageryParts,
  isDataSource,
  MapItem
} from "../../ModelMixins/MappableMixin";
import GeoJsonCatalogItem from "../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../Models/Definition/CommonStrata";
import TerriaViewer from "../../ViewModels/TerriaViewer";

export type PreviewedItem = MappableMixin.Instance &
  CatalogMemberMixin.Instance;

export type PreviewBadgeState =
  | "loading"
  | "dataPreviewError"
  | "noPreviewAvailable"
  | "dataPreview";

export const PREVIEW_UNAVAILABLE_MESSAGE_KEY =
  "preview.cannotPreviewInPreviewMap";

/** String-key lookup avoids typed i18n selector until translation types refresh. */
export function translatePreviewUnavailableMessage(t: TFunction): string {
  return (t as (key: string) => string)(PREVIEW_UNAVAILABLE_MESSAGE_KEY);
}

function dataSourceHasLeafletGraphics(dataSource: DataSource): boolean {
  return dataSource.entities.values.some(
    (entity) =>
      entity.point ||
      entity.billboard ||
      entity.label ||
      entity.polyline ||
      entity.polygon ||
      entity.rectangle
  );
}

export function hasLeafletPreviewableMapItems(mapItems: MapItem[]): boolean {
  return mapItems.some((item) => {
    if (ImageryParts.is(item)) {
      return true;
    }
    if (isDataSource(item)) {
      return dataSourceHasLeafletGraphics(item);
    }
    return false;
  });
}

/** The catalogue preview map is always Leaflet (2D) and cannot show 3D-only layers. */
export function isPreviewUnavailableInPreviewMap(
  previewed?: PreviewedItem
): boolean {
  const mapItems = previewed?.mapItems ?? [];
  return mapItems.length > 0 && !hasLeafletPreviewableMapItems(mapItems);
}

export function canAutoZoomCatalogPreview(
  previewed: PreviewedItem | undefined,
  hasBoundingRectangle: boolean
): boolean {
  if (!previewed || previewed.isLoading) {
    return false;
  }
  if (
    previewed.loadMetadataResult?.error ||
    previewed.loadMapItemsResult?.error
  ) {
    return false;
  }
  if (isPreviewUnavailableInPreviewMap(previewed)) {
    return false;
  }
  const mapItems = previewed.mapItems ?? [];
  return hasLeafletPreviewableMapItems(mapItems) || hasBoundingRectangle;
}

export function getPreviewBadgeState(
  previewed: PreviewedItem | undefined,
  hasBoundingRectangle: boolean
): PreviewBadgeState {
  if (previewed?.isLoading) {
    return "loading";
  }
  if (
    previewed?.loadMetadataResult?.error ||
    previewed?.loadMapItemsResult?.error
  ) {
    return "dataPreviewError";
  }
  if (isPreviewUnavailableInPreviewMap(previewed)) {
    return "noPreviewAvailable";
  }
  if (
    (!previewed?.mapItems || previewed.mapItems.length === 0) &&
    !hasBoundingRectangle
  ) {
    return "noPreviewAvailable";
  }
  return "dataPreview";
}

interface PreviewZoomContext {
  previewed?: PreviewedItem;
  previewViewer: TerriaViewer;
  boundingRectangleCatalogItem?: GeoJsonCatalogItem;
  zoomedOutBoundingRectangleCatalogItem?: GeoJsonCatalogItem;
  isZoomedToExtentRef: MutableRefObject<boolean>;
}

function zoomPreviewToExtent({
  previewed,
  previewViewer,
  boundingRectangleCatalogItem,
  zoomedOutBoundingRectangleCatalogItem,
  isZoomedToExtentRef
}: PreviewZoomContext) {
  isZoomedToExtentRef.current = true;
  boundingRectangleCatalogItem?.setTrait(CommonStrata.override, "show", true);
  zoomedOutBoundingRectangleCatalogItem?.setTrait(
    CommonStrata.override,
    "show",
    false
  );
  if (previewed) {
    previewViewer?.currentViewer?.zoomTo(previewed);
  }
}

function zoomPreviewToHome({
  previewViewer,
  boundingRectangleCatalogItem,
  zoomedOutBoundingRectangleCatalogItem,
  isZoomedToExtentRef
}: PreviewZoomContext) {
  isZoomedToExtentRef.current = false;
  boundingRectangleCatalogItem?.setTrait(CommonStrata.override, "show", false);
  zoomedOutBoundingRectangleCatalogItem?.setTrait(
    CommonStrata.override,
    "show",
    true
  );
  previewViewer.currentViewer?.zoomTo(previewViewer?.homeCamera);
}

export function createPreviewToggleZoom(
  context: PreviewZoomContext
): () => void {
  return action(() => {
    context.isZoomedToExtentRef.current = !context.isZoomedToExtentRef.current;

    if (context.isZoomedToExtentRef.current) {
      zoomPreviewToExtent(context);
    } else {
      zoomPreviewToHome(context);
    }
  });
}

export function useCatalogPreviewAutoZoom(context: PreviewZoomContext) {
  const {
    previewed,
    previewViewer,
    boundingRectangleCatalogItem,
    zoomedOutBoundingRectangleCatalogItem,
    isZoomedToExtentRef
  } = context;
  const lastAutoZoomedIdRef = useRef<string | undefined>();
  const hasBoundingRectangle = boundingRectangleCatalogItem !== undefined;
  const canAutoZoom = canAutoZoomCatalogPreview(
    previewed,
    hasBoundingRectangle
  );
  const isPreviewViewerReady =
    previewViewer.attached && previewViewer.currentViewer.type !== "NoViewer";

  useEffect(() => {
    if (!canAutoZoom || !previewed || !isPreviewViewerReady) {
      if (!canAutoZoom) {
        lastAutoZoomedIdRef.current = undefined;
      }
      return;
    }
    if (lastAutoZoomedIdRef.current === previewed.uniqueId) {
      return;
    }
    lastAutoZoomedIdRef.current = previewed.uniqueId;
    zoomPreviewToExtent({
      previewed,
      previewViewer,
      boundingRectangleCatalogItem,
      zoomedOutBoundingRectangleCatalogItem,
      isZoomedToExtentRef
    });
  }, [
    boundingRectangleCatalogItem,
    canAutoZoom,
    isPreviewViewerReady,
    isZoomedToExtentRef,
    previewed,
    previewViewer,
    zoomedOutBoundingRectangleCatalogItem
  ]);
}

export function useDataPreviewMapSupport(
  previewed: PreviewedItem | undefined,
  previewViewer: TerriaViewer,
  boundingRectangleCatalogItem: GeoJsonCatalogItem | undefined,
  zoomedOutBoundingRectangleCatalogItem: GeoJsonCatalogItem | undefined,
  isZoomedToExtentRef: MutableRefObject<boolean>
) {
  const zoomContext = useMemo(
    () => ({
      previewed,
      previewViewer,
      boundingRectangleCatalogItem,
      zoomedOutBoundingRectangleCatalogItem,
      isZoomedToExtentRef
    }),
    [
      previewed,
      previewViewer,
      boundingRectangleCatalogItem,
      zoomedOutBoundingRectangleCatalogItem,
      isZoomedToExtentRef
    ]
  );

  const isPreviewUnavailableIn2d = isPreviewUnavailableInPreviewMap(previewed);

  const previewBadgeState = getPreviewBadgeState(
    previewed,
    boundingRectangleCatalogItem !== undefined
  );

  const toggleZoom = useMemo(
    () => createPreviewToggleZoom(zoomContext),
    [zoomContext]
  );

  useCatalogPreviewAutoZoom(zoomContext);

  return {
    toggleZoom,
    previewBadgeState,
    isPreviewUnavailableIn2d
  };
}
