import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import { runInAction } from "mobx";
import Cesium3dTilesMixin from "../../../ModelMixins/Cesium3dTilesMixin";
import GltfMixin from "../../../ModelMixins/GltfMixin";
import Repositionable3DTiles, {
  TransformationSnapshot
} from "../../../Models/Repositionable3DTiles";
import RepositionableGltf from "../../../Models/RepositionableGltf";
import RepositionableI3S from "../../../Models/RepositionableI3S";
import RepositionableComposite, {
  RepositionableCompositeSnapshot
} from "../../../Models/RepositionableComposite";
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
import {
  REPOSITIONABLE_ORIGIN_COLOR,
  REPOSITIONABLE_ORIGINAL_ORIGIN_COLOR
} from "../../../Models/RepositionableBoxDrawing";
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

interface RepositionController {
  save(): void;
  cancel(): void;
  reset(): void;
  restoreToDefault?(): void;
  clampToGround?(): Promise<boolean>;
  getWholeTransformation?(): TransformationSnapshot | undefined;
  setWholeTransformation?(transformation: TransformationSnapshot): void;
  getOriginalOriginPosition?(): Cartesian3 | undefined;
  setOriginalOriginPosition?(position?: Cartesian3): void;
  changeSelectedPiece?(): void;
  refreshSelectedPiece?(): boolean;
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
    const compositeModeRef = useRef(compositeMode);
    compositeModeRef.current = compositeMode;
    const [selectedCompositePart, setSelectedCompositePart] =
      useState<EditableTransformationItem>();
    const [wholeTransformVersion, setWholeTransformVersion] = useState(0);
    const compositeSessionRef = useRef<{
      item: BaseModel;
      snapshots?: RepositionableCompositeSnapshot[];
      initialOriginPosition?: Cartesian3;
    }>({ item });
    const originMarkerItemRef = useRef(item);
    const initialOriginPositionRef = useRef<Cartesian3>();
    const resetInPlaceRef = useRef(false);
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
    const activeEditableItem =
      item instanceof CompositeCatalogItem && compositeMode === "pieces"
        ? selectedCompositePart
        : editableItem;
    const controllerRef = useRef<RepositionController | undefined>(undefined);
    const handlePieceSelected = useCallback((part?: BaseModel) => {
      setSelectedCompositePart(
        part && isEditableTransformationItem(part) ? part : undefined
      );
      setCoordinateStatus("idle");
    }, []);
    const handleWholeTransformationChange = useCallback(() => {
      setWholeTransformVersion((version) => version + 1);
    }, []);
    const wholeCompositeTransformation =
      item instanceof CompositeCatalogItem && compositeMode === "whole"
        ? controllerRef.current?.getWholeTransformation?.()
        : undefined;
    const wholeCompositeLatitude = wholeCompositeTransformation?.latitude;
    const wholeCompositeLongitude = wholeCompositeTransformation?.longitude;
    const wholeCompositeHeight = wholeCompositeTransformation?.height;
    const wholeCompositeHeading = wholeCompositeTransformation?.heading;
    const wholeCompositePitch = wholeCompositeTransformation?.pitch;
    const wholeCompositeRoll = wholeCompositeTransformation?.roll;

    const close = action((save: boolean) => {
      if (save) {
        controllerRef.current?.save();
      } else {
        controllerRef.current?.cancel();
      }
      compositeSessionRef.current = { item };
      initialOriginPositionRef.current = undefined;
      viewState.closeTool();
    });

