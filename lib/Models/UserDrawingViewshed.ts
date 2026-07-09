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
import Material from "terriajs-cesium/Source/Scene/Material";

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
  private disposeHighlightReaction?: IReactionDisposer;

  /** The globe material that was active before we set our highlight; restored on cleanUp. */
  private previousGlobeMaterial?: any;
  /** ID of the rectangle-border polyline entity, so we can remove it on rebuild/cleanup. */
  private rectBorderEntityId?: string;
  /** Timestamp/key of the last rebuild, used to skip rebuilds when pts haven't changed. */
  private _lastRebuildKey = "";

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
      this.prepareToAddNewPoint();
    });

    this.disposeViewshedHeight = reaction(
      () => this.terria.viewshedDistances?.[1],
      () => {
        this.addMapInteractionMode();
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
    const svgDataDeclare = "data:image/svg+xml,";
    const svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    const svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="orange" stroke-width="4" fill="white" /> ';
    const svgSuffix = "</svg>";
    const svgString = svgPrefix + svgCircle + svgSuffix;

    return svgDataDeclare + svgString;
  }

  get svgTargetPoint() {
    const svgDataDeclare = "data:image/svg+xml,";
    const svgPrefix =
      '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    const svgCircle =
      '<circle cx="10" cy="10" r="5" stroke="purple" stroke-width="4" fill="white" /> ';
    const svgSuffix = "</svg>";
    const svgString = svgPrefix + svgCircle + svgSuffix;

    return svgDataDeclare + svgString;
  }

  enterDrawMode() {
    this.dragHelper.setUp();

    if (this.inDrawMode) {
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

    runInAction(() => {
      this.terria.pickedFeatures = undefined;
      this.terria.allowFeatureInfoRequests = false;
    });
    const that = this;

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

    this.disposeHighlightReaction = reaction(
      () => ({
        visible: this.terria.viewshedHighlightVisible,
        pointsKey: this.visibleLinePoints
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`)
          .join("|")
      }),
      (state, prev) => {
        if (!state.visible) {
          this._lastRebuildKey = "";
          this.rebuildHighlightPrimitive([], false);
          return;
        }

        const currentKey = state.pointsKey;
        const prevVisible = prev?.visible ?? false;
        const justEnabled = !prevVisible && state.visible;

        if (justEnabled || currentKey !== this._lastRebuildKey) {
          this.triggerHighlightRebuild();
        }
      },
      { fireImmediately: true }
    );

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
            this.addPointToPointEntities("Observer", pickedPoint, true);

            reaction.dispose();
            this.prepareToAddNewPoint();
          }
        }
      }
    );
  }

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

            if (
              this.dragHelper.getDragCount() < 10 &&
              !this.clickedExistingPoint(pickedFeatures.features) &&
              (this.numMaxPoints === undefined ||
                this.pointEntities.entities.values.length !== this.numMaxPoints)
            ) {
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
        return;
      } else if (index === 0) {
        userClickedExistingPoint = true;
      } else {
        this.pointEntities.entities.removeById(feature.id);
        userClickedExistingPoint = true;
        return;
      }
    });

    this.computeLineOfSight();

    return userClickedExistingPoint;
  }

  private triggerHighlightRebuild() {
    if (!this.terria.viewshedHighlightVisible) return;

    const pts = this.visibleLinePoints;
    const key = pts
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`)
      .join("|");

    if (key === this._lastRebuildKey && key !== "") return;

    this._lastRebuildKey = key;
    this.rebuildHighlightPrimitive(pts, true);
  }

  /**
   * Applies (or removes) the viewshed highlight using the original globe-material approach.
   * This preserves the altitude-blocking logic and the green area fill.
   */
  private rebuildHighlightPrimitive(pts: Cartesian3[], on: boolean) {
    const scene = this.terria.cesium?.scene;
    if (!scene) return;

    if (this.previousGlobeMaterial !== undefined) {
      scene.globe.material = this.previousGlobeMaterial;
      this.previousGlobeMaterial = undefined;
    }

    if (this.rectBorderEntityId) {
      this.otherEntities.entities.removeById(this.rectBorderEntityId);
      this.rectBorderEntityId = undefined;
    }

    if (!on || pts.length < 2) return;

    const observer = pts[0];
    const obstruction = pts[1];

    const rawDir = Cartesian3.subtract(obstruction, observer, new Cartesian3());
    const dist = Cartesian3.magnitude(rawDir);
    if (dist < 1) return;
    const direction = Cartesian3.normalize(rawDir, new Cartesian3());

    const up = Cartesian3.normalize(observer, new Cartesian3());
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, up, new Cartesian3()),
      new Cartesian3()
    );
    const halfWidth = dist;

    const observerCarto = Cartographic.fromCartesian(observer);
    const observerGroundHeight =
      observerCarto.height - this.terria.viewshedObserverHeight;

    const N_RAYS = 64;
    const N_STEPS = 64;
    const maxHalfAngle = Math.atan2(halfWidth, dist);
    const maxRayDist = Math.sqrt(dist * dist + halfWidth * halfWidth);
    const blockers = new Float32Array(N_RAYS).fill(maxRayDist);

    for (let ri = 0; ri < N_RAYS; ri++) {
      const angle = (ri / (N_RAYS - 1) - 0.5) * 2.0 * maxHalfAngle;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rdx = cosA * direction.x + sinA * right.x;
      const rdy = cosA * direction.y + sinA * right.y;
      const rdz = cosA * direction.z + sinA * right.z;

      for (let si = 1; si <= N_STEPS; si++) {
        const d = (si / N_STEPS) * maxRayDist;
        const terrainH = scene.globe.getHeight(
          Cartographic.fromCartesian(
            new Cartesian3(
              observer.x + rdx * d,
              observer.y + rdy * d,
              observer.z + rdz * d
            )
          )
        );
        if (terrainH !== undefined && terrainH >= observerGroundHeight) {
          blockers[ri] = d;
          break;
        }
      }
    }

    const glslBlockers = Array.from(blockers)
      .map((v) => v.toFixed(4))
      .join(", ");

    let material: any;
    try {
      material = new Material({
        fabric: {
          uniforms: {
            u_minHeight: observerGroundHeight,
            u_observerWC: new Cartesian3(observer.x, observer.y, observer.z),
            u_forward: new Cartesian3(direction.x, direction.y, direction.z),
            u_right: new Cartesian3(right.x, right.y, right.z),
            u_dist: dist,
            u_maxHalfAngle: maxHalfAngle,
            u_maxRayDist: maxRayDist,
            u_color: new Color(0.0, 1.0, 0.2, 0.45)
          },
          source: `
            const int   N_RAYS   = ${N_RAYS};
            const float blockers[${N_RAYS}] = float[${N_RAYS}](${glslBlockers});

            czm_material czm_getMaterial(czm_materialInput materialInput) {
              czm_material material = czm_getDefaultMaterial(materialInput);

              vec4 fragEC = vec4(-materialInput.positionToEyeEC, 1.0);
              vec3 fragWC  = (czm_inverseView * fragEC).xyz;

              vec3  rel = fragWC - u_observerWC;
              float fwd = dot(u_forward, rel);
              float lat = dot(u_right,   rel);

              float angle  = atan(lat, fwd);
              float inFan  = step(0.0, fwd)
                           * step(fwd, u_dist)
                           * step(-u_maxHalfAngle, angle)
                           * step(angle, u_maxHalfAngle);

              float notWall = step(materialInput.height, u_minHeight);

              float angFrac  = (angle + u_maxHalfAngle) / (2.0 * u_maxHalfAngle);
              int   rayIdx   = int(clamp(angFrac * float(N_RAYS - 1) + 0.5,
                                         0.0, float(N_RAYS - 1)));
              float bDist    = blockers[rayIdx];
              float fragD    = sqrt(fwd * fwd + lat * lat);
              float notShadowed = step(fragD, bDist);

              material.diffuse = u_color.rgb;
              material.alpha   = u_color.a * inFan * notWall * notShadowed;
              return material;
            }
          `
        },
        translucent: true
      });
    } catch (e) {
      console.error("[Viewshed] Failed to create highlight material:", e);
      material = new Material({
        fabric: {
          uniforms: {
            u_observerWC: new Cartesian3(observer.x, observer.y, observer.z),
            u_forward: new Cartesian3(direction.x, direction.y, direction.z),
            u_right: new Cartesian3(right.x, right.y, right.z),
            u_dist: dist,
            u_maxHalfAngle: maxHalfAngle,
            u_minHeight: observerGroundHeight,
            u_color: new Color(0.0, 1.0, 0.2, 0.45)
          },
          source: `
            czm_material czm_getMaterial(czm_materialInput materialInput) {
              czm_material material = czm_getDefaultMaterial(materialInput);
              vec4 fragEC = vec4(-materialInput.positionToEyeEC, 1.0);
              vec3 fragWC  = (czm_inverseView * fragEC).xyz;
              vec3  rel = fragWC - u_observerWC;
              float fwd = dot(u_forward, rel);
              float lat = dot(u_right,   rel);
              float angle = atan(lat, fwd);
              float inFan  = step(0.0, fwd) * step(fwd, u_dist)
                           * step(-u_maxHalfAngle, angle) * step(angle, u_maxHalfAngle);
              float notWall = step(materialInput.height, u_minHeight);
              material.diffuse = u_color.rgb;
              material.alpha   = u_color.a * inFan * notWall;
              return material;
            }
          `
        },
        translucent: true
      });
    }

    this.previousGlobeMaterial = scene.globe.material;
    scene.globe.material = material;

    const halfOffset = Cartesian3.multiplyByScalar(
      right,
      halfWidth,
      new Cartesian3()
    );
    const backLeft = Cartesian3.add(observer, halfOffset, new Cartesian3());
    const backRight = Cartesian3.subtract(
      observer,
      halfOffset,
      new Cartesian3()
    );
    const frontLeft = Cartesian3.add(obstruction, halfOffset, new Cartesian3());
    const frontRight = Cartesian3.subtract(
      obstruction,
      halfOffset,
      new Cartesian3()
    );

    const borderEntity = this.otherEntities.entities.add({
      name: "Viewshed Highlight Border",
      polyline: {
        positions: new CallbackProperty(
          () => [backLeft, backRight, frontRight, frontLeft, backLeft],
          true
        ),
        material: new PolylineGlowMaterialProperty({
          color: new Color(0.0, 1.0, 0.2, 0.9),
          glowPower: 0.2
        }),
        width: 3,
        clampToGround: true
      }
    });
    this.rectBorderEntityId = borderEntity.id;
  }

  cleanUp() {
    this.terria.overlays.remove(this);
    this.pointEntities.entities.removeAll();
    this.otherEntities.entities.removeAll();

    this.terria.allowFeatureInfoRequests = true;

    if (this.disposeHighlightReaction) {
      this.disposeHighlightReaction();
      this.disposeHighlightReaction = undefined;
    }

    this._lastRebuildKey = "";

    this.rectBorderEntityId = undefined;

    const scene = this.terria.cesium?.scene;
    if (this.previousGlobeMaterial !== undefined && scene) {
      scene.globe.material = this.previousGlobeMaterial;
      this.previousGlobeMaterial = undefined;
    }

    runInAction(() => {
      this.inDrawMode = false;
      this.terria.viewshedHighlightVisible = false;
    });

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

  getButtonText() {
    return defaultValue(
      this.buttonText,
      this.pointEntities.entities.values.length >= 2
        ? i18next.t("models.userDrawing.btnDone")
        : i18next.t("models.userDrawing.btnCancel")
    );
  }

  computeLineOfSight() {
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
      this.visibleLinePoints = [
        pos0Updated,
        useInter ? intersection! : pos1Updated
      ];
      this.hiddenLinePoints = useInter ? [intersection!, pos1Updated] : [];
    });

    this.triggerHighlightRebuild();
  }
}
