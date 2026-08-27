import i18next from "i18next";
import {
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction
} from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Color from "terriajs-cesium/Source/Core/Color";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineGlowMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import isDefined from "../Core/isDefined";
import DragPoints from "../Map/DragPoints/DragPoints";
import Viewshed3D from "../Map/Cesium/Viewshed3D";
import MappableMixin, { ImageryParts } from "../ModelMixins/MappableMixin";
import ViewState from "../ReactViewModels/ViewState";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import CreateModel from "./Definition/CreateModel";
import MapInteractionMode from "./MapInteractionMode";
import Terria from "./Terria";

const BORDER_CIRCLE_ID = "viewshed-area-border";

interface Options {
  terria: Terria;
  messageHeader?: string | (() => string);
  onCleanUp?: () => void;
  invisible?: boolean;
}

export default class UserDrawingViewshedArea extends MappableMixin(
  CreateModel(MappableTraits)
) {
  private readonly messageHeader: string | (() => string);
  private readonly onCleanUp?: () => void;
  private readonly invisible?: boolean;
  private readonly dragHelper: DragPoints;

  pointEntities: CustomDataSource;
  otherEntities: CustomDataSource;

  @observable
  private inDrawMode: boolean;
  private disposePickedFeatureSubscription?: () => void;
  private disposeViewshedArea?: () => void;
  private viewshed?: Viewshed3D;
  /** Fresh ImageryParts instance whenever viewshed compute finishes (drives mapItems). */
  @observable.ref private areaImagery?: ImageryParts;
  private ownedInteractionModes: MapInteractionMode[] = [];

  constructor(options: Options) {
    super(createGuid(), options.terria);
    makeObservable(this);

    this.messageHeader =
      options.messageHeader ?? i18next.t(($) => $.viewshed.areaMessageHeader);

    this.onCleanUp = options.onCleanUp;
    this.pointEntities = new CustomDataSource("ViewshedAreaPoints");
    this.otherEntities = new CustomDataSource("ViewshedAreaOther");
    this.inDrawMode = false;
    this.invisible = options.invisible;

    this.dragHelper = new DragPoints(options.terria, () => {
      this.updateViewshedArea();
      this.prepareToAddNewPoint();
    });
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed get mapItems() {
    return this.areaImagery
      ? [this.pointEntities, this.otherEntities, this.areaImagery]
      : [this.pointEntities, this.otherEntities];
  }

  get svgObserverPoint() {
    const svgDataDeclare = "data:image/svg+xml,";
    const svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    const svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="orange" stroke-width="4" fill="white" /> ';
    const svgSuffix = "</svg>";
    return svgDataDeclare + svgPrefix + svgCircle + svgSuffix;
  }

  enterDrawMode() {
    this.dragHelper.setUp();

    if (this.inDrawMode) {
      return;
    }

    runInAction(() => {
      this.inDrawMode = true;
    });

    this.disposeViewshedArea?.();
    this.disposeViewshedArea = reaction(
      () => [
        this.terria.viewshedAreaDistance,
        this.terria.viewshedAreaObserverHeight
      ],
      () => this.updateViewshedArea()
    );

    if (isDefined(this.terria.cesium)) {
      this.terria.cesium.cesiumWidget.canvas.setAttribute(
        "style",
        "cursor: crosshair"
      );
    }

    runInAction(() => {
      this.terria.pickedFeatures = undefined;
      this.terria.allowFeatureInfoRequests = false;
    });

    this.terria.overlays.add(this);

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
            this.addOrReplaceObserver(pickedPoint);
            reaction.dispose();
            this.prepareToAddNewPoint();
          }
        }
      }
    );
  }

  private addOrReplaceObserver(position: Cartesian3) {
    this.pointEntities.entities.removeAll();
    const pointEntity = new Entity({
      name: "Observer",
      position: new ConstantPositionProperty(position),
      billboard: {
        image: this.svgObserverPoint,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        eyeOffset: new Cartesian3(0.0, 0.0, -50.0)
      }
    });
    this.pointEntities.entities.add(pointEntity);
    this.dragHelper.updateDraggableObjects(this.pointEntities);
    this.updateViewshedArea();
  }

  endDrawing() {
    if (this.disposePickedFeatureSubscription) {
      this.disposePickedFeatureSubscription();
    }
    if (this.disposeViewshedArea) {
      this.disposeViewshedArea();
      this.disposeViewshedArea = undefined;
    }

    runInAction(() => {
      this.removeOwnedInteractionModes();
      this.cleanUp();
    });
  }

  private removeOwnedInteractionModes() {
    for (const mode of this.ownedInteractionModes) {
      const idx = this.terria.mapInteractionModeStack.indexOf(mode);
      if (idx >= 0) {
        this.terria.mapInteractionModeStack.splice(idx, 1);
      }
    }
    this.ownedInteractionModes = [];
  }

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
      this.ownedInteractionModes.push(pickPointMode);
    });
    return pickPointMode;
  }

  private prepareToAddNewPoint() {
    runInAction(() => {
      const stack = this.terria.mapInteractionModeStack;
      const top = stack[stack.length - 1];
      if (top && this.ownedInteractionModes.includes(top)) {
        stack.pop();
        const idx = this.ownedInteractionModes.indexOf(top);
        if (idx >= 0) this.ownedInteractionModes.splice(idx, 1);
      }
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
            if (this.dragHelper.getDragCount() < 10) {
              this.addOrReplaceObserver(pickedPoint);
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

  cleanUp() {
    this.destroyViewshedArea();
    this.terria.overlays.remove(this);
    this.pointEntities.entities.removeAll();
    this.otherEntities.entities.removeAll();
    this.terria.allowFeatureInfoRequests = true;

    runInAction(() => {
      this.inDrawMode = false;
    });

    if (isDefined(this.terria.cesium)) {
      this.terria.cesium.cesiumWidget.canvas.setAttribute(
        "style",
        "cursor: auto"
      );
    }

    if (typeof this.onCleanUp === "function") {
      this.onCleanUp();
    }
  }

  getDialogMessage() {
    const header =
      typeof this.messageHeader === "function"
        ? this.messageHeader()
        : this.messageHeader;
    return `<div><strong>${header}</strong></div>`;
  }

  getButtonText(): string {
    return this.pointEntities.entities.values.length >= 1
      ? i18next.t(($) => $.models.userDrawing.btnDone)
      : i18next.t(($) => $.models.userDrawing.btnCancel);
  }

  private buildCircleBorderPositions(
    observerCartographic: Cartographic,
    radius: number,
    segments: number = 128
  ): Cartesian3[] {
    const positions: Cartesian3[] = [];
    const lat = observerCartographic.latitude;
    const lon = observerCartographic.longitude;
    const height = observerCartographic.height;
    const earthRadius = 6378137;
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

    if (positions.length !== 1 || !this.terria.cesium) {
      this.destroyViewshedArea();
      return;
    }

    const maximumDistance = this.terria.viewshedAreaDistance;
    if (maximumDistance <= 0) {
      this.destroyViewshedArea();
      return;
    }

    const cartoPos0 = Cartographic.fromCartesian(positions[0]);
    if (!cartoPos0) return;

    const observerPosition = Cartographic.toCartesian(cartoPos0);
    const terrainProvider = this.terria.cesium.scene.globe.terrainProvider;

    this.updateAreaBorder(observerPosition, maximumDistance);

    const rendererOptions = {
      terrainProvider,
      observerPosition,
      observerHeight: this.terria.viewshedAreaObserverHeight,
      maximumDistance,
      onImageryPartsChanged: (parts: ImageryParts | undefined) => {
        runInAction(() => {
          this.areaImagery = parts;
        });
      }
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
    runInAction(() => {
      this.areaImagery = undefined;
    });
    this.otherEntities.entities.removeById(BORDER_CIRCLE_ID);
  }
}
