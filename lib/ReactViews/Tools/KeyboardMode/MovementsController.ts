import { action, makeObservable } from "mobx";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidTerrainProvider from "terriajs-cesium/Source/Core/EllipsoidTerrainProvider";
import KeyboardEventModifier from "terriajs-cesium/Source/Core/KeyboardEventModifier";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Matrix3 from "terriajs-cesium/Source/Core/Matrix3";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import ScreenSpaceEventHandler from "terriajs-cesium/Source/Core/ScreenSpaceEventHandler";
import ScreenSpaceEventType from "terriajs-cesium/Source/Core/ScreenSpaceEventType";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import Cesium from "../../../Models/Cesium";

type Movement =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "up"
  | "down"
  | "look";

export type Mode = "walk" | "fly";

const KeyMap: Record<KeyboardEvent["code"], Movement> = {
  KeyW: "forward",
  KeyA: "left",
  KeyS: "backward",
  KeyD: "right",
  Space: "up",
  ShiftLeft: "down",
  ShiftRight: "down"
};

export default class MovementsController {
  // Current active movements
  activeMovements: Set<Movement> = new Set();

  // True if we are currently updating surface height estimate
  isUpdatingSurfaceHeightEstimate = false;

  // True if we are currently animating surface height change
  isAnimatingSurfaceHeightChange = false;

  // The position of the mouse when a mouse action is started
  private startMousePosition?: Cartesian2;

  // The latest position of the mouse while the action is active
  private currentMousePosition?: Cartesian2;

  constructor(
    readonly cesium: Cesium,
  ) {
    makeObservable(this);
  }

  get scene() {
    return this.cesium.scene;
  }

  get camera() {
    return this.scene.camera;
  }

  /**
   * moveAmount decides the motion speed.
   */
  get moveAmount() {
    //const baseAmount = 0.2;
    const cameraHeight = this.camera.positionCartographic.height;
    const moveRate = cameraHeight / 100.0;
    return moveRate;
  }

  /**
   * Moves the camera forward and parallel to the surface by moveAmount
   */
  moveForward() {
    const direction = projectVectorToSurface(
      this.camera.direction,
      this.camera.position,
      this.scene.globe.ellipsoid
    );
    this.camera.move(direction, this.moveAmount);


    console.log("forwww")
    console.log(this.moveAmount)
    console.log(direction)

    this.cesium.notifyRepaintRequired();
  }

  /**
   * Moves the camera backward and parallel to the surface by moveAmount
   */
  moveBackward() {
    const direction = projectVectorToSurface(
      this.camera.direction,
      this.camera.position,
      this.scene.globe.ellipsoid
    );
    this.camera.move(direction, -this.moveAmount);
  }

  /**
   * Moves the camera left and parallel to the surface by moveAmount/4
   */
  moveLeft() {
    const direction = projectVectorToSurface(
      this.camera.right,
      this.camera.position,
      this.scene.globe.ellipsoid
    );
    this.camera.move(direction, -this.moveAmount / 4);
  }

  /**
   * Moves the camera right and parallel to the surface by moveAmount/4
   */
  moveRight() {
    const direction = projectVectorToSurface(
      this.camera.right,
      this.camera.position,
      this.scene.globe.ellipsoid
    );
    this.camera.move(direction, this.moveAmount / 4);
  }

  /**
   * Moves the camera up and perpendicular to the surface by moveAmount
   */
  moveUp() {
    const surfaceNormal = this.scene.globe.ellipsoid.geodeticSurfaceNormal(
      this.camera.position,
      new Cartesian3()
    );
    this.camera.move(surfaceNormal, this.moveAmount);
  }

  /**
   * Moves the camera up and perpendicular to the surface by moveAmount
   */
  moveDown() {
    const surfaceNormal = this.scene.globe.ellipsoid.geodeticSurfaceNormal(
      this.camera.position,
      new Cartesian3()
    );
    this.camera.move(surfaceNormal, -this.moveAmount);
  }

  look() {
    if (
      this.startMousePosition === undefined ||
      this.currentMousePosition === undefined
    )
      return;

    const startMousePosition = this.startMousePosition;
    const currentMousePosition = this.currentMousePosition;

    const camera = this.scene.camera;
    const canvas = this.scene.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const x = (currentMousePosition.x - startMousePosition.x) / width;
    const y = (currentMousePosition.y - startMousePosition.y) / height;
    const lookFactor = 0.1;

    const ellipsoid = this.scene.globe.ellipsoid;
    const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
      camera.position,
      new Cartesian3()
    );

