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
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidTerrainProvider from "terriajs-cesium/Source/Core/EllipsoidTerrainProvider";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import ImageryLayer from "terriajs-cesium/Source/Scene/ImageryLayer";
import SingleTileImageryProvider from "terriajs-cesium/Source/Scene/SingleTileImageryProvider";

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
  private disposeAreaMode?: IReactionDisposer;
  private disposeAreaParams?: IReactionDisposer;

  private mouseMoveDispose?: IReactionDisposer;

  private areaImageryLayer?: ImageryLayer;
  private areaComputationId = 0;
  private areaRecomputeTimer?: ReturnType<typeof setTimeout>;
  private lastAreaComputeKey?: string;

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
      if (this.terria.viewshedAreaMode) {
        this.scheduleAreaViewshed();
      }
      this.prepareToAddNewPoint();
    });

    this.disposeViewshedHeight = reaction(
      () => this.terria.viewshedDistances?.[1],
      () => {
        this.addMapInteractionMode();
      }
    );

    this.disposeAreaMode = reaction(
      () => this.terria.viewshedAreaMode,
      (areaMode) => {
        if (!this.inDrawMode) return;
        if (areaMode) {
          this.scheduleAreaViewshed();
        } else {
          this.cancelAreaViewshed();
        }
      }
    );

    this.disposeAreaParams = reaction(
      () =>
        [
          this.terria.viewshedAreaRadius,
          this.terria.viewshedObserverHeight,
          this.terria.viewshedTargetHeight
        ] as const,
      () => {
        if (this.inDrawMode && this.terria.viewshedAreaMode) {
          this.scheduleAreaViewshed();
        }
      }
    );
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
    if (this.terria.viewshedAreaMode) {
      this.scheduleAreaViewshed();
    }
  }

  endDrawing() {
    if (this.disposePickedFeatureSubscription) {
      this.disposePickedFeatureSubscription();
    }
    if (this.disposeViewshedHeight) this.disposeViewshedHeight();

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
                this.pointEntities.entities.values.length < this.numMaxPoints)
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

    return userClickedExistingPoint;
  }

  /**
   * User has finished or cancelled; restore initial state.
   */
  cleanUp() {
    this.cancelAreaViewshed();
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
  getButtonText() {
    return defaultValue(
      this.buttonText,
      this.pointEntities.entities.values.length >= 2
        ? i18next.t("models.userDrawing.btnDone")
        : i18next.t("models.userDrawing.btnCancel")
    );
  }

  scheduleAreaViewshed() {
    if (this.areaRecomputeTimer) clearTimeout(this.areaRecomputeTimer);
    this.areaRecomputeTimer = setTimeout(() => {
      this.computeAreaViewshed();
    }, 300);
  }

  cancelAreaViewshed() {
    if (this.areaRecomputeTimer) clearTimeout(this.areaRecomputeTimer);
    this.areaComputationId++;
    this.lastAreaComputeKey = undefined;
    this.removeAreaLayer();
    runInAction(() => {
      this.terria.viewshedAreaComputing = false;
    });
  }

  private removeAreaLayer() {
    if (this.areaImageryLayer && this.terria.cesium) {
      this.terria.cesium.scene.imageryLayers.remove(
        this.areaImageryLayer,
        true
      );
      this.areaImageryLayer = undefined;
      this.terria.currentViewer.notifyRepaintRequired();
    }
  }

  private getObserverCartographic(): Cartographic | undefined {
    const entity = this.pointEntities.entities.values[0];
    const position = entity?.position?.getValue(
      this.terria.timelineClock.currentTime
    );
    return position ? Cartographic.fromCartesian(position) : undefined;
  }

  async computeAreaViewshed() {
    const cesium = this.terria.cesium;
    if (!cesium) return;
    const observer = this.getObserverCartographic();
    if (!observer) return;

    const computeKey = [
      observer.longitude,
      observer.latitude,
      this.terria.viewshedAreaRadius,
      this.terria.viewshedObserverHeight,
      this.terria.viewshedTargetHeight
    ].join(",");
    if (this.areaImageryLayer && computeKey === this.lastAreaComputeKey) {
      return;
    }

    const computationId = ++this.areaComputationId;
    runInAction(() => {
      this.terria.viewshedAreaComputing = true;
    });

    try {
      const radius = Math.max(100, this.terria.viewshedAreaRadius || 0);
      const gridSize = 101;
      const half = (gridSize - 1) / 2;
      const cellSize = (2 * radius) / (gridSize - 1); // metres

      const earthRadius = Ellipsoid.WGS84.maximumRadius;
      const deltaLat = radius / earthRadius;
      const deltaLon =
        radius / (earthRadius * Math.max(0.01, Math.cos(observer.latitude)));
      const north = Math.min(
        observer.latitude + deltaLat,
        CesiumMath.PI_OVER_TWO
      );
      const south = Math.max(
        observer.latitude - deltaLat,
        -CesiumMath.PI_OVER_TWO
      );
      const west = observer.longitude - deltaLon;
      const east = observer.longitude + deltaLon;

      const positions: Cartographic[] = [];
      for (let row = 0; row < gridSize; row++) {
        const lat = north - ((north - south) * row) / (gridSize - 1);
        for (let col = 0; col < gridSize; col++) {
          const lon = west + ((east - west) * col) / (gridSize - 1);
          positions.push(new Cartographic(lon, lat, 0));
        }
      }

      const terrainProvider = cesium.scene.terrainProvider;
      if (!(terrainProvider instanceof EllipsoidTerrainProvider)) {
        await sampleTerrainMostDetailed(terrainProvider, positions);
      }
      if (computationId !== this.areaComputationId) return;

      const heights = positions.map((p) => p.height || 0);
      const observerHeight =
        heights[half * gridSize + half] + this.terria.viewshedObserverHeight;

      const visible = computeViewshedVisibilityGrid({
        heights,
        gridSize,
        cellSize,
        radius,
        observerHeight,
        targetHeight: this.terria.viewshedTargetHeight,
        earthRadius
      });

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = gridSize;
      maskCanvas.height = gridSize;
      const maskContext = maskCanvas.getContext("2d")!;
      const imageData = maskContext.createImageData(gridSize, gridSize);
      for (let i = 0; i < visible.length; i++) {
        if (visible[i] === 1) {
          imageData.data[i * 4] = 0;
          imageData.data[i * 4 + 1] = 200;
          imageData.data[i * 4 + 2] = 255;
          imageData.data[i * 4 + 3] = 140;
        }
      }
      maskContext.putImageData(imageData, 0, 0);

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = 512;
      outputCanvas.height = 512;
      const outputContext = outputCanvas.getContext("2d")!;
      outputContext.imageSmoothingEnabled = true;
      outputContext.drawImage(maskCanvas, 0, 0, 512, 512);

      const provider = await SingleTileImageryProvider.fromUrl(
        outputCanvas.toDataURL("image/png"),
        { rectangle: new Rectangle(west, south, east, north) }
      );
      if (computationId !== this.areaComputationId) return;

      this.removeAreaLayer();
      this.areaImageryLayer =
        cesium.scene.imageryLayers.addImageryProvider(provider);
      this.lastAreaComputeKey = computeKey;
      this.terria.currentViewer.notifyRepaintRequired();
    } catch (error) {
      console.error("Unable to compute the visible-area viewshed:", error);
    } finally {
      if (computationId === this.areaComputationId) {
        runInAction(() => {
          this.terria.viewshedAreaComputing = false;
        });
      }
    }
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

interface ViewshedGridParameters {
  heights: number[];
  gridSize: number;
  cellSize: number;
  radius: number;
  observerHeight: number;
  targetHeight: number;
  earthRadius: number;
}

export function computeViewshedVisibilityGrid(
  params: ViewshedGridParameters
): Uint8Array {
  const {
    heights,
    gridSize,
    cellSize,
    radius,
    observerHeight,
    targetHeight,
    earthRadius
  } = params;
  const half = (gridSize - 1) / 2;
  const curvatureFactor = (1 - 0.13) / (2 * earthRadius);

  const heightAt = (x: number, y: number) => {
    const x0 = Math.min(Math.floor(x), gridSize - 2);
    const y0 = Math.min(Math.floor(y), gridSize - 2);
    const fx = x - x0;
    const fy = y - y0;
    const h00 = heights[y0 * gridSize + x0];
    const h10 = heights[y0 * gridSize + x0 + 1];
    const h01 = heights[(y0 + 1) * gridSize + x0];
    const h11 = heights[(y0 + 1) * gridSize + x0 + 1];
    return (
      h00 * (1 - fx) * (1 - fy) +
      h10 * fx * (1 - fy) +
      h01 * (1 - fx) * fy +
      h11 * fx * fy
    );
  };

  const visible = new Uint8Array(gridSize * gridSize);
  visible[half * gridSize + half] = 1;

  const castRay = (boundaryX: number, boundaryY: number) => {
    const dx = boundaryX - half;
    const dy = boundaryY - half;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) return;
    let maxTan = -Infinity;
    for (let s = 1; s <= steps; s++) {
      const x = half + (dx * s) / steps;
      const y = half + (dy * s) / steps;
      const distance = Math.hypot((x - half) * cellSize, (y - half) * cellSize);
      if (distance > radius) break;
      const height = heightAt(x, y) - distance * distance * curvatureFactor;
      const tanToTarget = (height + targetHeight - observerHeight) / distance;
      if (tanToTarget >= maxTan) {
        visible[Math.round(y) * gridSize + Math.round(x)] = 1;
      }
      const tanToSurface = (height - observerHeight) / distance;
      if (tanToSurface > maxTan) maxTan = tanToSurface;
    }
  };

  for (let i = 0; i < gridSize; i++) {
    castRay(i, 0);
    castRay(i, gridSize - 1);
    castRay(0, i);
    castRay(gridSize - 1, i);
  }

  return visible;
}
