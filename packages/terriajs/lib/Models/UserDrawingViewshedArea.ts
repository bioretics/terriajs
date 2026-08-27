import {
  computed,
  makeObservable,
  observable,
  reaction,
  runInAction
} from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Color from "terriajs-cesium/Source/Core/Color";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import defined from "terriajs-cesium/Source/Core/defined";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import ScreenSpaceEventHandler from "terriajs-cesium/Source/Core/ScreenSpaceEventHandler";
import ScreenSpaceEventType from "terriajs-cesium/Source/Core/ScreenSpaceEventType";
import ConstantPositionProperty from "terriajs-cesium/Source/DataSources/ConstantPositionProperty";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import PolylineGlowMaterialProperty from "terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty";
import ImageryProvider from "terriajs-cesium/Source/Scene/ImageryProvider";
import HeightReference from "terriajs-cesium/Source/Scene/HeightReference";
import isDefined from "../Core/isDefined";
import DragPoints from "../Map/DragPoints/DragPoints";
import Viewshed3D from "../Map/Cesium/Viewshed3D";
import MappableMixin, { ImageryParts } from "../ModelMixins/MappableMixin";
import MappableTraits from "../Traits/TraitsClasses/MappableTraits";
import CreateModel from "./Definition/CreateModel";
import Terria from "./Terria";
import UserDrawingViewshed from "./UserDrawingViewshed";

const BORDER_CIRCLE_ID = "viewshed-area-border";

interface Options {
  terria: Terria;
  messageHeader?: string | (() => string);
  onCleanUp?: () => void;
  /** When true, do not use mapInteractionModeStack (avoids covering other tools' UI). */
  invisible?: boolean;
}

export default class UserDrawingViewshedArea extends MappableMixin(
  CreateModel(MappableTraits)
) {
  private readonly onCleanUp?: () => void;
  private readonly dragHelper: DragPoints;

  pointEntities: CustomDataSource;
  otherEntities: CustomDataSource;

  @observable
  private inDrawMode = false;
  private disposeViewshedArea?: () => void;
  private viewshed?: Viewshed3D;
  @observable.ref
  private areaImageryProvider: ImageryProvider | undefined = undefined;
  @observable.ref
  private areaImageryRectangle: Rectangle | undefined = undefined;
  /** Own map clicks so we never push onto mapInteractionModeStack. */
  private mapClickHandler?: ScreenSpaceEventHandler;

  constructor(options: Options) {
    super(createGuid(), options.terria);

    makeObservable(this);

    this.onCleanUp = options.onCleanUp;
    this.pointEntities = new CustomDataSource("ViewshedAreaPoints");
    this.otherEntities = new CustomDataSource("ViewshedAreaOther");
    // options.messageHeader / invisible are retained for API compatibility with
    // the line drawer; area picking is always via ScreenSpaceEventHandler.

    this.dragHelper = new DragPoints(options.terria, () => {
      this.updateViewshedArea();
    });
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }

  @computed get mapItems() {
    return [
      this.pointEntities,
      this.otherEntities,
      new ImageryParts({
        imageryProvider: this.areaImageryProvider,
        clippingRectangle: this.areaImageryRectangle,
        alpha: 1,
        show: true
      })
    ];
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
    this.startMapClickPicking();
  }

  private startMapClickPicking() {
    this.stopMapClickPicking();
    const cesium = this.terria.cesium;
    if (!isDefined(cesium)) {
      return;
    }

    const scene = cesium.scene;
    this.mapClickHandler = new ScreenSpaceEventHandler(scene.canvas);
    this.mapClickHandler.setInputAction((click: { position: Cartesian2 }) => {
      if (!this.inDrawMode) {
        return;
      }
      // Once placed, only drag (or close/reopen) — never replace by clicking.
      if (this.pointEntities.entities.values.length >= 1) {
        return;
      }
      if (this.dragHelper.getDragCount() >= 10) {
        this.dragHelper.resetDragCount();
        return;
      }
      // Let the line tool collect its clicks without also placing the area point.
      if (this.lineViewshedIsWaitingForPoints()) {
        return;
      }

      const pickRay = scene.camera.getPickRay(click.position);
      if (!defined(pickRay)) {
        return;
      }
      const pickedPoint = scene.globe.pick(pickRay, scene);
      if (!defined(pickedPoint)) {
        return;
      }

      this.addObserver(pickedPoint);
      runInAction(() => {
        this.terria.pickedFeatures = undefined;
      });
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  private lineViewshedIsWaitingForPoints(): boolean {
    for (const item of this.terria.overlays.items) {
      if (item instanceof UserDrawingViewshed) {
        return item.pointEntities.entities.values.length < 2;
      }
    }
    return false;
  }

  private stopMapClickPicking() {
    if (this.mapClickHandler) {
      this.mapClickHandler.destroy();
      this.mapClickHandler = undefined;
    }
  }

  private addObserver(position: Cartesian3) {
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
    this.stopMapClickPicking();
    if (this.disposeViewshedArea) {
      this.disposeViewshedArea();
      this.disposeViewshedArea = undefined;
    }

    runInAction(() => {
      this.cleanUp();
    });
  }

  cleanUp() {
    this.stopMapClickPicking();
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
          this.areaImageryProvider = parts?.imageryProvider;
          this.areaImageryRectangle = parts?.clippingRectangle;
        });
        this.terria.currentViewer.notifyRepaintRequired();
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
      this.areaImageryProvider = undefined;
      this.areaImageryRectangle = undefined;
    });
    this.otherEntities.entities.removeById(BORDER_CIRCLE_ID);
  }
}
