import React, { useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import ViewState from "../../ReactViewModels/ViewState";
import { withViewState } from "../Context";

type PropsType = {
  viewState: ViewState;
  show: boolean;
  children?: React.ReactNode;
};

// Overlay workbench panel (GeoLibre-style). Floats over the map to the right of
// the side rail, is resizable from its right edge, and collapses when
// `viewState.isMapFullScreen` is set. Background is 50% transparent so the map
// shows through; the rail itself stays opaque.
const SidePanelContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${(p) => p.theme.sideRailWidth}px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  z-index: ${(p) => p.theme.zPanelFloat || 100};
  background: ${(p) => p.theme.cardOverlay};
  border-right: 1px solid ${(p) => p.theme.border};
  color: ${(p) => p.theme.textLight};
  font-family: ${(p) => p.theme.fontBase};
  overflow: visible;
`;

const ResizeHandle = styled.div<{ isResizing: boolean }>`
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: ${(p) => p.theme.zChrome || 3};
  touch-action: none;
  user-select: none;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
    background: ${(p) => (p.isResizing ? p.theme.colorPrimary : "transparent")};
    transition: background-color 0.15s ease;
  }

  &:hover::after {
    background: ${(p) => p.theme.colorPrimary};
  }
`;

const DockedSidePanel: React.FC<PropsType> = (props) => {
  const { viewState, show } = props;
  const theme = useTheme();
  const defaultWidth = Number(theme.workbenchWidth) || 320;
  const minWidth = Number(theme.workbenchMinWidth) || 180;
  const maxWidth = Number(theme.workbenchMaxWidth) || 560;

  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setResizing] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const clamp = (value: number) =>
    Math.min(maxWidth, Math.max(minWidth, Math.round(value)));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { startX: e.clientX, startWidth: width };
    setResizing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    setWidth(
      clamp(dragState.current.startWidth + e.clientX - dragState.current.startX)
    );
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    dragState.current = null;
    setResizing(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  if (!show) return null;

  return (
    <SidePanelContainer
      style={{ width }}
      className={
        viewState.topElement === "SidePanel" ? "top-element" : undefined
      }
      onClick={() => viewState.setTopElement("SidePanel")}
    >
      {props.children}
      <ResizeHandle
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        isResizing={isResizing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </SidePanelContainer>
  );
};

export default withViewState(DockedSidePanel);
