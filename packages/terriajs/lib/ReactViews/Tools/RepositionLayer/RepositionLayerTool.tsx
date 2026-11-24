import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Cesium3dTilesMixin from "../../../ModelMixins/Cesium3dTilesMixin";
import GltfMixin from "../../../ModelMixins/GltfMixin";
import Repositionable3DTiles from "../../../Models/Repositionable3DTiles";
import RepositionableGltf from "../../../Models/RepositionableGltf";
import RepositionableI3S from "../../../Models/RepositionableI3S";
import RepositionableComposite from "../../../Models/RepositionableComposite";
import RepositionableImagery from "../../../Models/RepositionableImagery";
import I3SCatalogItem from "../../../Models/Catalog/CatalogItems/I3SCatalogItem";
import CompositeCatalogItem from "../../../Models/Catalog/CatalogItems/CompositeCatalogItem";
import IonImageryCatalogItem from "../../../Models/Catalog/CatalogItems/IonImageryCatalogItem";
import Cesium from "../../../Models/Cesium";
import { BaseModel } from "../../../Models/Definition/Model";
import ViewState from "../../../ReactViewModels/ViewState";
import ViewerMode from "../../../Models/ViewerMode";
import { StyledButton } from "../../../Styled/Button";
import Text from "../../../Styled/Text";
import Checkbox from "../../../Styled/Checkbox";

interface Props {
  viewState: ViewState;
  item: BaseModel;
  cesium: Cesium;
}

const RepositionLayerTool: FC<Props> = observer(
  ({ viewState, item, cesium }) => {
    const repositionableItem = item as BaseModel & {
      repositionMode?: "2d" | "3d";
    };
    const is2D =
      viewState.terria.mainViewer.viewerMode === ViewerMode.Cesium2D ||
      repositionableItem.repositionMode === "2d";
    const [compositeMode, setCompositeMode] = useState<"whole" | "pieces">(
      "whole"
    );
    const controllerRef = useRef<
      { save(): void; cancel(): void; reset(): void } | undefined
    >(undefined);

    const close = action((save: boolean) => {
      if (save) {
        controllerRef.current?.save();
      } else {
        controllerRef.current?.cancel();
      }
      viewState.closeTool();
    });

    const reset = action(() => {
      controllerRef.current?.reset();
      viewState.closeTool();
    });

    useEffect(() => {
      let controller:
        | { save(): void; cancel(): void; reset(): void }
        | undefined;
      if (Cesium3dTilesMixin.isMixedInto(item)) {
        controller = Repositionable3DTiles.create(item, cesium);
      } else if (GltfMixin.isMixedInto(item)) {
        controller = RepositionableGltf.create(item, cesium);
      } else if (item instanceof I3SCatalogItem) {
        controller = RepositionableI3S.create(item, cesium);
      } else if (item instanceof CompositeCatalogItem) {
        controller = RepositionableComposite.create(
          item,
          cesium,
          compositeMode
        );
      } else if (item instanceof IonImageryCatalogItem) {
        controller = RepositionableImagery.create(item, cesium);
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
    }, [item, cesium, viewState, compositeMode]);

    return (
      <Panel>
        <Text medium bold textLight>
          Reposition layer
        </Text>
        <Text small textLight>
          {is2D
            ? "Move on the map and rotate around the map normal. Press Escape to cancel."
            : "Drag the box to move or rotate the layer. Press Escape to cancel."}
        </Text>
        {item instanceof CompositeCatalogItem &&
          item.memberModels.filter(Cesium3dTilesMixin.isMixedInto).length >
            1 && (
            <ModeControl>
              <Checkbox
                isSwitch
                isChecked={compositeMode === "pieces"}
                onChange={(event) =>
                  setCompositeMode(event.target.checked ? "pieces" : "whole")
                }
              >
                Edit components separately
              </Checkbox>
            </ModeControl>
          )}
        {is2D ? (
          <Legend>
            <LegendItem>
              <AxisSwatch color="#ef4444">X</AxisSwatch>
              <span>East / west translation</span>
            </LegendItem>
            <LegendItem>
              <AxisSwatch color="#22c55e">Y</AxisSwatch>
              <span>North / south translation</span>
            </LegendItem>
            <LegendItem>
              <Swatch color="#38bdf8" />
              <span>Map-normal edge: heading</span>
            </LegendItem>
          </Legend>
        ) : (
          <Legend>
            <LegendItem>
              <AxisSwatch color="#ef4444">X</AxisSwatch>
              <span>East / west translation</span>
            </LegendItem>
            <LegendItem>
              <AxisSwatch color="#22c55e">Y</AxisSwatch>
              <span>North / south translation</span>
            </LegendItem>
            <LegendItem>
              <AxisSwatch color="#38bdf8">Z</AxisSwatch>
              <span>Up / down translation</span>
            </LegendItem>
            <LegendItem>
              <Swatch color="#fb923c" />
              <span>Edges: heading, tilt, and 3D rotation</span>
            </LegendItem>
          </Legend>
        )}
        <Actions>
          <StyledButton onClick={reset}>Reset position</StyledButton>
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

const ModeControl = styled.div`
  margin-top: 10px;
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

const AxisSwatch = styled.span<{ color: string }>`
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid ${(props) => props.color};
  border-radius: 50%;
  color: ${(props) => props.color};
  font-size: 11px;
  font-weight: bold;
  line-height: 16px;
  text-align: center;
`;

export default RepositionLayerTool;