    const surfaceTangent = projectVectorToSurface(
      camera.right,
      camera.position,
      this.scene.globe.ellipsoid
    );

    // Look left/right about the surface normal
    camera.look(surfaceNormal, x * lookFactor);

    // Look up/down about the surface tangent
    this.lookVertical(surfaceTangent, surfaceNormal, y * lookFactor);
  }

  /**
   * Look up/down limiting the maximum look angle to {@maxLookangle}
   *
   */
  lookVertical(
    lookAxis: Cartesian3,
    surfaceNormal: Cartesian3,
    lookAmount: number
  ) {
    const camera = this.camera;

    const friction = 1;
    camera.look(lookAxis, lookAmount * friction);
  }

  /**
   * Perform a move step
   */
  move(movement: Movement) {
    switch (movement) {
      case "forward":
        return this.moveForward();
      case "backward":
        return this.moveBackward();
      case "left":
        return this.moveLeft();
      case "right":
        return this.moveRight();
      case "up":
        return this.moveUp();
      case "down":
        return this.moveDown();
      case "look":
        return this.look();
    }
  }

  animate() {
    if (this.activeMovements.size > 0) {
      console.log("aaaaaaaaaaa");
      [...this.activeMovements].forEach((movement) => this.move(movement));
    }
  }

  /**
   * Map keyboard events to movements
   */
  setupKeyMap(): () => void {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (
        // do not match if any modifiers are pressed so that we do not hijack window shortcuts.
        ev.ctrlKey === false &&
        ev.altKey === false &&
        KeyMap[ev.code] !== undefined
      )
        this.activeMovements.add(KeyMap[ev.code]);
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      if (KeyMap[ev.code] !== undefined)
        this.activeMovements.delete(KeyMap[ev.code]);
    };

    document.addEventListener("keydown", excludeInputEvents(onKeyDown), true);
    document.addEventListener("keyup", excludeInputEvents(onKeyUp), true);

    const keyMapDestroyer = () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };

    return keyMapDestroyer;
  }

  /**
   * Map mouse events to movements
   */
  setupMouseMap(): () => void {
    const eventHandler = new ScreenSpaceEventHandler(this.scene.canvas);

    const startLook = (click: { position: Cartesian2 }) => {
      this.currentMousePosition = this.startMousePosition =
        click.position.clone();
      this.activeMovements.add("look");
    };

    const look = (movement: { endPosition: Cartesian2 }) => {
      this.currentMousePosition = movement.endPosition.clone();
    };

    const stopLook = () => {
      this.activeMovements.delete("look");
      this.currentMousePosition = this.startMousePosition = undefined;
    };

    // User might try to turn while moving down (by pressing SHIFT)
    // so trigger look event even when SHIFT is pressed.
    eventHandler.setInputAction(startLook, ScreenSpaceEventType.LEFT_DOWN);
    eventHandler.setInputAction(
      startLook,
      ScreenSpaceEventType.LEFT_DOWN,
      KeyboardEventModifier.SHIFT
    );

    eventHandler.setInputAction(look, ScreenSpaceEventType.MOUSE_MOVE);
    eventHandler.setInputAction(
      look,
      ScreenSpaceEventType.MOUSE_MOVE,
      KeyboardEventModifier.SHIFT
    );

    eventHandler.setInputAction(stopLook, ScreenSpaceEventType.LEFT_UP);
    eventHandler.setInputAction(
      stopLook,
      ScreenSpaceEventType.LEFT_UP,
      KeyboardEventModifier.SHIFT
    );
    const mouseMapDestroyer = () => eventHandler.destroy();
    return mouseMapDestroyer;
  }

  /**
 * Animate on each clock tick
 */
  startAnimating() {
    const stopAnimating =
      this.cesium.cesiumWidget.clock.onTick.addEventListener(
        this.animate.bind(this)
      );
    return stopAnimating;
  }

  /**
   * Activates MovementsController
   *
   * 1. Disables default map interactions.
   * 2. Sets up keyboard, mouse & animation event handlers.
   *
   * @returns A function to de-activate the movements controller
   */
  @action
  activate(): () => void {
    // Disable other map controls
    this.scene.screenSpaceCameraController.enableTranslate = false;
    this.scene.screenSpaceCameraController.enableRotate = false;
    this.scene.screenSpaceCameraController.enableLook = false;
    this.scene.screenSpaceCameraController.enableTilt = false;
    this.scene.screenSpaceCameraController.enableZoom = false;
    this.cesium.isFeaturePickingPaused = true;

    const destroyKeyMap = this.setupKeyMap();
    const destroyMouseMap = this.setupMouseMap();
    const stopAnimating = this.startAnimating();

    const deactivate = action(() => {
      destroyKeyMap();
      destroyMouseMap();
      stopAnimating();

      const screenSpaceCameraController =
        this.scene.screenSpaceCameraController;
      // screenSpaceCameraController will be undefined if the cesium map is already destroyed
      if (screenSpaceCameraController !== undefined) {
        screenSpaceCameraController.enableTranslate = true;
        screenSpaceCameraController.enableRotate = true;
        screenSpaceCameraController.enableLook = true;
        screenSpaceCameraController.enableTilt = true;
        screenSpaceCameraController.enableZoom = true;
      }
      this.cesium.isFeaturePickingPaused = false;
    });

    return deactivate;
  }
}

