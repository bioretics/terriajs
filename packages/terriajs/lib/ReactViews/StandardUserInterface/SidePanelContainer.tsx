import styled, { useTheme } from "styled-components";
import ViewState from "../../ReactViewModels/ViewState";
import { withViewState } from "../Context";
// Fork (rer3d): draggable/resizable workbench panel.
import { Rnd } from "react-rnd";
import React from "react";

type PropsType = {
  viewState: ViewState;
  show: boolean;
  children?: React.ReactNode;
};

const StyledPanel = styled.div<PropsType>`
  display: flex;
  flex-direction: column;
  background: ${(p) => p.theme.darkTranslucent};
  backdrop-filter: blur(5px);
  font-family: ${(p) => p.theme.fontPop}px;
  width: 100%;
  height: calc(100% - 10px);
  margin-top: 5px;
  box-sizing: border-box;
  border-radius: 8px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: ${(p) => (p.show ? 1 : 0)};
`;

// Fork (rer3d): the workbench side panel is a draggable/resizable panel
// (react-rnd) whose default height comes from
// configParameters.workbenchPanelDefaultHeight. Upstream's top-element and
// resize-event wiring is preserved below.
const SidePanelContainer: React.FC<PropsType> = (props) => {
  const { viewState } = props;
  const theme = useTheme();
  if (!props.show) return null;

  const rootStyle = document.documentElement.style;
  return (
    <Rnd
      default={{
        x: 15,
        y: 0,
        width:
          parseFloat(rootStyle.getPropertyValue("--workbench-width")) ||
          Number(theme.workbenchWidth),
        height: "100%"
      }}
      minWidth={300}
      maxWidth="50%"
      bounds="parent"
      disableDragging
      enableResizing={{ right: true }}
      onResize={(_e, _dir, ref) =>
        rootStyle.setProperty("--workbench-width", `${ref.offsetWidth}px`)
      }
      style={{ zIndex: 1 }}
    >
      <StyledPanel
        {...props}
        className={
          viewState.topElement === "SidePanel" ? "top-element" : undefined
        }
        onClick={() => viewState.setTopElement("SidePanel")}
        onTransitionEnd={() => viewState.triggerResizeEvent()}
      >
        {props.children}
      </StyledPanel>
    </Rnd>
  );
};

export default withViewState(SidePanelContainer);