    const reset = action(() => {
      controllerRef.current?.restoreToDefault?.();
      resetInPlaceRef.current = true;
      setCoordinateStatus("idle");
      setClampStatus("idle");
      setSelectedCompositePart(undefined);
      setWholeTransformVersion((version) => version + 1);
      setControllerGeneration((generation) => generation + 1);
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
      const isWholeComposite =
        item instanceof CompositeCatalogItem && compositeMode === "whole";
      if (!activeEditableItem && !isWholeComposite) return;
      const values = {
        latitude: Number(coordinateDraft.latitude),
        longitude: Number(coordinateDraft.longitude),
        height: Number(coordinateDraft.height),
        heading: Number(coordinateDraft.heading),
        pitch: Number(coordinateDraft.pitch),
        roll: Number(coordinateDraft.roll),
        scale:
          activeEditableItem?.scale === undefined
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

      if (isWholeComposite) {
        controllerRef.current?.setWholeTransformation?.({
          latitude: values.latitude,
          longitude: values.longitude,
          height: values.height,
          heading: values.heading,
          pitch: values.pitch,
          roll: values.roll
        });
        setCoordinateStatus("applied");
        return;
      }

      if (!activeEditableItem) return;
      const isSelectedCompositePart =
        item instanceof CompositeCatalogItem && compositeMode === "pieces";
      if (!isSelectedCompositePart) {
        controllerRef.current?.cancel();
      }
      try {
        runInAction(() => {
          const originResult = updateModelFromJson(
            activeEditableItem.origin,
            CommonStrata.user,
            {
              latitude: values.latitude,
              longitude: values.longitude,
              height: is2D ? activeEditableItem.origin.height : values.height
            }
          );
          if (originResult.error) throw originResult.error;
          const rotationResult = updateModelFromJson(
            activeEditableItem.rotation,
            CommonStrata.user,
            {
              heading: values.heading,
              pitch: is2D ? 0 : values.pitch,
              roll: is2D ? 0 : values.roll
            }
          );
          if (rotationResult.error) throw rotationResult.error;
          if (values.scale !== undefined) {
            activeEditableItem.setTrait(
              CommonStrata.user,
              "scale",
              values.scale
            );
          }
        });
        if (
          isSelectedCompositePart &&
          !controllerRef.current?.refreshSelectedPiece?.()
        ) {
          throw new Error("Unable to refresh the selected composite part.");
        }
      } catch (error) {
        viewState.terria.raiseErrorToUser(error);
        if (!isSelectedCompositePart) {
          setControllerGeneration((generation) => generation + 1);
        }
        return;
      }
      setCoordinateStatus("applied");
      if (!isSelectedCompositePart) {
        setControllerGeneration((generation) => generation + 1);
      }
    });

    useEffect(() => {
      if (
        !activeEditableItem &&
        wholeCompositeLatitude === undefined &&
        wholeCompositeLongitude === undefined &&
        wholeCompositeHeight === undefined &&
        wholeCompositeHeading === undefined &&
        wholeCompositePitch === undefined &&
        wholeCompositeRoll === undefined
      ) {
        return;
      }
      const transformation = activeEditableItem
        ? {
            latitude: activeEditableItem.origin.latitude,
            longitude: activeEditableItem.origin.longitude,
            height: activeEditableItem.origin.height,
            heading: activeEditableItem.rotation.heading,
            pitch: activeEditableItem.rotation.pitch,
            roll: activeEditableItem.rotation.roll,
            scale: activeEditableItem.scale
          }
        : {
            latitude: wholeCompositeLatitude,
            longitude: wholeCompositeLongitude,
            height: wholeCompositeHeight,
            heading: wholeCompositeHeading,
            pitch: wholeCompositePitch,
            roll: wholeCompositeRoll
          };
      if (!transformation) return;
      setCoordinateDraft({
        latitude: formatInputValue(transformation.latitude),
        longitude: formatInputValue(transformation.longitude),
        height: formatInputValue(transformation.height),
        heading: formatInputValue(transformation.heading),
        pitch: formatInputValue(transformation.pitch),
        roll: formatInputValue(transformation.roll),
        scale: formatInputValue(transformation.scale)
      });
    }, [
      activeEditableItem,
      activeEditableItem?.origin.latitude,
      activeEditableItem?.origin.longitude,
      activeEditableItem?.origin.height,
      activeEditableItem?.rotation.heading,
      activeEditableItem?.rotation.pitch,
      activeEditableItem?.rotation.roll,
      activeEditableItem?.scale,
      wholeCompositeLatitude,
      wholeCompositeLongitude,
      wholeCompositeHeight,
      wholeCompositeHeading,
      wholeCompositePitch,
      wholeCompositeRoll,
      wholeTransformVersion,
      controllerGeneration
    ]);

    useEffect(() => {
      if (originMarkerItemRef.current !== item) {
        originMarkerItemRef.current = item;
        initialOriginPositionRef.current = undefined;
        compositeSessionRef.current = { item };
      }

      let controller: RepositionController | undefined;
      if (Cesium3dTilesMixin.isMixedInto(item)) {
        controller = Repositionable3DTiles.create(item, cesium);
      } else if (GltfMixin.isMixedInto(item)) {
        controller = RepositionableGltf.create(item, cesium);
      } else if (item instanceof I3SCatalogItem) {
        controller = RepositionableI3S.create(item, cesium);
      } else if (item instanceof CompositeCatalogItem) {
        if (compositeSessionRef.current.item !== item) {
          compositeSessionRef.current = { item };
        }
        controller = RepositionableComposite.create(
          item,
          cesium,
          compositeMode,
          {
            onPieceSelected: handlePieceSelected,
            onWholeTransformationChange: handleWholeTransformationChange,
            initialSnapshots: compositeSessionRef.current.snapshots,
            initialOriginPosition:
              compositeSessionRef.current.initialOriginPosition
          }
        );
        if (
          controller instanceof RepositionableComposite &&
          compositeSessionRef.current.snapshots === undefined
        ) {
          compositeSessionRef.current.snapshots =
            controller.getInitialSnapshots();
        }
      } else if (item instanceof IonImageryCatalogItem) {
        controller = RepositionableImagery.create(item, cesium);
      }

      controllerRef.current = controller;
      if (controller) {
        const originalOriginPosition =
          initialOriginPositionRef.current ??
          controller.getOriginalOriginPosition?.();
        if (originalOriginPosition) {
          initialOriginPositionRef.current = Cartesian3.clone(
            originalOriginPosition
          );
          controller.setOriginalOriginPosition?.(originalOriginPosition);
          if (item instanceof CompositeCatalogItem) {
            compositeSessionRef.current.initialOriginPosition =
              Cartesian3.clone(originalOriginPosition);
          }
        }
      }
      if (item instanceof CompositeCatalogItem) {
        setWholeTransformVersion((version) => version + 1);
      }
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
        if (resetInPlaceRef.current) {
          resetInPlaceRef.current = false;
          controllerRef.current?.save();
        } else if (
          item instanceof CompositeCatalogItem &&
          compositeModeRef.current !== compositeMode
        ) {
          controllerRef.current?.save();
        } else {
          controllerRef.current?.cancel();
        }
        controllerRef.current = undefined;
      };
    }, [
      item,
      cesium,
      viewState,
      compositeMode,
      controllerGeneration,
      handlePieceSelected,
      handleWholeTransformationChange
    ]);

