import { useCallback, useState } from "react";

export const PANEL_WIDTH = 320;
export const PANEL_HEIGHT = 260;
export const LINE_PANEL_Y = 80;
export const AREA_PANEL_Y = LINE_PANEL_Y + PANEL_HEIGHT + 16;

export type ViewshedPanelDefault = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function rightSideX(parentWidth: number) {
  // Parent is already inset from map controls; only keep a small margin.
  return Math.max(16, parentWidth - PANEL_WIDTH - 16);
}

function clampY(preferredY: number, parentHeight: number) {
  return Math.max(
    16,
    Math.min(preferredY, Math.max(16, parentHeight - PANEL_HEIGHT - 16))
  );
}

function measureDefaultBox(
  parent: HTMLElement,
  preferredY: number
): ViewshedPanelDefault {
  return {
    x: rightSideX(parent.clientWidth),
    y: clampY(preferredY, parent.clientHeight),
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT
  };
}

/**
 * Rnd positions are relative to `.featureInfo`, not the window.
 * Measure that parent via a sentinel callback ref before mounting Rnd.
 */
export function useViewshedPanelDefault(
  preferredY: number,
  isVisible: boolean
): {
  sentinelRef: (node: HTMLDivElement | null) => void;
  defaultBox: ViewshedPanelDefault | null;
} {
  const [defaultBox, setDefaultBox] = useState<ViewshedPanelDefault | null>(
    null
  );

  // Clear placement when the panel closes so the next open remeasures.
  if (!isVisible && defaultBox !== null) {
    setDefaultBox(null);
  }

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node?.parentElement) {
        return;
      }
      setDefaultBox(measureDefaultBox(node.parentElement, preferredY));
    },
    [preferredY]
  );

  return {
    sentinelRef,
    defaultBox: isVisible ? defaultBox : null
  };
}
