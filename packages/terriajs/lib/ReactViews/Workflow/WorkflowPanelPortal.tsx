import { FC } from "react";
import styled from "styled-components";
import { Portal } from "../StandardUserInterface/Portal";
import { WorkflowPanelPortalId } from "./WorkflowPanel";

type PropsType = {
  show: boolean;
};

/**
 * Host for workflow panels. Overlays the map in the same slot as the Layers
 * workbench (same width, same translucent surface) while a workflow is active.
 */
const WorkflowPanelPortal: FC<PropsType> = ({ show }) => {
  return (
    <Container show={show}>
      <Portal id={WorkflowPanelPortalId} />
    </Container>
  );
};

const Container = styled.div<{ show: boolean }>`
  display: ${(p) => (p.show ? "flex" : "none")};
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${(p) => p.theme.sideRailWidth}px;
  flex-direction: column;
  width: ${(p) => p.theme.workflowPanelWidth}px;
  max-width: ${(p) => p.theme.workflowPanelWidth}px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  z-index: ${(p) => p.theme.zPanelFloat || 100};
  background: ${(p) => p.theme.cardOverlay};
  border-right: 1px solid ${(p) => p.theme.border};
  overflow: hidden;
`;

export default WorkflowPanelPortal;
