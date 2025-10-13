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
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
import CallbackProperty from "terriajs-cesium/Source/DataSources/CallbackProperty";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import DataSource from "terriajs-cesium/Source/DataSources/DataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineGlowMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty";
import isDefined from "../Core/isDefined";
import DragPoints from "../Map/DragPoints/DragPoints";
import MappableMixin from "../ModelMixins/MappableMixin";
import ViewState from "../ReactViewModels/ViewState";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import CreateModel from "./Definition/CreateModel";
import MapInteractionMode from "./MapInteractionMode";
import Terria from "./Terria";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import Ray from "terriajs-cesium/Source/Core/Ray";

interface OnDrawingCompleteParams {
  points: Cartesian3[];
}

interface Options {
  terria: Terria;
  messageHeader?: string | (() => string);
  numMaxPoints?: number;
  onMakeDialogMessage?: () => string;
  buttonText?: string;
  onPointClicked?: (dataSource: DataSource) => void;
  onPointMoved?: (dataSource: DataSource) => void;
  onDrawingComplete?: (params: OnDrawingCompleteParams) => void;
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
  private readonly onPointClicked?: (dataSource: CustomDataSource) => void;
  private readonly onPointMoved?: (dataSource: CustomDataSource) => void;
  private readonly onDrawingComplete?: (
    params: OnDrawingCompleteParams
  ) => void;
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

  private mousePointEntity?: Entity;
  private mouseMoveDispose?: IReactionDisposer;

