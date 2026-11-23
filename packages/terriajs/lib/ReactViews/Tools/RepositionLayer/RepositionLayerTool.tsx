import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, useEffect, useRef } from "react";
import styled from "styled-components";
import Cesium3dTilesMixin from "../../../ModelMixins/Cesium3dTilesMixin";
import GltfMixin from "../../../ModelMixins/GltfMixin";
import Repositionable3DTiles from "../../../Models/Repositionable3DTiles";
import RepositionableGltf from "../../../Models/RepositionableGltf";
import Cesium from "../../../Models/Cesium";
import { BaseModel } from "../../../Models/Definition/Model";
import ViewState from "../../../ReactViewModels/ViewState";
import { StyledButton } from "../../../Styled/Button";
import Text from "../../../Styled/Text";

interface Props {
  viewState: ViewState;
  item: BaseModel;
  cesium: Cesium;
}

const RepositionLayerTool: FC<Props> = observer(
  ({ viewState, item, cesium }) => {
    const controllerRef = useRef<{ save(): void; cancel(): void } | undefined>(
      undefined
    );

    const close = action((save: boolean) => {
      if (save) {
        controllerRef.current?.save();
      } else {
        controllerRef.current?.cancel();
      }
      viewState.closeTool();
    });

    useEffect(() => {
      let controller: { save(): void; cancel(): void } | undefined;
      if (Cesium3dTilesMixin.isMixedInto(item)) {
        controller = Repositionable3DTiles.create(item, cesium);
      } else if (GltfMixin.isMixedInto(item)) {
        controller = RepositionableGltf.create(item, cesium);
      }

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
          Reposition layer
        </Text>
        <Text small textLight>
          Drag the box to move or rotate the layer. Press Escape to cancel.
        </Text>
        <Legend>
          <LegendItem>
            <Swatch color="#22d3ee" />
            <span>Vertical edge: spin</span>
          </LegendItem>
          <LegendItem>
            <Swatch color="#facc15" />
            <span>Horizontal edge: tilt</span>
          </LegendItem>
          <LegendItem>
            <Swatch color="#fb923c" />
            <span>Diagonal: free 3D rotation</span>
          </LegendItem>
        </Legend>
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

const Legend = styled.div`
  display: grid;
  gap: 4px;
  margin-top: 8px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${(props) => props.theme.textLight};
  font-size: 12px;
`;

const Swatch = styled.span<{ color: string }>`
  width: 18px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 2px;
  background: ${(props) => props.color};
`;

export default RepositionLayerTool;