    const showCoordinateEditor =
      activeEditableItem !== undefined ||
      wholeCompositeTransformation !== undefined;
    const selectingCompositePart =
      item instanceof CompositeCatalogItem &&
      compositeMode === "pieces" &&
      selectedCompositePart === undefined;

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
        {item instanceof CompositeCatalogItem && compositeMode === "pieces" && (
          <PartSelection>
            {selectedCompositePart ? (
              <>
                <Text small textLight>
                  Part selected. Edit its transformation below.
                </Text>
                <StyledButton
                  primary
                  onClick={() => controllerRef.current?.changeSelectedPiece?.()}
                >
                  Change selected part
                </StyledButton>
              </>
            ) : (
              <Text small textLight>
                Click a 3D Tiles part in the scene to select it for editing.
              </Text>
            )}
          </PartSelection>
        )}
        {showCoordinateEditor && (
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
              {activeEditableItem?.scale !== undefined && (
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
          {selectingCompositePart
            ? "Select a composite part by clicking it in the scene."
            : item instanceof IonImageryCatalogItem
              ? "Drag a white face to move the image region."
              : "Drag white faces to move the layer and colored edges to rotate it."}
        </InteractionHint>
        {!(item instanceof IonImageryCatalogItem) && (
          <Legend>
            <LegendItem>
              <OriginSwatch />
              <span>Model origin (0, 0, 0)</span>
            </LegendItem>
            <LegendItem>
              <OriginalOriginSwatch />
              <span>Position when editing started</span>
            </LegendItem>
          </Legend>
        )}
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

const PartSelection = styled.div`
  display: grid;
  gap: 8px;
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

const OriginSwatch = styled.span`
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  border: 2px solid white;
  border-radius: 50%;
  background: ${REPOSITIONABLE_ORIGIN_COLOR.toCssColorString()};
`;

const OriginalOriginSwatch = styled.span`
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 3px solid ${REPOSITIONABLE_ORIGINAL_ORIGIN_COLOR.toCssColorString()};
  border-radius: 50%;
  background: transparent;
`;

const EdgeSwatch = styled.span<{ color: string; diagonal?: boolean }>`
  width: 20px;
  height: 0;
  flex: 0 0 auto;
  border-top: 3px solid ${(props) => props.color};
  transform: ${(props) => (props.diagonal ? "rotate(-35deg)" : "none")};
`;

export default RepositionLayerTool;
