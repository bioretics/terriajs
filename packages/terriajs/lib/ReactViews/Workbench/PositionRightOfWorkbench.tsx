import { observer } from "mobx-react";
import { FC } from "react";
import styled from "styled-components";
import ViewState from "../../ReactViewModels/ViewState";

type PositionRightOfWorkbenchProps = {
  viewState: ViewState;
  className?: string;
  children: React.ReactNode;
};

/**
 * A component that responsively positions its children right of the workbench.
 *
 * If the workbench is hidden it will smoothly transition the children to the left edge
 * of the screen. By default the container is position 120px from the top but
 * this can be overriden by further styling the component, eg:
 *
 *    const BottomLeft = styled(PositionRightOfWorkbenchProps)`
 *       top: unset;
 *       bottom: 90px;
 *    `;
 *
 */
const PositionRightOfWorkbench: FC<PositionRightOfWorkbenchProps> = observer(
  (props) => {
    return (
      <Container
        className={props.className}
        isMapFullScreen={props.viewState.isMapFullScreen}
      >
        {props.children}
      </Container>
    );
  }
);

const Container = styled.div<{ isMapFullScreen: boolean }>`
  position: absolute;
  top: 110px;
  left: 0;
  right: unset;
  bottom: unset;
  // Right of the side rail and of the docked workbench (when open).
  margin-left: ${(props) =>
    Number(props.theme.sideRailWidth) +
    (props.isMapFullScreen ? 0 : parseInt(props.theme.workbenchWidth, 10)) +
    Number(props.theme.workbenchMargin)}px;
  transition: margin-left 0.25s;
`;

export default PositionRightOfWorkbench;
