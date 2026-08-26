import i18next from "i18next";
import {
  computed,
  IReactionDisposer,
  observable,
  reaction,
  runInAction
} from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Color from "terriajs-cesium/Source/Core/Color";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import CallbackProperty from "terriajs-cesium/Source/DataSources/CallbackProperty";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineGlowMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty";
import isDefined from "../Core/isDefined";
import DragPoints from "../Map/DragPoints/DragPoints";
import Viewshed3D from "../Map/Cesium/Viewshed3D";
import MappableMixin from "../ModelMixins/MappableMixin";
import ViewState from "../ReactViewModels/ViewState";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import CreateModel from "./Definition/CreateModel";
import MapInteractionMode from "./MapInteractionMode";
import Terria from "./Terria";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import Ray from "terriajs-cesium/Source/Core/Ray";

const BORDER_CIRCLE_ID = "viewshed-area-border";

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

  @observable visibleLinePoints: Cartesian3[] = [];
  @observable hiddenLinePoints: Cartesian3[] = [];

  @observable
  private inDrawMode: boolean;
  private disposePickedFeatureSubscription?: () => void;
  private disposeViewshedHeight?: () => void;
  private disposeViewshedArea?: () => void;
  private viewshed?: Viewshed3D;
  /** Observer position used for the area overlay; frozen while show-area stays on. */
  private areaObserverPosition?: Cartesian3;

  private mouseMoveDispose?: IReactionDisposer;

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
      this.computeLineOfSight();
      // Area overlay stays fixed while show-area is on; only the line follows points.
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

    this.disposeViewshedHeight?.();
    this.disposeViewshedHeight = reaction(
      () => this.terria.viewshedDistances?.[1],
      () => {
        if (this.inDrawMode) {
          this.addMapInteractionMode();
        }
      }
    );

    this.disposeViewshedArea?.();
    this.disposeViewshedArea = reaction(
      () => [
        this.terria.viewshedShowArea,
        this.terria.viewshedAreaDistance,
        this.terria.viewshedObserverHeight
      ],
      () => this.updateViewshedArea()
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
    const that = this;

    // Line will show up once user has drawn some points. Vertices of line are user points.
    this.otherEntities.entities.add({
      name: "Line visible",
      polyline: {
        positions: new CallbackProperty(function () {
          that.computeLineOfSight();
          return that.visibleLinePoints;
        }, false),

        material: new PolylineGlowMaterialProperty({
          color: new Color(0.0, 1.0, 0.0, 0.3),
          glowPower: 0.25
        }),
        width: 20
      }
    });
    this.otherEntities.entities.add({
      name: "Line Invisible",
      polyline: {
        positions: new CallbackProperty(function () {
          return that.hiddenLinePoints;
        }, false),

        material: new PolylineGlowMaterialProperty({
          color: new Color(1.0, 0.0, 0.0, 0.3),
          glowPower: 0.25
        }),
        width: 20
      }
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

    this.computeLineOfSight();
    // Create area once when points become ready; do not retarget it on later point edits.
    if (this.terria.viewshedShowArea && !this.viewshed) {
      this.updateViewshedArea();
    }
  }

  endDrawing() {
    if (this.disposePickedFeatureSubscription) {
      this.disposePickedFeatureSubscription();
    }
    if (this.disposeViewshedHeight) {
      this.disposeViewshedHeight();
      this.disposeViewshedHeight = undefined;
    }
    if (this.disposeViewshedArea) {
      this.disposeViewshedArea();
      this.disposeViewshedArea = undefined;
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
              this.addPointToPointEntities("Target", pickedPoint, false);
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

    this.computeLineOfSight();
    // Destroy area if a required point was removed; otherwise leave it fixed.
    if (this.pointEntities.entities.values.length !== 2) {
      this.destroyViewshedArea();
    }

    return userClickedExistingPoint;
  }

  /**
   * User has finished or cancelled; restore initial state.
   */
  cleanUp() {
    this.destroyViewshedArea();
    this.terria.overlays.remove(this);
    this.pointEntities.entities.removeAll();
    this.otherEntities.entities.removeAll();

    this.terria.allowFeatureInfoRequests = true;

    runInAction(() => {
      this.inDrawMode = false;
    });

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

    if (isDefined(this.mouseMoveDispose)) {
      this.mouseMoveDispose();
    }

    // Allow client to clean up too
    if (typeof this.onCleanUp === "function") {
      this.visibleLinePoints = [];
      this.hiddenLinePoints = [];
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

  private updateAreaBorder(
    observerPosition: Cartesian3,
    maximumDistance: number
  ) {
    const observerCarto = Cartographic.fromCartesian(observerPosition);
    const borderPositions = this.buildCircleBorderPositions(
      observerCarto,
      maximumDistance
    );

    const borderEntity = this.otherEntities.entities.getById(BORDER_CIRCLE_ID);
    if (borderEntity) {
      if (borderEntity.polyline) {
        (borderEntity.polyline.positions as any) = new ConstantProperty(
          borderPositions
        );
      }
      borderEntity.show = true;
    } else {
      this.otherEntities.entities.add({
        id: BORDER_CIRCLE_ID,
        name: "Viewshed Area Border",
        polyline: {
          positions: borderPositions as any,
          clampToGround: true,
          width: 3,
          material: new PolylineGlowMaterialProperty({
            color: Color.YELLOW,
            glowPower: 0.15
          })
        },
        show: true
      });
    }
  }

  private updateViewshedArea() {
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

    if (
      positions.length !== 2 ||
      !this.terria.cesium ||
      !this.terria.viewshedShowArea
    ) {
      this.destroyViewshedArea();
      return;
    }

    // Seed radius once from the current line length if the user has not set one yet.
    // After that, radius is only changed via the panel field — never from point moves.
    if (this.terria.viewshedAreaDistance <= 0) {
      const range = Cartesian3.distance(positions[0], positions[1]);
      if (range <= 1) {
        this.destroyViewshedArea();
        return;
      }
      runInAction(() => {
        this.terria.viewshedAreaDistance = range;
      });
    }

    const maximumDistance = this.terria.viewshedAreaDistance;
    if (maximumDistance <= 0) {
      this.destroyViewshedArea();
      return;
    }

    // Lock origin to the observer at first compute; point drags do not move the area.
    if (!this.areaObserverPosition) {
      const cartoPos0 = Cartographic.fromCartesian(positions[0]);
      if (!cartoPos0) return;
      this.areaObserverPosition = Cartographic.toCartesian(cartoPos0);
    }

    const observerPosition = this.areaObserverPosition;
    const terrainProvider = this.terria.cesium.scene.globe.terrainProvider;

    this.updateAreaBorder(observerPosition, maximumDistance);

    const rendererOptions = {
      terrainProvider,
      observerPosition,
      observerHeight: this.terria.viewshedObserverHeight,
      maximumDistance
    };

    if (this.viewshed) {
      this.viewshed.update(rendererOptions);
    } else {
      this.viewshed = new Viewshed3D(this.terria.cesium.scene, rendererOptions);
    }
  }

  private destroyViewshedArea() {
    this.viewshed?.destroy();
    this.viewshed = undefined;
    this.areaObserverPosition = undefined;
    this.otherEntities.entities.removeById(BORDER_CIRCLE_ID);
  }

  computeLineOfSight() {
    /*const pos = this.pointEntities.entities.values
      .filter((elem) => isDefined(elem.position))
      .map((elem: Entity): Cartesian3 =>
        elem.position.getValue(this.terria.timelineClock.currentTime)
      );*/
    const pos = this.pointEntities.entities.values.flatMap(
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

    if (pos.length !== 2) return [];

    const cartoPos0 = Cartographic.fromCartesian(pos[0]);
    cartoPos0.height = cartoPos0.height + this.terria.viewshedObserverHeight;
    const cartoPos1 = Cartographic.fromCartesian(pos[1]);
    cartoPos1.height = cartoPos1.height + this.terria.viewshedTargetHeight;

    const pos0Updated = Cartographic.toCartesian(cartoPos0);
    const pos1Updated = Cartographic.toCartesian(cartoPos1);

    const direction = Cartesian3.subtract(
      pos1Updated,
      pos0Updated,
      new Cartesian3()
    );

    const ray = new Ray(pos0Updated, direction);
    const intersection = this.terria.cesium?.scene.globe.pick(
      ray,
      this.terria.cesium?.scene
    );

    const oldViewshedDistances = this.terria.viewshedDistances;

    const distOrig = Cartesian3.distance(pos0Updated, pos1Updated);
    const distInter =
      intersection && Cartesian3.distance(pos0Updated, intersection);

    if (
      oldViewshedDistances &&
      distOrig === oldViewshedDistances[0] &&
      distInter === oldViewshedDistances[1]
    ) {
      return;
    }

    const useInter: boolean =
      intersection !== undefined &&
      distInter !== undefined &&
      distInter < distOrig;

    runInAction(() => {
      this.terria.viewshedDistances = [
        distOrig,
        useInter ? distInter : distOrig
      ];
    });
    this.visibleLinePoints = [
      pos0Updated,
      useInter ? intersection! : pos1Updated
    ];
    this.hiddenLinePoints = useInter ? [intersection!, pos1Updated] : [];
  }
}
