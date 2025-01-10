import {
  observable,
  computed,
  action,
  makeObservable,
  runInAction
} from "mobx";
import Terria from "./Terria";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import Camera from "terriajs-cesium/Source/Scene/Camera";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumCartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import EllipsoidTerrainProvider from "terriajs-cesium/Source/Core/EllipsoidTerrainProvider";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import CesiumMatrix3 from "terriajs-cesium/Source/Core/Matrix3";

interface EventLoopState {
  intervalId?: any;
}

interface TerriaOrientation {
  orientation: {
    roll: number;
    pitch: number;
    heading: number;
  };
  destination?: CesiumCartesian3;
}

export default class MeasureTools {
  static readonly DEFAULT_MAXIMUM_UPDATES_PER_SECOND = 10.0;
  static readonly MINIMUM_HOVER_HEIGHT = 20.0;
  static readonly PRESET_HEIGHTS = [1000, 250, 20];

  @observable manualAlignment = false;
  @observable private eventLoopState: EventLoopState = {};
  @observable private orientationUpdated = false;
  @observable private alpha = 0;
  @observable private beta = 0;
  @observable private gamma = 0;
  @observable private realignAlpha = 0;
  @observable private realignHeading = 0;
  @observable private lastScreenOrientation?: number;

  @observable private maximumUpdatesPerSecond =
    MeasureTools.DEFAULT_MAXIMUM_UPDATES_PER_SECOND;

  @observable hoverLevel = MeasureTools.PRESET_HEIGHTS.length - 1;

  constructor(readonly terria: Terria) {
    makeObservable(this);
  }

  @computed
  get scene(): Scene | undefined {
    return this.terria.cesium && this.terria.cesium.scene;
  }

  @computed
  get camera(): Camera | undefined {
    return this.terria.cesium && this.terria.cesium.scene.camera;
  }

  @computed
  get active() {
    return this.isEventLoopRunning || this.manualAlignment;
  }

  @action
  activate() {
    this.manualAlignment = false;
    this.startEventLoop(true);
  }

  @action
  deactivate() {
    this.resetAlignment();
    this.manualAlignment = false;
    this.startEventLoop(false);
  }

  @action
  toggleManualAlignment() {
    this.setManualAlignment(!this.manualAlignment);
  }

  @computed
  get manualAlignmentSet() {
    return this.realignAlpha !== 0.0 || this.realignHeading !== 0.0;
  }

  @computed
  private get isEventLoopRunning() {
    return this.eventLoopState.intervalId !== undefined;
  }

  @action
  toggleHoverHeight() {
    this.hoverLevel =
      (this.hoverLevel + 1) % MeasureTools.PRESET_HEIGHTS.length;
    this.hover(MeasureTools.PRESET_HEIGHTS[this.hoverLevel]);
  }

  private hover(height: number, position?: Cartographic, flyTo?: boolean) {
    if (!this.camera) return;
    const camera = this.camera;
    const hoverPosition = position
      ? position
      : camera.positionCartographic.clone();

    flyTo = flyTo === undefined ? true : flyTo;

    if (height < MeasureTools.MINIMUM_HOVER_HEIGHT) {
      height = MeasureTools.MINIMUM_HOVER_HEIGHT;
    }

    const flyToHeight = (surfaceHeight: number) => {
      height += surfaceHeight;
      const newPosition = CesiumCartesian3.fromRadians(
        hoverPosition.longitude,
        hoverPosition.latitude,
        height
      );
      const pose = {
        destination: newPosition,
        ...this.getCurrentOrientation()
      };
      if (flyTo) {
        camera.flyTo(pose);
      } else {
        camera.setView(pose);
      }

      this.terria.currentViewer.notifyRepaintRequired();
    };

    if (
      !this.scene ||
      !this.scene.terrainProvider ||
      this.scene.terrainProvider instanceof EllipsoidTerrainProvider
    ) {
      flyToHeight(0);
    } else {
      const terrainProvider = this.scene.terrainProvider;
      sampleTerrainMostDetailed(terrainProvider, [hoverPosition]).then(
        function (updatedPosition: Cartographic[]) {
          flyToHeight(updatedPosition[0].height);
        }
      );
    }
  }

  moveTo(position: Cartographic, maximumHeight: number, flyTo: boolean) {
    if (this.manualAlignment) return;

    if (this.camera === undefined) return;
    const camera = this.camera;
    const cameraPosition = camera.positionCartographic.clone();
    const viewerHeight = cameraPosition.height;

    const moveToLocation = (surfaceHeight: number) => {
      let hoverHeight = viewerHeight - surfaceHeight;
      if (hoverHeight > maximumHeight) hoverHeight = maximumHeight;
      this.hover(hoverHeight, position, flyTo);
    };

    const scene = this.scene;
    if (
      scene === undefined ||
      scene.terrainProvider === undefined ||
      scene.terrainProvider instanceof EllipsoidTerrainProvider
    ) {
      moveToLocation(0);
    } else {
      const terrainProvider = scene.terrainProvider;
      sampleTerrainMostDetailed(terrainProvider, [cameraPosition]).then(
        function (updatedPosition: Array<Cartographic>) {
          moveToLocation(updatedPosition[0].height);
        }
      );
    }
  }

