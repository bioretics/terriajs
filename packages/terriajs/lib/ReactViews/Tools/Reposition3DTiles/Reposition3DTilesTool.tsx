import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, useEffect, useRef } from "react";
import styled from "styled-components";
import Cesium3dTilesMixin from "../../../ModelMixins/Cesium3dTilesMixin";
import Repositionable3DTiles from "../../../Models/Repositionable3DTiles";
import Cesium from "../../../Models/Cesium";
import ViewState from "../../../ReactViewModels/ViewState";
import { StyledButton } from "../../../Styled/Button";
import Text from "../../../Styled/Text";

interface Props {
  viewState: ViewState;
  item: Cesium3dTilesMixin.Instance;
  cesium: Cesium;
}

const Reposition3DTilesTool: FC<Props> = observer(
  ({ viewState, item, cesium }) => {
    const controllerRef = useRef<Repositionable3DTiles | undefined>(undefined);

    const close = action((save: boolean) => {
      if (save) {
        controllerRef.current?.save();
      } else {
        controllerRef.current?.cancel();
      }
      viewState.closeTool();
    });

    useEffect(() => {
      const controller = Repositionable3DTiles.create(item, cesium);
      controllerRef.current = controller;
      if (!controller) {
        viewState.closeTool();
      }

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          controllerRef.current?.cancel();
          viewState.closeTool();
        }
      };
      document.addEventListener("keydown", onKeyDown);

      return () => {
        document.removeEventListener("keydown", onKeyDown);
        controllerRef.current?.cancel();
        controllerRef.current = undefined;
      };
    }, [item, cesium, viewState]);

    return (
      <Panel>
        <Text medium bold textLight>
          Reposition 3D tiles
        </Text>
        <Text small textLight>
          Drag the box to move or rotate the layer. Press Escape to cancel.
        </Text>
        <Actions>
          <StyledButton onClick={() => close(false)}>Cancel</StyledButton>
          <StyledButton primary onClick={() => close(true)}>
            Save
          </StyledButton>
        </Actions>
      </Panel>
    );
  }
);

const Panel = styled.div`
  position: fixed;
  left: 50%;
  top: 52px;
  transform: translateX(-50%);
  z-index: 1000;
  min-width: 300px;
  padding: 12px;
  border-radius: 4px;
  background: ${(props) => props.theme.darkWithOverlay};
  pointer-events: auto;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
`;

export default Reposition3DTilesTool;
