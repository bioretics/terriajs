import i18next from "i18next";
import { computed, observable, reaction, runInAction } from "mobx";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Color from "terriajs-cesium/Source/Core/Color";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineGlowMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty";
import isDefined from "../Core/isDefined";
import DragPoints from "../Map/DragPoints/DragPoints";
import Viewshed3D from "../Map/Cesium/Viewshed3D";
import type {
  ViewshedStatus,
  VisibilityLineInfo
} from "../Map/Cesium/Viewshed3D";
import MappableMixin from "../ModelMixins/MappableMixin";
import ViewState from "../ReactViewModels/ViewState";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import CreateModel from "./Definition/CreateModel";
import MapInteractionMode from "./MapInteractionMode";
import Terria from "./Terria";
import { createViewshed3DState } from "./Viewshed3DState";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import LabelStyle from "terriajs-cesium/Source/Scene/LabelStyle";
import VerticalOrigin from "terriajs-cesium/Source/Scene/VerticalOrigin";
import HorizontalOrigin from "terriajs-cesium/Source/Scene/HorizontalOrigin";

// Entity IDs for the auxiliary viewshed entities
const BORDER_CIRCLE_ID = "viewshed-border-circle";
const LINE_VISIBLE_ID = "viewshed-line-visible";
const LINE_HIDDEN_ID = "viewshed-line-hidden";
const LINE_LABEL_ID = "viewshed-line-label";

interface Options {
  terria: Terria;
  messageHeader?: string | (() => string);
  numMaxPoints?: number;
  onMakeDialogMessage?: () => string;
  buttonText?: string;
  onCleanUp?: () => void;
  invisible?: boolean;
}

