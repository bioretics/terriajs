import { select as d3Select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode
} from "react";
import { XScale } from "./types";

interface Props {
  initialScale: XScale;
  scaleExtent: [number, number];
  translateExtent: [[number, number], [number, number]];
  children: ReactNode;
  onZoom: (arg: XScale) => void;
  surface: string;
}

export interface ZoomXHandle {
  resetZoom: () => void;
}

const ZoomX = forwardRef<ZoomXHandle, Props>(function ZoomX(
  {
    surface,
    scaleExtent,
    translateExtent,
    initialScale,
    onZoom,
    children
  }: Props,
  ref
) {
  const zoomBehaviorRef = useRef<ReturnType<typeof d3Zoom> | null>(null);
  const selectionRef = useRef<ReturnType<typeof d3Select> | null>(null);
  const onZoomRef = useRef(onZoom);
  const initialScaleRef = useRef(initialScale);

  const scaleExtentMin = scaleExtent[0];
  const scaleExtentMax = scaleExtent[1];
  const translateExtentX0 = translateExtent[0][0];
  const translateExtentY0 = translateExtent[0][1];
  const translateExtentX1 = translateExtent[1][0];
  const translateExtentY1 = translateExtent[1][1];

  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  useEffect(() => {
    initialScaleRef.current = initialScale;
  }, [initialScale]);

  const resetZoom = useCallback(() => {
    if (!selectionRef.current || !zoomBehaviorRef.current) return;
    selectionRef.current.call(
      (zoomBehaviorRef.current as never as any).transform,
      zoomIdentity
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      resetZoom
    }),
    [resetZoom]
  );

  useEffect(() => {
    const zoom = d3Zoom()
      .scaleExtent([scaleExtentMin, scaleExtentMax])
      .translateExtent([
        [translateExtentX0, translateExtentY0],
        [translateExtentX1, translateExtentY1]
      ])
      .on("zoom", (event) => {
        onZoomRef.current(event.transform.rescaleX(initialScaleRef.current));
      });

    zoomBehaviorRef.current = zoom;

    const selection = d3Select(surface);
    selectionRef.current = selection as never;

    selection.call(zoom as never);

    // Initialize to unzoomed state once after mount/retargeting.
    selection.call((zoom as never as any).transform, zoomIdentity);

    return () => {
      selection.on(".zoom", null);
      selectionRef.current = null;
      zoomBehaviorRef.current = null;
    };
  }, [
    surface,
    scaleExtentMin,
    scaleExtentMax,
    translateExtentX0,
    translateExtentY0,
    translateExtentX1,
    translateExtentY1
  ]);

  return children;
});

ZoomX.displayName = "ZoomX";

export default ZoomX;