  constructor(options: Options) {
    super(createGuid(), options.terria);

    /**
     * Text that appears at the top of the dialog when drawmode is active.
     */
    this.messageHeader = defaultValue(
      options.messageHeader,
      i18next.t("models.userDrawing.messageHeader")
    );

    /**
     * The number of maximum points allowed.
     */
    this.numMaxPoints = defaultValue(options.numMaxPoints, undefined);

    /**
     * Callback that occurs when the dialog is redrawn, to add additional information to dialog.
     */
    this.onMakeDialogMessage = options.onMakeDialogMessage;

    this.buttonText = options.buttonText;

    /**
     * Callback that occurs when point is clicked (may be added or removed). Function takes a CustomDataSource which is
     * a list of PointEntities.
     */
    this.onPointClicked = options.onPointClicked;

    /**
     * Callback that occurs when point is moved. Function takes a CustomDataSource which is a list of PointEntities.
     */
    this.onPointMoved = options.onPointMoved;

    /**
     * Callback that occurs when a drawing is complete. This is called when the
     * user has clicked done button and the shape has at least 1 point.
     * The callback function will receive the points in the shape and a rectangle
     * if `drawRectangle` was set to `true`.
     */
    this.onDrawingComplete = options.onDrawingComplete;

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
    this.dragHelper = new DragPoints(options.terria, (customDataSource) => {
      if (typeof this.onPointMoved === "function") {
        this.getVisiblePointsForShape();
        this.onPointMoved(customDataSource);
      }
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
    var svgDataDeclare = "data:image/svg+xml,";
    var svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    var svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="orange" stroke-width="4" fill="white" /> ';
    var svgSuffix = "</svg>";
    var svgString = svgPrefix + svgCircle + svgSuffix;

    // create the cesium entity
    return svgDataDeclare + svgString;
  }

  get svgTargetPoint() {
    /**
     * SVG element for point drawn when user clicks.
     * http://stackoverflow.com/questions/24869733/how-to-draw-custom-dynamic-billboards-in-cesium-js
     */
    var svgDataDeclare = "data:image/svg+xml,";
    var svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    var svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="purple" stroke-width="4" fill="white" /> ';
    var svgSuffix = "</svg>";
    var svgString = svgPrefix + svgCircle + svgSuffix;

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
    this.otherEntities.entities.add(<any>{
      name: "Line visible",
      polyline: <any>{
        positions: new CallbackProperty(function () {
          that.getVisiblePointsForShape();
          return that.visibleLinePoints;
        }, false),

        material: new PolylineGlowMaterialProperty(<any>{
          color: new Color(0.0, 1.0, 0.0, 0.3),
          glowPower: 0.25
        }),
        width: 20
      }
    });
    this.otherEntities.entities.add(<any>{
      name: "Line Invisible",
      polyline: <any>{
        positions: new CallbackProperty(function () {
          return that.hiddenLinePoints;
        }, false),

        material: new PolylineGlowMaterialProperty(<any>{
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
      async (pickedFeatures, reaction) => {
        if (isDefined(pickedFeatures)) {
          if (isDefined(pickedFeatures.allFeaturesAvailablePromise)) {
            await pickedFeatures.allFeaturesAvailablePromise;
          }
          if (isDefined(pickedFeatures.pickPosition)) {
            const pickedPoint = pickedFeatures.pickPosition;
            this.addPointToPointEntities("First Point", pickedPoint, true);

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
    var pointEntity = new Entity({
      name: name,
      position: new ConstantPositionProperty(position),
      billboard: <any>{
        image: isFirst ? this.svgObserverPoint : this.svgTargetPoint,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        eyeOffset: new Cartesian3(0.0, 0.0, -50.0)
      }
    });
    this.pointEntities.entities.add(pointEntity);
    this.dragHelper.updateDraggableObjects(this.pointEntities);

    this.getVisiblePointsForShape();

    if (isDefined(this.onPointClicked)) {
      this.onPointClicked(this.pointEntities);
    }
  }

  endDrawing() {
    if (this.disposePickedFeatureSubscription) {
      this.disposePickedFeatureSubscription();
    }
    runInAction(() => {
      this.terria.mapInteractionModeStack.pop();
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
        runInAction(() => {
          if (this.onDrawingComplete) {
            const isDrawingComplete =
              this.pointEntities.entities.values.length >= 2;
            const points = this.getPointsForShape();

            if (isDrawingComplete && points) {
              this.onDrawingComplete({
                points
              });
            }
          }
        });
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
      async (pickedFeatures, reaction) => {
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
              this.addPointToPointEntities("Another Point", pickedPoint, false);
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

    const that = this;

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
        // Also let client of UserDrawing know if a point has been removed.
        if (typeof that.onPointClicked === "function") {
          that.onPointClicked(that.pointEntities);
        }
        userClickedExistingPoint = true;
      } else {
        // User clicked on a point that's not the end of the loop. Remove it.
        this.pointEntities.entities.removeById(feature.id);

        // Also let client of UserDrawing know if a point has been removed.
        if (typeof that.onPointClicked === "function") {
          that.onPointClicked(that.pointEntities);
        }
        userClickedExistingPoint = true;
        return;
      }
    });

    this.getVisiblePointsForShape();

    return userClickedExistingPoint;
  }

  /**
   * User has finished or cancelled; restore initial state.
   */
  cleanUp() {
    this.terria.overlays.remove(this);
    //this.pointEntities = new CustomDataSource("Points");
    //this.otherEntities = new CustomDataSource("Lines and polygons");
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

    let innerMessage = isDefined(this.onMakeDialogMessage)
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
  getButtonText() {
    return defaultValue(
      this.buttonText,
      this.pointEntities.entities.values.length >= 2
        ? i18next.t("models.userDrawing.btnDone")
        : i18next.t("models.userDrawing.btnCancel")
    );
  }

  /**
   * Return a list of the coords for the user drawing
   */
  getPointsForShape() {
    if (isDefined(this.pointEntities.entities)) {
      const pos = [];
      for (var i = 0; i < this.pointEntities.entities.values.length; i++) {
        const obj = this.pointEntities.entities.values[i];
        if (isDefined(obj.position)) {
          const position = obj.position.getValue(
            this.terria.timelineClock.currentTime
          );
          pos.push(position);
        }
      }
      return pos;
    }
  }

  getVisiblePointsForShape() {
    const pos = this.pointEntities.entities.values
      .filter((elem) => isDefined(elem.position))
      .map((elem) =>
        elem.position!.getValue(this.terria.timelineClock.currentTime)
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

    const newPos = [pos0Updated];
    const distOrig = Cartesian3.distance(pos0Updated, pos1Updated);
    const distInter =
      intersection && Cartesian3.distance(pos0Updated, intersection);

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