const sampleScratch = new Cartographic();

/**
 * Sample the terrain height at the given position
 */
async function sampleTerrainHeight(
  scene: Scene,
  position: Cartesian3
): Promise<number | undefined> {
  const terrainProvider = scene.terrainProvider;
  if (terrainProvider instanceof EllipsoidTerrainProvider) return 0;

  const [sample] = await sampleTerrainMostDetailed(terrainProvider, [
    Cartographic.fromCartesian(position, scene.globe.ellipsoid, sampleScratch)
  ]);
  return sample.height;
}

/**
 * Sample the scene height at the given position
 *
 * Scene height is the maximum height of a tileset feature or any other entity
 * at the given position.
 */
function sampleSceneHeight(
  scene: Scene,
  position: Cartesian3
): number | undefined {
  if (scene.sampleHeightSupported === false) return;
  return scene.sampleHeight(
    Cartographic.fromCartesian(position, undefined, sampleScratch)
  );
}

/**
 * Projects the {@vector} to the surface plane containing {@position}
 *
 * @param vector The input vector to project
 * @param position The position used to determine the surface plane
 * @param ellipsoid The ellipsoid used to compute the surface plane
 * @returns The projection of {@vector} on the surface plane at the given {@position}
 */
function projectVectorToSurface(
  vector: Cartesian3,
  position: Cartesian3,
  ellipsoid: Ellipsoid
) {
  const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
    position,
    new Cartesian3()
  );
  const magnitudeOfProjectionOnSurfaceNormal = Cartesian3.dot(
    vector,
    surfaceNormal
  );
  const projectionOnSurfaceNormal = Cartesian3.multiplyByScalar(
    surfaceNormal,
    magnitudeOfProjectionOnSurfaceNormal,
    new Cartesian3()
  );
  const projectionOnSurface = Cartesian3.subtract(
    vector,
    projectionOnSurfaceNormal,
    new Cartesian3()
  );
  return projectionOnSurface;
}

const rotateScratchQuaternion = new Quaternion();
const rotateScratchMatrix = new Matrix3();

/**
 * Rotates a vector about rotateAxis by rotateAmount
 */
function rotateVectorAboutAxis(
  vector: Cartesian3,
  rotateAxis: Cartesian3,
  rotateAmount: number
) {
  const quaternion = Quaternion.fromAxisAngle(
    rotateAxis,
    -rotateAmount,
    rotateScratchQuaternion
  );
  const rotation = Matrix3.fromQuaternion(quaternion, rotateScratchMatrix);
  const rotatedVector = Matrix3.multiplyByVector(
    rotation,
    vector,
    vector.clone()
  );
  return rotatedVector;
}

// A regex matching input tag names
const inputNodeRe = /input|textarea|select/i;

function excludeInputEvents(
  handler: (ev: KeyboardEvent) => void
): (ev: KeyboardEvent) => void {
  return (ev) => {
    const target = ev.target;
    if (target !== null) {
      const nodeName = (target as any).nodeName;
      const isContentEditable = (target as any).getAttribute?.(
        "contenteditable"
      );
      if (isContentEditable || inputNodeRe.test(nodeName)) {
        return;
      }
    }
    handler(ev);
  };
}
