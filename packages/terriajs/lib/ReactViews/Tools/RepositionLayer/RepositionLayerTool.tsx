import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { runInAction } from "mobx";
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
import FileSaver from "file-saver";
import { exportRepositionableCatalog } from "../../../Models/RepositionableCatalogExport";
import { REPOSITIONABLE_BOX_DRAWING_STYLE } from "../../../Models/createRepositionableBoxDrawing";
import CommonStrata from "../../../Models/Definition/CommonStrata";
import updateModelFromJson from "../../../Models/Definition/updateModelFromJson";
import { StyledInput } from "../../../Styled/Input";

type EditableTransformationItem = BaseModel & {
  origin: BaseModel & {
    latitude?: number;
    longitude?: number;
    height?: number;
  };
  rotation: BaseModel & {
    heading?: number;
    pitch?: number;
    roll?: number;
  };
  scale?: number;
};

function isEditableTransformationItem(
  item: BaseModel
): item is EditableTransformationItem {
  return (
    Cesium3dTilesMixin.isMixedInto(item) ||
    GltfMixin.isMixedInto(item) ||
    item instanceof I3SCatalogItem
  );
}

function formatInputValue(value: number | undefined): string {
  return value === undefined ? "0" : String(value);
}

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
    const [clampStatus, setClampStatus] = useState<
      "idle" | "working" | "success" | "unavailable"
    >("idle");
    const [controllerGeneration, setControllerGeneration] = useState(0);
    const [coordinateDraft, setCoordinateDraft] = useState({
      latitude: formatInputValue(
        isEditableTransformationItem(item) ? item.origin.latitude : undefined
      ),
      longitude: formatInputValue(
        isEditableTransformationItem(item) ? item.origin.longitude : undefined
      ),
      height: formatInputValue(
        isEditableTransformationItem(item) ? item.origin.height : undefined
      ),
      heading: formatInputValue(
        isEditableTransformationItem(item) ? item.rotation.heading : undefined
      ),
      pitch: formatInputValue(
        isEditableTransformationItem(item) ? item.rotation.pitch : undefined
      ),
      roll: formatInputValue(
        isEditableTransformationItem(item) ? item.rotation.roll : undefined
      ),
      scale: formatInputValue(
        isEditableTransformationItem(item) ? item.scale : undefined
      )
    });
    const [coordinateStatus, setCoordinateStatus] = useState<
      "idle" | "invalid" | "applied"
    >("idle");
    const editableItem = isEditableTransformationItem(item) ? item : undefined;
    const controllerRef = useRef<
      | {
          save(): void;
          cancel(): void;
          reset(): void;
          clampToGround?(): Promise<boolean>;
        }
      | undefined
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

    const clampToGround = action(async () => {
      setClampStatus("working");
      const controller = controllerRef.current;
      const success =
        controller?.clampToGround !== undefined
          ? await controller.clampToGround()
          : false;
      setClampStatus(success ? "success" : "unavailable");
    });

    const exportCatalog = action(() => {
      try {
        const exported = exportRepositionableCatalog(item);
        FileSaver.saveAs(exported.blob, exported.filename);
      } catch (error) {
        viewState.terria.raiseErrorToUser(error);
      }
    });

    const applyCoordinates = action(() => {
      if (!editableItem) return;
      const values = {
        latitude: Number(coordinateDraft.latitude),
        longitude: Number(coordinateDraft.longitude),
        height: Number(coordinateDraft.height),
        heading: Number(coordinateDraft.heading),
        pitch: Number(coordinateDraft.pitch),
        roll: Number(coordinateDraft.roll),
        scale:
          editableItem.scale === undefined
            ? undefined
            : Number(coordinateDraft.scale)
      };
      if (
        Object.values(values).some(
          (value) => value !== undefined && !Number.isFinite(value)
        ) ||
        values.latitude < -90 ||
        values.latitude > 90 ||
        values.longitude < -180 ||
        values.longitude > 180 ||
        (values.scale !== undefined && values.scale <= 0)
      ) {
        setCoordinateStatus("invalid");
        return;
      }

      controllerRef.current?.cancel();
      try {
        runInAction(() => {
          const originResult = updateModelFromJson(
            editableItem.origin,
            CommonStrata.user,
            {
              latitude: values.latitude,
              longitude: values.longitude,
              height: is2D ? editableItem.origin.height : values.height
            }
          );
          if (originResult.error) throw originResult.error;
          const rotationResult = updateModelFromJson(
            editableItem.rotation,
            CommonStrata.user,
            {
              heading: values.heading,
              pitch: is2D ? 0 : values.pitch,
              roll: is2D ? 0 : values.roll
            }
          );
          if (rotationResult.error) throw rotationResult.error;
          if (values.scale !== undefined) {
            editableItem.setTrait(CommonStrata.user, "scale", values.scale);
          }
        });
      } catch (error) {
        viewState.terria.raiseErrorToUser(error);
        setControllerGeneration((generation) => generation + 1);
        return;
      }
      setCoordinateStatus("applied");
      setControllerGeneration((generation) => generation + 1);
    });

    useEffect(() => {
      if (!editableItem) return;
      setCoordinateDraft({
        latitude: formatInputValue(editableItem.origin.latitude),
        longitude: formatInputValue(editableItem.origin.longitude),
        height: formatInputValue(editableItem.origin.height),
        heading: formatInputValue(editableItem.rotation.heading),
        pitch: formatInputValue(editableItem.rotation.pitch),
        roll: formatInputValue(editableItem.rotation.roll),
        scale: formatInputValue(editableItem.scale)
      });
    }, [
      editableItem,
      editableItem?.origin.latitude,
      editableItem?.origin.longitude,
      editableItem?.origin.height,
      editableItem?.rotation.heading,
      editableItem?.rotation.pitch,
      editableItem?.rotation.roll,
      editableItem?.scale
    ]);

    useEffect(() => {
      let controller:
        | {
            save(): void;
            cancel(): void;
            reset(): void;
            clampToGround?(): Promise<boolean>;
          }
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
    }, [item, cesium, viewState, compositeMode, controllerGeneration]);

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
        {editableItem && (
          <CoordinateEditor>
            <SectionTitle>Position and orientation</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel htmlFor="reposition-latitude">
                  Latitude (°)
                </FieldLabel>
                <StyledInput
                  id="reposition-latitude"
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  value={coordinateDraft.latitude}
                  onChange={(event) => {
                    setCoordinateDraft({
                      ...coordinateDraft,
                      latitude: event.target.value
                    });
                    setCoordinateStatus("idle");
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reposition-longitude">
                  Longitude (°)
                </FieldLabel>
                <StyledInput
                  id="reposition-longitude"
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  value={coordinateDraft.longitude}
                  onChange={(event) => {
                    setCoordinateDraft({
                      ...coordinateDraft,
                      longitude: event.target.value
                    });
                    setCoordinateStatus("idle");
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reposition-height">Height (m)</FieldLabel>
                <StyledInput
                  id="reposition-height"
                  type="number"
                  step="any"
                  disabled={is2D}
                  value={coordinateDraft.height}
                  onChange={(event) => {
                    setCoordinateDraft({
                      ...coordinateDraft,
                      height: event.target.value
                    });
                    setCoordinateStatus("idle");
                  }}
                />
              </Field>
              {editableItem.scale !== undefined && (
                <Field>
                  <FieldLabel htmlFor="reposition-scale">Scale</FieldLabel>
                  <StyledInput
                    id="reposition-scale"
                    type="number"
                    min="0"
                    step="any"
                    value={coordinateDraft.scale}
                    onChange={(event) => {
                      setCoordinateDraft({
                        ...coordinateDraft,
                        scale: event.target.value
                      });
                      setCoordinateStatus("idle");
                    }}
                  />
                </Field>
              )}
            </FieldGrid>
            <SectionTitle>Rotation</SectionTitle>
            <FieldGrid>
              <Field>
                <FieldLabel htmlFor="reposition-heading">
                  Heading (°)
                </FieldLabel>
                <StyledInput
                  id="reposition-heading"
                  type="number"
                  step="any"
                  value={coordinateDraft.heading}
                  onChange={(event) => {
                    setCoordinateDraft({
                      ...coordinateDraft,
                      heading: event.target.value
                    });
                    setCoordinateStatus("idle");
                  }}
                />
              </Field>
              {!is2D && (
                <>
                  <Field>
                    <FieldLabel htmlFor="reposition-pitch">
                      Pitch (°)
                    </FieldLabel>
                    <StyledInput
                      id="reposition-pitch"
                      type="number"
                      step="any"
                      value={coordinateDraft.pitch}
                      onChange={(event) => {
                        setCoordinateDraft({
                          ...coordinateDraft,
                          pitch: event.target.value
                        });
                        setCoordinateStatus("idle");
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="reposition-roll">Roll (°)</FieldLabel>
                    <StyledInput
                      id="reposition-roll"
                      type="number"
                      step="any"
                      value={coordinateDraft.roll}
                      onChange={(event) => {
                        setCoordinateDraft({
                          ...coordinateDraft,
                          roll: event.target.value
                        });
                        setCoordinateStatus("idle");
                      }}
                    />
                  </Field>
                </>
              )}
            </FieldGrid>
            <ApplyButton primary onClick={applyCoordinates}>
              Apply values
            </ApplyButton>
            {coordinateStatus === "invalid" && (
              <ClampStatus>
                Enter valid coordinates and numeric transformation values.
              </ClampStatus>
            )}
            {coordinateStatus === "applied" && (
              <ClampStatus>Values applied to the layer.</ClampStatus>
            )}
          </CoordinateEditor>
        )}
        <InteractionHint>
          {item instanceof IonImageryCatalogItem
            ? "Drag a white face to move the image region."
            : "Drag white faces to move the layer and colored edges to rotate it."}
        </InteractionHint>
        {is2D ? (
          <Legend>
            <LegendItem>
              <FaceSwatch />
              <span>Side faces: move along the ground/surface</span>
            </LegendItem>
            {!(item instanceof IonImageryCatalogItem) && (
              <LegendItem>
                <EdgeSwatch
                  color={REPOSITIONABLE_BOX_DRAWING_STYLE.verticalEdgeColor.toCssColorString()}
                />
                <span>Vertical cyan edge: rotate heading</span>
              </LegendItem>
            )}
            <LegendItem>
              <DisabledFaceSwatch />
              <span>Top/bottom faces: disabled in 2D</span>
            </LegendItem>
          </Legend>
        ) : (
          <Legend>
            <LegendItem>
              <FaceSwatch />
              <span>Side faces: move along the ground/surface</span>
            </LegendItem>
            <LegendItem>
              <FaceSwatch />
              <span>Top/bottom faces: move along box Z</span>
            </LegendItem>
            <LegendItem>
              <EdgeSwatch
                color={REPOSITIONABLE_BOX_DRAWING_STYLE.verticalEdgeColor.toCssColorString()}
              />
              <span>Vertical cyan edge: heading</span>
            </LegendItem>
            <LegendItem>
              <EdgeSwatch
                color={REPOSITIONABLE_BOX_DRAWING_STYLE.horizontalEdgeColor.toCssColorString()}
              />
              <span>Horizontal yellow edge: tilt</span>
            </LegendItem>
            <LegendItem>
              <EdgeSwatch
                color={REPOSITIONABLE_BOX_DRAWING_STYLE.freeEdgeColor.toCssColorString()}
                diagonal
              />
              <span>Diagonal orange edge: free 3D rotation</span>
            </LegendItem>
          </Legend>
        )}
        <Actions>
          {!is2D && (
            <StyledButton
              primary
              disabled={clampStatus === "working"}
              onClick={clampToGround}
            >
              {clampStatus === "working"
                ? "Clamping..."
                : clampStatus === "success"
                  ? "Ground clamped"
                  : "Clamp to ground"}
            </StyledButton>
          )}
          <StyledButton primary onClick={reset}>
            Reset position
          </StyledButton>
          <StyledButton primary onClick={exportCatalog}>
            Export catalog
          </StyledButton>
          <StyledButton primary onClick={() => close(false)}>
            Cancel
          </StyledButton>
          <StyledButton primary onClick={() => close(true)}>
            Save
          </StyledButton>
        </Actions>
        {clampStatus === "unavailable" && (
          <ClampStatus>Ground height is unavailable</ClampStatus>
        )}
      </Panel>
    );
  }
);

const Panel = styled.div`
  position: fixed;
  right: 16px;
  top: 72px;
  z-index: 1000;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 88px);
  overflow: auto;
  padding: 16px;
  border-radius: 4px;
  background: ${(props) => props.theme.darkWithOverlay};
  pointer-events: auto;
`;

const CoordinateEditor = styled.div`
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid ${(props) => props.theme.grey};
`;

const SectionTitle = styled.div`
  margin: 10px 0 8px;
  color: ${(props) => props.theme.textLight};
  font-size: 13px;
  font-weight: 600;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

const Field = styled.div`
  min-width: 0;
`;

const FieldLabel = styled.label`
  display: block;
  margin-bottom: 4px;
  color: ${(props) => props.theme.textLight};
  font-size: 12px;
`;

const ApplyButton = styled(StyledButton)`
  margin-top: 10px;
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

const ClampStatus = styled.div`
  margin-top: 8px;
  color: ${(props) => props.theme.textLight};
  font-size: 12px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${(props) => props.theme.textLight};
  font-size: 12px;
`;

const InteractionHint = styled.div`
  margin-top: 10px;
  color: ${(props) => props.theme.textLight};
  font-size: 12px;
`;

const FaceSwatch = styled.span`
  width: 18px;
  height: 14px;
  flex: 0 0 auto;
  border: ${REPOSITIONABLE_BOX_DRAWING_STYLE.sideOutlineWidth}px solid
    ${REPOSITIONABLE_BOX_DRAWING_STYLE.sideOutlineColor.toCssColorString()};
  background: ${REPOSITIONABLE_BOX_DRAWING_STYLE.sideFillColor.toCssColorString()};
`;

const DisabledFaceSwatch = styled(FaceSwatch)`
  opacity: 0.35;
`;

const EdgeSwatch = styled.span<{ color: string; diagonal?: boolean }>`
  width: 20px;
  height: 0;
  flex: 0 0 auto;
  border-top: 3px solid ${(props) => props.color};
  transform: ${(props) => (props.diagonal ? "rotate(-35deg)" : "none")};
`;

export default RepositionLayerTool;
