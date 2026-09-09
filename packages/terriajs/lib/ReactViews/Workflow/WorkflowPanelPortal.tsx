import { FC } from "react";
import styled from "styled-components";
import { Portal } from "../StandardUserInterface/Portal";
import { useViewState } from "../Context";
import { WorkflowPanelPortalId } from "./WorkflowPanel";

type PropsType = {
  show: boolean;
};

/**
 * Host for workflow panels. It takes the docked workbench's slot (same width,
 * same surface) while a workflow is active.
 */
const WorkflowPanelPortal: FC<PropsType> = ({ show }) => {
  const viewState = useViewState();
  return (
    <Container
      show={show}
      onTransitionEnd={() => viewState.triggerResizeEvent()}
    >
      <Portal id={WorkflowPanelPortalId} />
    </Container>
  );
};

const Container = styled.div<{ show: boolean }>`
  display: ${(p) => (p.show ? "flex" : "none")};
  flex-direction: column;
  flex: 0 0 auto;
  width: ${(p) => p.theme.workflowPanelWidth}px;
  max-width: ${(p) => p.theme.workflowPanelWidth}px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  z-index: 100;
  background: ${(p) => p.theme.card};
  border-right: 1px solid ${(p) => p.theme.border};
  overflow: hidden;
`;

export default WorkflowPanelPortal;