export default class UserDrawingViewshed extends MappableMixin(
  CreateModel(MappableTraits)
) {
  private readonly messageHeader: string | (() => string);
  private readonly numMaxPoints?: number;
  private readonly onMakeDialogMessage?: () => string;
  private readonly buttonText?: string;
  private readonly onCleanUp?: () => void;
  private readonly invisible?: boolean;
  private readonly dragHelper: DragPoints;

  pointEntities: CustomDataSource;
  otherEntities: CustomDataSource;

  @observable
  private inDrawMode: boolean;
  private disposePickedFeatureSubscription?: () => void;
  private disposeViewshedOptions?: () => void;
  private viewshed?: Viewshed3D;

  /** Cached positions of the two user-placed points (observer, target). */
  private lastPositions?: [Cartesian3, Cartesian3];
  /** Latest visibility-line info computed by Viewshed3D. */
  @observable private visibilityLineInfo?: VisibilityLineInfo;

  constructor(options: Options) {
    super(createGuid(), options.terria);

    /**
     * Text that appears at the top of the dialog when drawmode is active.
     */
    this.messageHeader =
      options.messageHeader ??
      i18next.t(($) => $.models.userDrawing.messageHeader);

    /**
     * The number of maximum points allowed.
     */
    this.numMaxPoints = options.numMaxPoints;

    /**
     * Callback that occurs when the dialog is redrawn, to add additional information to dialog.
     */
    this.onMakeDialogMessage = options.onMakeDialogMessage;

    this.buttonText = options.buttonText;

    /**
     * Callback that occurs on clean up, i.e. when drawing is done or cancelled.
     */
    this.onCleanUp = options.onCleanUp;

    /**
     * Storage for points that will be drawn
     */
    this.pointEntities = new CustomDataSource("Points");

    /**
     * Storage for line that connects the points, and polygon if the first and last point are the same
     */
    this.otherEntities = new CustomDataSource("Lines and polygons");

    /**
     * Whether to interpret user clicks as drawing
     */
    this.inDrawMode = false;

    this.invisible = options.invisible;

    // helper for dragging points around
    this.dragHelper = new DragPoints(options.terria, () => {
      this.updateViewshedFromPoints(true);
      this.prepareToAddNewPoint();
    });
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed get mapItems() {
    return [this.pointEntities, this.otherEntities];
  }

  get svgObserverPoint() {
    /**
     * SVG element for point drawn when user clicks.
     * http://stackoverflow.com/questions/24869733/how-to-draw-custom-dynamic-billboards-in-cesium-js
     */
    const svgDataDeclare = "data:image/svg+xml,";
    const svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    const svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="orange" stroke-width="4" fill="white" /> ';
    const svgSuffix = "</svg>";
    const svgString = svgPrefix + svgCircle + svgSuffix;

    // create the cesium entity
    return svgDataDeclare + svgString;
  }

  get svgTargetPoint() {
    /**
     * SVG element for point drawn when user clicks.
     * http://stackoverflow.com/questions/24869733/how-to-draw-custom-dynamic-billboards-in-cesium-js
     */
    const svgDataDeclare = "data:image/svg+xml,";
    const svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    const svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="purple" stroke-width="4" fill="white" /> ';
    const svgSuffix = "</svg>";
    const svgString = svgPrefix + svgCircle + svgSuffix;

    // create the cesium entity
    return svgDataDeclare + svgString;
  }

  enterDrawMode() {
    this.dragHelper.setUp();

    if (this.inDrawMode) {
      // Do nothing
      return;
    }

    runInAction(() => {
      this.inDrawMode = true;
    });

    this.disposeViewshedOptions?.();
    this.disposeViewshedOptions = reaction(
      () => {
        const state = this.terria.viewshed3d;
        return state
          ? [
              state.observerHeight,
              state.maximumDistance,
              state.showBorder,
              state.showLine
            ]
          : undefined;
      },
      () => this.updateViewshedFromPoints(false)
    );

    if (isDefined(this.terria.cesium)) {
      this.terria.cesium.cesiumWidget.canvas.setAttribute(
        "style",
        "cursor: crosshair"
      );
    } else if (isDefined(this.terria.leaflet)) {
      const container = document.getElementById("cesiumContainer");
      if (container !== null) {
        container.setAttribute("style", "cursor: crosshair");
      }
    }

    // Cancel any feature picking already in progress and disable feature info requests.
    runInAction(() => {
      this.terria.pickedFeatures = undefined;
      this.terria.allowFeatureInfoRequests = false;
    });
    this.terria.overlays.add(this);

    // Listen for user clicks on map
    const pickPointMode = this.addMapInteractionMode();
    this.disposePickedFeatureSubscription = reaction(
      () => pickPointMode.pickedFeatures,
      async (pickedFeatures, _previousValue, reaction) => {
        if (isDefined(pickedFeatures)) {
          if (isDefined(pickedFeatures.allFeaturesAvailablePromise)) {
            await pickedFeatures.allFeaturesAvailablePromise;
          }
          if (isDefined(pickedFeatures.pickPosition)) {
            const pickedPoint = pickedFeatures.pickPosition;
            this.addPointToPointEntities("Observer", pickedPoint, true);

            reaction.dispose();
            this.prepareToAddNewPoint();
          }
        }
      }
    );
  }

  /**
   * Add new point to list of pointEntities
   */
  private addPointToPointEntities(
    name: string,
    position: Cartesian3,
    isFirst: boolean
  ) {
    const pointEntity = new Entity({
      name: name,
      position: new ConstantPositionProperty(position),
      billboard: {
        image: isFirst ? this.svgObserverPoint : this.svgTargetPoint,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        eyeOffset: new Cartesian3(0.0, 0.0, -50.0)
      }
    });
    this.pointEntities.entities.add(pointEntity);
    this.dragHelper.updateDraggableObjects(this.pointEntities);

    this.updateViewshedFromPoints(true);
  }

  endDrawing() {
    if (this.disposePickedFeatureSubscription) {
      this.disposePickedFeatureSubscription();
    }
    if (this.disposeViewshedOptions) {
      this.disposeViewshedOptions();
      this.disposeViewshedOptions = undefined;
    }

    runInAction(() => {
      this.terria.mapInteractionModeStack.length = 0;
      this.cleanUp();
    });
  }

  /**
   * Updates the MapInteractionModeStack with a listener for a new point.
   */
  private addMapInteractionMode() {
    const pickPointMode = new MapInteractionMode({
      message: this.getDialogMessage(),
      buttonText: this.getButtonText(),
      onCancel: () => {
        this.endDrawing();
      },
      onEnable: (viewState: ViewState) => {
        runInAction(() => (viewState.explorerPanelIsVisible = false));
      },
      invisible: this.invisible
    });
    runInAction(() => {
      this.terria.mapInteractionModeStack.push(pickPointMode);
    });
    return pickPointMode;
  }

  /**
   * Called after a point has been added, prepares to add and draw another point, as well as updating the dialog.
   */
  private prepareToAddNewPoint() {
    runInAction(() => {
      this.terria.mapInteractionModeStack.pop();
    });

    const pickPointMode = this.addMapInteractionMode();
    this.disposePickedFeatureSubscription = reaction(
      () => pickPointMode.pickedFeatures,
      async (pickedFeatures, _previousValue, reaction) => {
        if (isDefined(pickedFeatures)) {
          if (isDefined(pickedFeatures.allFeaturesAvailablePromise)) {
            await pickedFeatures.allFeaturesAvailablePromise;
          }
          if (isDefined(pickedFeatures.pickPosition)) {
            const pickedPoint = pickedFeatures.pickPosition;

            // If existing point was picked, _clickedExistingPoint handles that, and returns true.
            // getDragCount helps us determine if the point was actually dragged rather than clicked. If it was
            // dragged, we shouldn't treat it as a clicked-existing-point scenario.
            if (
              this.dragHelper.getDragCount() < 10 &&
              !this.clickedExistingPoint(pickedFeatures.features) &&
              (this.numMaxPoints === undefined ||
                this.pointEntities.entities.values.length !== this.numMaxPoints)
            ) {
              // No existing point was picked, so add a new point
              this.addPointToPointEntities("Range", pickedPoint, false);
            } else {
              this.dragHelper.resetDragCount();
            }
            reaction.dispose();

            if (this.inDrawMode) {
              this.prepareToAddNewPoint();
            }
          }
        }
      }
    );
  }

  /**
   * Find out if user clicked an existing point and handle appropriately.
   */
  private clickedExistingPoint(features: Entity[]) {
    let userClickedExistingPoint = false;

    if (features.length < 1) {
      return userClickedExistingPoint;
    }

    features.forEach((feature) => {
      let index = -1;
      for (let i = 0; i < this.pointEntities.entities.values.length; i++) {
        const pointFeature = this.pointEntities.entities.values[i];
        if (pointFeature.id === feature.id) {
          index = i;
          break;
        }
      }

      if (index === -1) {
        // Probably a layer or feature that has nothing to do with what we're drawing.
        return;
      } else if (index === 0) {
        userClickedExistingPoint = true;
      } else {
        // User clicked on a point that's not the end of the loop. Remove it.
        this.pointEntities.entities.removeById(feature.id);
        userClickedExistingPoint = true;
        return;
      }
    });

    this.updateViewshedFromPoints(true);

    return userClickedExistingPoint;
  }

  /**
   * User has finished or cancelled; restore initial state.
   */
  cleanUp() {
    this.destroyViewshed();
    this.terria.overlays.remove(this);
    this.pointEntities.entities.removeAll();
    this.otherEntities.entities.removeAll();

    this.terria.allowFeatureInfoRequests = true;

    runInAction(() => {
      this.inDrawMode = false;
      this.visibilityLineInfo = undefined;
    });
    this.lastPositions = undefined;

    // Return cursor to original state
    if (isDefined(this.terria.cesium)) {
      this.terria.cesium.cesiumWidget.canvas.setAttribute(
        "style",
        "cursor: auto"
      );
    } else if (isDefined(this.terria.leaflet)) {
      const container = document.getElementById("cesiumContainer");
      if (container !== null) {
        container.setAttribute("style", "cursor: auto");
      }
    }

    // Allow client to clean up too
    if (typeof this.onCleanUp === "function") {
      this.onCleanUp();
    }
  }

  getDialogMessage() {
    let message =
      "<strong>" +
      (typeof this.messageHeader === "function"
        ? this.messageHeader()
        : this.messageHeader) +
      "</strong></br>";

    const innerMessage = isDefined(this.onMakeDialogMessage)
      ? this.onMakeDialogMessage()
      : "";

    if (innerMessage !== "") {
      message += innerMessage + "</br>";
    }

    return "<div>" + message + "</div>";
  }

  /**
   * Figure out the text for the dialog button.
   */
  getButtonText(): string {
    return (
      this.buttonText ??
      (this.pointEntities.entities.values.length >= 2
        ? i18next.t(($) => $.models.userDrawing.btnDone)
        : i18next.t(($) => $.models.userDrawing.btnCancel))
    );
  }

  // ---------------------------------------------------------------------------
  // Circle border helper
  // ---------------------------------------------------------------------------

  /**
   * Builds a ring of Cartesian3 positions around the observer at the given
   * radius, suitable for a polyline entity clamped to ground.
   */
  private buildCircleBorderPositions(
    observerCartographic: Cartographic,
    radius: number,
    segments: number = 128
  ): Cartesian3[] {
    const positions: Cartesian3[] = [];
    const lat = observerCartographic.latitude;
    const lon = observerCartographic.longitude;
    const height = observerCartographic.height;

    // Approximate radius in radians on the WGS84 ellipsoid
    const earthRadius = 6378137; // WGS84 semi-major axis
    for (let k = 0; k <= segments; k++) {
      const angle = (k / segments) * 2 * Math.PI;
      const dLat = (radius / earthRadius) * Math.cos(angle);
      const dLon = (radius / (earthRadius * Math.cos(lat))) * Math.sin(angle);
      positions.push(
        Cartographic.toCartesian(
          new Cartographic(lon + dLon, lat + dLat, height)
        )
      );
    }
    return positions;
  }

  // ---------------------------------------------------------------------------
  // Auxiliary entity management (border circle + visibility line)
  // ---------------------------------------------------------------------------

  /**
   * Create or update the border circle, visibility line, and distance label
   * entities in otherEntities.
   */
  private updateAuxiliaryEntities(
    observerPosition: Cartesian3,
    targetPosition: Cartesian3,
    maximumDistance: number,
    showBorder: boolean,
    showLine: boolean
  ) {
    const observerCarto = Cartographic.fromCartesian(observerPosition);

    // ---- Border circle ----
    const borderPositions = this.buildCircleBorderPositions(
      observerCarto,
      maximumDistance
    );

    const borderEntity = this.otherEntities.entities.getById(BORDER_CIRCLE_ID);
    if (borderEntity) {
      // Update existing entity
      if (borderEntity.polyline) {
        (borderEntity.polyline.positions as any) = new ConstantProperty(
          borderPositions
        );
      }
      borderEntity.show = showBorder;
    } else {
      this.otherEntities.entities.add({
        id: BORDER_CIRCLE_ID,
        name: "Viewshed Border",
        polyline: {
          positions: borderPositions as any,
          clampToGround: true,
          width: 3,
          material: new PolylineGlowMaterialProperty({
            color: Color.YELLOW,
            glowPower: 0.15
          })
        },
        show: showBorder
      });
    }

    // ---- Visibility line (green/red segments + label) ----
    this.updateVisibilityLineEntities(
      observerPosition,
      targetPosition,
      showLine
    );
  }

  /**
   * Create or update the green (visible) and red (hidden) line segments and
   * the distance label at the visibility boundary.
   */
  private updateVisibilityLineEntities(
    observerPosition: Cartesian3,
    targetPosition: Cartesian3,
    showLine: boolean
  ) {
    const info = this.visibilityLineInfo;

    // Determine the two segments
    let greenPositions: Cartesian3[];
    let redPositions: Cartesian3[] | undefined;
    let labelPosition: Cartesian3 | undefined;
    let labelText: string = "";

    if (info && info.visibleDistance !== undefined && info.boundaryPosition) {
      // Partial visibility: green up to boundary, red from boundary to target
      greenPositions = [observerPosition, info.boundaryPosition];
      redPositions = [info.boundaryPosition, targetPosition];
      labelPosition = info.boundaryPosition;
      labelText = `${Math.round(info.visibleDistance)} m`;
    } else {
      // Fully visible (or no info yet): entire line is green
      greenPositions = [observerPosition, targetPosition];
      redPositions = undefined;
      labelPosition = undefined;
    }

    // --- Green (visible) segment ---
    const greenEntity = this.otherEntities.entities.getById(LINE_VISIBLE_ID);
    if (greenEntity) {
      if (greenEntity.polyline) {
        (greenEntity.polyline.positions as any) = new ConstantProperty(
          greenPositions
        );
      }
      greenEntity.show = showLine;
    } else {
      this.otherEntities.entities.add({
        id: LINE_VISIBLE_ID,
        name: "Visible segment",
        polyline: {
          positions: greenPositions as any,
          clampToGround: true,
          width: 4,
          material: new PolylineGlowMaterialProperty({
            color: Color.LIME,
            glowPower: 0.15
          })
        },
        show: showLine
      });
    }

    // --- Red (hidden) segment ---
    const redEntity = this.otherEntities.entities.getById(LINE_HIDDEN_ID);
    if (redPositions) {
      if (redEntity) {
        if (redEntity.polyline) {
          (redEntity.polyline.positions as any) = new ConstantProperty(
            redPositions
          );
        }
        redEntity.show = showLine;
      } else {
        this.otherEntities.entities.add({
          id: LINE_HIDDEN_ID,
          name: "Hidden segment",
          polyline: {
            positions: redPositions as any,
            clampToGround: true,
            width: 4,
            material: new PolylineGlowMaterialProperty({
              color: Color.RED,
              glowPower: 0.15
            })
          },
          show: showLine
        });
      }
    } else if (redEntity) {
      // No hidden segment needed; hide existing
      redEntity.show = false;
    }

    // --- Distance label at the boundary ---
    const labelEntity = this.otherEntities.entities.getById(LINE_LABEL_ID);
    if (labelPosition && labelText) {
      if (labelEntity) {
        (labelEntity.position as any) = new ConstantPositionProperty(
          labelPosition
        );
        if (labelEntity.label) {
          (labelEntity.label.text as any) = new ConstantProperty(labelText);
        }
        labelEntity.show = showLine;
      } else {
        this.otherEntities.entities.add({
          id: LINE_LABEL_ID,
          name: "Visible distance",
          position: new ConstantPositionProperty(labelPosition) as any,
          label: {
            text: labelText as any,
            font: "14px sans-serif",
            style: LabelStyle.FILL_AND_OUTLINE,
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 3,
            heightReference: HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            pixelOffset: new Cartesian2(0, -16),
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER
          },
          show: showLine
        });
      }
    } else if (labelEntity) {
      // Entire ray visible — hide the label
      labelEntity.show = false;
    }
  }

  /**
   * Remove all auxiliary entities (border + line + label).
   */
  private removeAuxiliaryEntities() {
    this.otherEntities.entities.removeById(BORDER_CIRCLE_ID);
    this.otherEntities.entities.removeById(LINE_VISIBLE_ID);
    this.otherEntities.entities.removeById(LINE_HIDDEN_ID);
    this.otherEntities.entities.removeById(LINE_LABEL_ID);
  }

  // ---------------------------------------------------------------------------
  // Main viewshed update
  // ---------------------------------------------------------------------------

  private updateViewshedFromPoints(syncMaximumDistance: boolean) {
    const positions = this.pointEntities.entities.values.flatMap(
      (elem): Cartesian3[] => {
        if (elem.position) {
          const val = elem.position.getValue(
            this.terria.timelineClock.currentTime
          );
          if (val) return [val];
        }
        return [];
      }
    );

    if (positions.length !== 2 || !this.terria.cesium) {
      this.destroyViewshed();
      return;
    }

    const existingState = this.terria.viewshed3d;
    const cartoPos0 = Cartographic.fromCartesian(positions[0]);
    if (!cartoPos0) return;

    // Radius is the ground distance to the second point; only the observer is
    // raised for the visibility origin.
    const range = Cartesian3.distance(positions[0], positions[1]);
    if (range <= 1) return;

    // Keep observerPosition at ground level; observerHeight is passed
    // separately to the Viewshed3D renderer so the terrain grid is centred
    // correctly and the height offset is applied in the viewshed calculation.
    const observerPosition = Cartographic.toCartesian(cartoPos0);

    const state = existingState ?? createViewshed3DState(range);

    runInAction(() => {
      if (!existingState) this.terria.viewshed3d = state;
      if (syncMaximumDistance) {
        state.maximumDistance = range;
      }
    });

    // Cache positions for auxiliary entity updates
    this.lastPositions = [positions[0], positions[1]];

    const terrainProvider = this.terria.cesium.scene.globe.terrainProvider;

    const rendererOptions = {
      terrainProvider,
      observerPosition,
      observerHeight: state.observerHeight,
      maximumDistance: state.maximumDistance,
      targetPosition: positions[1],
      onStatusChange: (status: ViewshedStatus) => {
        if (this.terria.viewshed3d !== state) return;
        runInAction(() => {
          state.terrainStatus = status;
        });
      },
      onVisibilityLineComputed: (info: VisibilityLineInfo) => {
        runInAction(() => {
          this.visibilityLineInfo = info;
        });
        // Update the line entities with the new info
        if (this.lastPositions) {
          this.updateVisibilityLineEntities(
            this.lastPositions[0],
            this.lastPositions[1],
            state.showLine
          );
        }
      }
    };

    // Create / update auxiliary entities (border + line)
    this.updateAuxiliaryEntities(
      observerPosition,
      positions[1],
      state.maximumDistance,
      state.showBorder,
      state.showLine
    );

    if (this.viewshed) {
      this.viewshed.update(rendererOptions);
    } else {
      this.viewshed = new Viewshed3D(this.terria.cesium.scene, rendererOptions);
    }
  }

  private destroyViewshed() {
    this.viewshed?.destroy();
    this.viewshed = undefined;
    this.removeAuxiliaryEntities();
    this.lastPositions = undefined;
    runInAction(() => {
      this.terria.viewshed3d = undefined;
      this.visibilityLineInfo = undefined;
    });
  }
}