  private setManualAlignment(startEnd: boolean) {
    if (this.active === false) return;

    if (startEnd === false && this.camera !== undefined) {
      this.realignAlpha = this.alpha;
      this.realignHeading = CesiumMath.toDegrees(this.camera.heading);
    }

    if (this.manualAlignment !== startEnd) {
      this.manualAlignment = startEnd;
      this.startEventLoop(!this.manualAlignment);
    }
  }

  resetAlignment() {
    this.orientationUpdated = true;
    this.realignAlpha = 0;
    this.realignHeading = 0;
  }

  private startEventLoop(enable: boolean) {
    if (this.isEventLoopRunning === enable) return;
    if (enable === true) {
      this.orientationUpdated = true;
      const intervalMs = 1000 / this.maximumUpdatesPerSecond;
      const id: any = setInterval(
        () => runInAction(() => this.updateOrientation()),
        intervalMs
      );
      if ("ondeviceorientation" in window) {
        window.addEventListener(
          "deviceorientation",
          this.boundStoreOrientation
        );
      }
      this.eventLoopState = { intervalId: id };
    } else {
      clearInterval(this.eventLoopState.intervalId);
      window.removeEventListener(
        "deviceorientation",
        this.boundStoreOrientation
      );
      this.eventLoopState = {};
    }
  }

  storeOrientation(event: DeviceOrientationEvent) {
    const { alpha, beta, gamma } = event;
    if (alpha !== null && beta !== null && gamma !== null) {
      this.alpha = alpha;
      this.beta = beta;
      this.gamma = gamma;
      this.orientationUpdated = true;
    }
  }

  private boundStoreOrientation = this.storeOrientation.bind(this);

  private updateOrientation() {
    const screenOrientation = getCurrentScreenOrientation();
    if (screenOrientation !== this.lastScreenOrientation)
      this.orientationUpdated = true;
    this.lastScreenOrientation = screenOrientation;

    if (!this.orientationUpdated) {
      return;
    }
    this.orientationUpdated = false;

    if (this.camera) {
      this.camera.setView(this.getCurrentOrientation(screenOrientation));
      this.terria.currentViewer.notifyRepaintRequired();
    }
  }

  private getCurrentOrientation(screenOrientation?: number) {
    const alpha = this.alpha;
    const beta = this.beta;
    const gamma = this.gamma;

    const realignAlpha = this.realignAlpha;
    const realignHeading = this.realignHeading;

    if (screenOrientation === undefined)
      screenOrientation = getCurrentScreenOrientation();
    return computeTerriaOrientation(
      alpha,
      beta,
      gamma,
      screenOrientation,
      realignAlpha,
      realignHeading
    );
  }
}

function getCurrentScreenOrientation(): number {
  if (screen.orientation && screen.orientation.angle !== undefined)
    return screen.orientation.angle;

  if (window.orientation) {
    return Number(window.orientation);
  }

  return 0;
}

function computeTerriaOrientation(
  alpha: number,
  beta: number,
  gamma: number,
  screenOrientation: number,
  realignAlpha: number,
  realignHeading: number
): TerriaOrientation {
  const rotation = CesiumMatrix3.clone(CesiumMatrix3.IDENTITY);
  let rotationIncrement;

  rotationIncrement = CesiumMatrix3.fromRotationZ(
    CesiumMath.toRadians(screenOrientation)
  );
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);

  rotationIncrement = CesiumMatrix3.fromRotationX(CesiumMath.toRadians(90));
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);

  rotationIncrement = CesiumMatrix3.fromRotationZ(CesiumMath.toRadians(gamma));
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);

  rotationIncrement = CesiumMatrix3.fromRotationX(CesiumMath.toRadians(-beta));
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);

  rotationIncrement = CesiumMatrix3.fromRotationY(
    CesiumMath.toRadians(-(alpha - realignAlpha))
  );
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);

  rotationIncrement = CesiumMatrix3.fromRotationY(
    CesiumMath.toRadians(realignHeading)
  );
  CesiumMatrix3.multiply(rotation, rotationIncrement, rotation);
  const getColumn = (mat: CesiumMatrix3, col: number): number => {
    return (mat as any)[col];
  };

  const r10: number = getColumn(rotation, CesiumMatrix3.COLUMN1ROW0);
  const r11: number = getColumn(rotation, CesiumMatrix3.COLUMN1ROW1);
  const r02: number = getColumn(rotation, CesiumMatrix3.COLUMN0ROW2);
  const r12: number = getColumn(rotation, CesiumMatrix3.COLUMN1ROW2);
  const r22: number = getColumn(rotation, CesiumMatrix3.COLUMN2ROW2);

  const heading = CesiumMath.toDegrees(Math.atan2(-r02, r22));
  const roll = CesiumMath.toDegrees(Math.atan2(-r10, r11));
  const pitch = CesiumMath.toDegrees(
    Math.atan2(-r12, Math.sqrt(r02 * r02 + r22 * r22))
  );

  return {
    orientation: {
      roll: CesiumMath.toRadians(roll),
      pitch: CesiumMath.toRadians(pitch),
      heading: CesiumMath.toRadians(heading)
    }
  };
}
