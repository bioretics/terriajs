import Camera from "terriajs-cesium/Source/Scene/Camera";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import DebugCameraPrimitive from "terriajs-cesium/Source/Scene/DebugCameraPrimitive";
import Material from "terriajs-cesium/Source/Scene/Material";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import PerspectiveFrustum from "terriajs-cesium/Source/Core/PerspectiveFrustum";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import ShadowMap from "terriajs-cesium/Source/Scene/ShadowMap";
import ShadowMode from "terriajs-cesium/Source/Scene/ShadowMode";
import Transforms from "terriajs-cesium/Source/Core/Transforms";

/**
 * Parameters for a single terrain viewshed. Angles are in radians and distances
 * are in metres. The class deliberately has no Terria dependency so it can be
 * reused by another Terria UI entry point.
 */
export interface Viewshed3DOptions {
  observerPosition: Cartesian3;
  heading: number;
  pitch: number;
  horizontalFov: number;
  verticalFov: number;
  maximumDistance: number;
  visibleColor?: Color;
  occludedColor?: Color;
  alpha?: number;
  showDebug?: boolean;
  textureSize?: number;
  onTerrainLoadProgress?: (queuedTileCount: number) => void;
}

export interface Viewshed3DUpdateOptions extends Partial<
  Omit<Viewshed3DOptions, "textureSize">
> {}

export const DEFAULT_VIEWSHED_HORIZONTAL_FOV = Math.PI / 3;
export const DEFAULT_VIEWSHED_VERTICAL_FOV = Math.PI / 4;
export const DEFAULT_VIEWSHED_TEXTURE_SIZE = 512;
export const DEFAULT_VIEWSHED_ALPHA = 0.45;

const scratchDirection = new Cartesian3();
const scratchUp = new Cartesian3();
const scratchRight = new Cartesian3();
const scratchEnu = new Matrix4();
const scratchInverseEnu = new Matrix4();
const scratchLocalDirection = new Cartesian3();
const scratchMatrixArray = new Array<number>(16);

/**
 * Heading and pitch of the segment expressed in the observer's local ENU frame.
 * Cesium's heading is clockwise from north and pitch is positive above the
 * local horizon.
 *
 * The look direction MUST be unit-length before deriving pitch: Cesium's
 * getPitch uses acos(direction.z), so an unnormalised ECEF delta collapses
 * pitch to ±90° and the analysis frustum aims straight down.
 */
export function headingPitchFromObserverAndTarget(
  observer: Cartesian3,
  target: Cartesian3,
  scene: Scene
): { heading: number; pitch: number; distance: number } {
  const direction = Cartesian3.subtract(target, observer, scratchDirection);
  const distance = Cartesian3.magnitude(direction);

  if (distance === 0) {
    return { heading: 0, pitch: 0, distance: 0 };
  }

  Cartesian3.normalize(direction, direction);

  const enu = Transforms.eastNorthUpToFixedFrame(
    observer,
    scene.globe.ellipsoid,
    scratchEnu
  );
  const inverseEnu = Matrix4.inverseTransformation(enu, scratchInverseEnu);
  const localDirection = Matrix4.multiplyByPointAsVector(
    inverseEnu,
    direction,
    scratchLocalDirection
  );
  Cartesian3.normalize(localDirection, localDirection);

  // ENU: x = east, y = north, z = up. Heading is clockwise from north.
  const heading = Math.atan2(localDirection.x, localDirection.y);
  const pitch = Math.asin(localDirection.z);

  return { heading, pitch, distance };
}

/**
 * World-space look direction for Cesium heading/pitch at an ECEF position.
 */
export function directionFromHeadingPitch(
  observer: Cartesian3,
  heading: number,
  pitch: number,
  scene: Scene,
  result: Cartesian3 = new Cartesian3()
): Cartesian3 {
  const cosPitch = Math.cos(pitch);
  // ENU components matching Cesium Camera heading/pitch conventions.
  const localDirection = Cartesian3.fromElements(
    Math.sin(heading) * cosPitch,
    Math.cos(heading) * cosPitch,
    Math.sin(pitch),
    scratchLocalDirection
  );
  const enu = Transforms.eastNorthUpToFixedFrame(
    observer,
    scene.globe.ellipsoid,
    scratchEnu
  );
  return Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(enu, localDirection, result),
    result
  );
}

/**
 * Cesium exposes ShadowMap as a public symbol but deliberately does not expose
 * construction or frame-state registration. All Cesium 26 renderer internals
 * needed for the terrain analysis are kept in this adapter, rather than leaking
 * into the UI/model layers or modifying terriajs-cesium itself.
 */
interface Cesium26ShadowMap {
  _shadowMapTexture?: unknown;
  _shadowMapMatrix: Matrix4;
  _terrainBias: { depthBias: number };
  _usesDepthTexture: boolean;
  _needsUpdate: boolean;
  _boundingSphere: { radius: number };
  _passes: Array<{ commandList: Array<{ pass?: number }> }>;
  updatePass(context: unknown, shadowPass: number): void;
  destroy(): void;
  isDestroyed(): boolean;
}

interface Cesium26ShadowMapConstructor {
  new (options: {
    context: unknown;
    lightCamera: Camera;
    enabled: boolean;
    cascadesEnabled: boolean;
    size: number;
    softShadows: boolean;
    normalOffset: boolean;
    fromLightSource: boolean;
    maximumDistance: number;
  }): Cesium26ShadowMap;
}

interface Cesium26FrameState {
  shadowMaps?: Cesium26ShadowMap[];
}

interface Cesium26SceneContext {
  defaultTexture: unknown;
}

interface Cesium26Scene extends Scene {
  context: Cesium26SceneContext;
}

/** Cesium 26's internal Pass.GLOBE value. Kept here with the adapter. */
const CESIUM26_GLOBE_PASS = 2;

/**
 * Keep more terrain tiles resident while a viewshed is active so a one-shot
 * refine after observer edits is less likely to miss the analysis region.
 * Restored on destroy; does not change maximumScreenSpaceError.
 */
const VIEWSHED_TILE_CACHE_SIZE = 1000;

class TerrainShadowMapAdapter {
  readonly shadowMap: Cesium26ShadowMap;
  readonly registrationPrimitive: {
    show: boolean;
    update: (frameState: Cesium26FrameState) => void;
    isDestroyed: () => boolean;
    destroy: () => void;
  };

  private destroyed = false;
  /**
   * When true, the depth texture is held fixed. The shadow matrix still
   * updates every frame (eye-space remapping for the navigation camera), but
   * Cesium is not allowed to rebuild the analysis depth from new terrain LODs.
   */
  private depthFrozen = false;
  private readonly originalUpdatePass: (
    context: unknown,
    shadowPass: number
  ) => void;

  constructor(
    private readonly scene: Scene,
    readonly camera: Camera,
    textureSize: number,
    maximumDistance: number
  ) {
    const cesium26Scene = scene as Cesium26Scene;
    const ShadowMapConstructor =
      ShadowMap as unknown as Cesium26ShadowMapConstructor;
    this.shadowMap = new ShadowMapConstructor({
      context: cesium26Scene.context,
      lightCamera: camera,
      enabled: true,
      cascadesEnabled: false,
      size: textureSize,
      softShadows: false,
      normalOffset: false,
      fromLightSource: false,
      maximumDistance
    });
    // Analytical viewsheds need a very small bias; the default sun-shadow bias
    // is large enough to wash out terrain-to-terrain occlusion.
    this.shadowMap._terrainBias.depthBias = 0.00001;

    this.originalUpdatePass = this.shadowMap.updatePass.bind(this.shadowMap);
    this.shadowMap.updatePass = (context: unknown, shadowPass: number) => {
      // Scene has already assembled the shadow command list at this point. Keep
      // only Globe commands so models and 3D Tiles cannot occlude this analysis.
      const commandList = this.shadowMap._passes[shadowPass]?.commandList;
      if (commandList) {
        for (let i = commandList.length - 1; i >= 0; i--) {
          if (commandList[i].pass !== CESIUM26_GLOBE_PASS) {
            commandList.splice(i, 1);
          }
        }
      }
      this.originalUpdatePass(context, shadowPass);
    };

    this.registrationPrimitive = {
      show: true,
      update: (frameState: Cesium26FrameState) => {
        if (this.destroyed) return;
        // Freeze after capture so pan/zoom LOD changes cannot rewrite depth.
        // Matrix remapping still runs inside ShadowMap.update when needsUpdate
        // is false — that is intentional and view-stable in world space.
        if (this.depthFrozen) {
          this.shadowMap._needsUpdate = false;
        } else if (
          this.shadowMap._shadowMapTexture !== undefined &&
          !this.shadowMap._needsUpdate
        ) {
          this.depthFrozen = true;
        }
        frameState.shadowMaps?.push(this.shadowMap);
      },
      isDestroyed: () => this.destroyed,
      destroy: () => {
        this.destroy();
      }
    };
    scene.primitives.add(this.registrationPrimitive as never);
  }

  get texture(): unknown {
    return (
      this.shadowMap._shadowMapTexture ??
      (this.scene as Cesium26Scene).context.defaultTexture
    );
  }

  get hasTexture(): boolean {
    return this.shadowMap._shadowMapTexture !== undefined;
  }

  get matrix(): Matrix4 {
    return this.shadowMap._shadowMapMatrix;
  }

  get depthBias(): number {
    return this.shadowMap._terrainBias.depthBias;
  }

  get usesDepthTexture(): boolean {
    return this.shadowMap._usesDepthTexture;
  }

  /** Rebuild the analysis depth map after explicit observer/option edits. */
  markDirty() {
    this.depthFrozen = false;
    this.shadowMap._needsUpdate = true;
    // checkVisibility skips updates when the previous bounding sphere matches.
    this.shadowMap._boundingSphere.radius = -1;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.primitives.remove(this.registrationPrimitive as never);
    if (!this.shadowMap.isDestroyed()) this.shadowMap.destroy();
  }
}

const terrainMaterialSource = `
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    // A globe material is alpha-blended *over* the already computed imagery.
    // The default material is opaque black, so make non-analysis fragments
    // transparent and set an alpha only for the viewshed overlay below.
    material.alpha = 0.0;

    // GlobeFS sets positionToEyeEC = -v_positionEC, so negate once for EC.
    vec3 positionEC = -materialInput.positionToEyeEC;
    float range = distance(positionEC, viewshedObserverPositionEC);

    if (range > viewshedMaximumDistance) {
        return material;
    }

    vec4 shadowPosition = viewshedShadowMatrix * vec4(positionEC, 1.0);
    shadowPosition /= shadowPosition.w;

    if (any(lessThan(shadowPosition.xyz, vec3(0.0))) ||
        any(greaterThan(shadowPosition.xyz, vec3(1.0)))) {
        return material;
    }

    // Before the first shadow pass, still tint the geometric FOV so the user
    // sees the analysis footprint immediately; refine once depth is ready.
    float visibility = 1.0;
    if (viewshedShadowReady > 0.5) {
        vec4 packedShadowDepth = texture(viewshedShadowTexture, shadowPosition.xy);
        float storedDepth = viewshedUsesDepthTexture > 0.5
            ? packedShadowDepth.r
            : czm_unpackDepth(packedShadowDepth);
        float depthBias = viewshedDepthBias * max(length(positionEC) * 0.01, 1.0);
        visibility = step(shadowPosition.z - depthBias, storedDepth);
    }

    vec4 analysisColor = mix(viewshedOccludedColor, viewshedVisibleColor, visibility);
    material.diffuse = analysisColor.rgb;
    material.alpha = analysisColor.a;
    return material;
}`;

/**
 * GPU terrain visibility renderer for one observer. It is intentionally a
 * short-lived scene resource: callers create it once after choosing an
 * observer/aim point, call update while editing, and always destroy it.
 */
export default class Viewshed3D {
  private options: Required<
    Omit<Viewshed3DOptions, "onTerrainLoadProgress">
  > & { onTerrainLoadProgress?: Viewshed3DOptions["onTerrainLoadProgress"] };
  private readonly camera: Camera;
  private readonly shadowAdapter: TerrainShadowMapAdapter;
  private readonly material: Material;
  private readonly priorGlobeMaterial: Material | undefined;
  private readonly priorGlobeShadows: ShadowMode;
  private readonly debugPrimitive: DebugCameraPrimitive;
  private readonly removeTileProgressListener: () => void;
  private readonly priorTileCacheSize: number;
  /**
   * After an observer edit, allow a single depth rebuild once the globe tile
   * queue drains. Further navigation-driven tile loads do not refresh depth.
   */
  private settleRefineArmed = true;
  private seenTilesLoadingSinceArm = false;
  private destroyed = false;

  constructor(
    private readonly scene: Scene,
    options: Viewshed3DOptions
  ) {
    this.options = Viewshed3D.normaliseOptions(options);
    this.validateOptions(this.options);

    this.camera = new Camera(scene);
    this.configureCamera();
    this.shadowAdapter = new TerrainShadowMapAdapter(
      scene,
      this.camera,
      this.options.textureSize,
      this.options.maximumDistance
    );

    this.material = this.createTerrainMaterial();
    this.priorGlobeMaterial = scene.globe.material;
    this.priorGlobeShadows = scene.globe.shadows;
    this.priorTileCacheSize = scene.globe.tileCacheSize;
    scene.globe.tileCacheSize = Math.max(
      this.priorTileCacheSize,
      VIEWSHED_TILE_CACHE_SIZE
    );
    scene.globe.shadows = ShadowMode.ENABLED;
    scene.globe.material = this.material;

    this.debugPrimitive = new DebugCameraPrimitive({
      camera: this.camera,
      color: Color.YELLOW.withAlpha(0.8),
      show: this.options.showDebug
    });
    scene.primitives.add(this.debugPrimitive);

    this.removeTileProgressListener =
      scene.globe.tileLoadProgressEvent.addEventListener(
        (queuedTileCount: number) => {
          this.options.onTerrainLoadProgress?.(queuedTileCount);
          // Do not rebuild depth on every navigation LOD change — that is what
          // made the tint flicker when the user panned or zoomed. Only take one
          // refine after an explicit observer edit, when a real load cycle drains.
          if (queuedTileCount > 0) {
            this.seenTilesLoadingSinceArm = true;
          } else if (
            this.settleRefineArmed &&
            this.seenTilesLoadingSinceArm &&
            queuedTileCount === 0
          ) {
            this.settleRefineArmed = false;
            this.seenTilesLoadingSinceArm = false;
            this.shadowAdapter.markDirty();
          }
          scene.requestRender();
        }
      );
    scene.requestRender();
  }

  update(options: Viewshed3DUpdateOptions) {
    if (this.destroyed) return;
    this.options = Viewshed3D.normaliseOptions({ ...this.options, ...options });
    this.validateOptions(this.options);
    this.configureCamera();
    this.settleRefineArmed = true;
    this.seenTilesLoadingSinceArm = false;
    this.shadowAdapter.markDirty();
    this.debugPrimitive.show = this.options.showDebug;
    this.scene.requestRender();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeTileProgressListener();
    this.scene.primitives.remove(this.debugPrimitive);
    this.shadowAdapter.destroy();

    // Do not overwrite a globe material installed after Viewshed3D was started.
    if (this.scene.globe.material === this.material) {
      this.scene.globe.material = this.priorGlobeMaterial;
    }
    this.scene.globe.shadows = this.priorGlobeShadows;
    this.scene.globe.tileCacheSize = this.priorTileCacheSize;
    this.scene.requestRender();
  }

  isDestroyed() {
    return this.destroyed;
  }

  private configureCamera() {
    const frustum = this.camera.frustum as PerspectiveFrustum;
    const aspectRatio =
      Math.tan(this.options.horizontalFov / 2) /
      Math.tan(this.options.verticalFov / 2);
    // PerspectiveFrustum uses fov for the larger image dimension.
    frustum.fov =
      aspectRatio >= 1 ? this.options.horizontalFov : this.options.verticalFov;
    frustum.aspectRatio = aspectRatio;
    frustum.near = 1.0;
    frustum.far = this.options.maximumDistance;

    // Aim like SensorShadow: world-space position/direction/up on the light
    // camera. Avoid setView(heading/pitch) round-trips that previously fed
    // unnormalised directions into Cesium's acos-based pitch.
    const direction = directionFromHeadingPitch(
      this.options.observerPosition,
      this.options.heading,
      this.options.pitch,
      this.scene,
      scratchDirection
    );
    const up = this.scene.globe.ellipsoid.geodeticSurfaceNormal(
      this.options.observerPosition,
      scratchUp
    );
    Cartesian3.clone(this.options.observerPosition, this.camera.position);
    Cartesian3.clone(direction, this.camera.direction);
    Cartesian3.cross(direction, up, scratchRight);
    if (Cartesian3.magnitudeSquared(scratchRight) < 1e-12) {
      // Looking nearly along the surface normal — pick any stable right vector.
      Cartesian3.mostOrthogonalAxis(direction, scratchRight);
      Cartesian3.cross(direction, scratchRight, scratchRight);
    }
    Cartesian3.normalize(scratchRight, scratchRight);
    Cartesian3.cross(scratchRight, direction, this.camera.up);
    Cartesian3.normalize(this.camera.up, this.camera.up);
    Cartesian3.clone(scratchRight, this.camera.right);
  }

  private createTerrainMaterial() {
    const material = new Material({
      translucent: true,
      fabric: {
        type: "TerriaViewshed3DTerrain_v2",
        uniforms: {
          viewshedShadowTexture: Material.DefaultImageId,
          // Fabric infers GLSL matrices from a number array, not a Matrix4
          // instance. Passing Matrix4.IDENTITY here leaves the uniform type
          // undefined during Material construction (Cesium 26).
          viewshedShadowMatrix: Matrix4.toArray(
            Matrix4.IDENTITY,
            scratchMatrixArray.slice()
          ),
          viewshedObserverPositionEC: new Cartesian3(),
          viewshedMaximumDistance: this.options.maximumDistance,
          viewshedDepthBias: this.shadowAdapter.depthBias,
          // Use floats — Fabric bool uniforms are fragile across Cesium builds.
          viewshedUsesDepthTexture: this.shadowAdapter.usesDepthTexture
            ? 1.0
            : 0.0,
          viewshedShadowReady: 0.0,
          viewshedVisibleColor: this.options.visibleColor,
          viewshedOccludedColor: this.options.occludedColor
        },
        source: terrainMaterialSource
      }
    });

    const materialInternals = material as unknown as {
      _uniforms: Record<string, () => unknown>;
    };
    const observerPositionEC = new Cartesian3();
    const setDynamicUniform = (name: string, getValue: () => unknown) => {
      const uniformName = Object.keys(materialInternals._uniforms).find((key) =>
        key.startsWith(`${name}_`)
      );
      if (!uniformName) {
        throw new Error(
          "Cesium 26 material uniform layout is incompatible with Viewshed3D"
        );
      }
      materialInternals._uniforms[uniformName] = getValue;
    };

    // Cesium records the Fabric uniform type at construction time. Replacing
    // the generated uniform callbacks afterwards keeps those types intact
    // while supplying the current shadow-map values on every render.
    setDynamicUniform(
      "viewshedShadowTexture",
      () => this.shadowAdapter.texture
    );
    // Runtime path matches Cesium's own shadowMap_matrix uniform (Matrix4).
    setDynamicUniform("viewshedShadowMatrix", () => this.shadowAdapter.matrix);
    setDynamicUniform("viewshedObserverPositionEC", () =>
      Matrix4.multiplyByPoint(
        this.scene.camera.viewMatrix,
        this.options.observerPosition,
        observerPositionEC
      )
    );
    setDynamicUniform(
      "viewshedMaximumDistance",
      () => this.options.maximumDistance
    );
    setDynamicUniform("viewshedDepthBias", () => this.shadowAdapter.depthBias);
    setDynamicUniform("viewshedUsesDepthTexture", () =>
      this.shadowAdapter.usesDepthTexture ? 1.0 : 0.0
    );
    setDynamicUniform("viewshedShadowReady", () =>
      this.shadowAdapter.hasTexture ? 1.0 : 0.0
    );
    setDynamicUniform("viewshedVisibleColor", () => this.options.visibleColor);
    setDynamicUniform(
      "viewshedOccludedColor",
      () => this.options.occludedColor
    );
    return material;
  }

  private validateOptions(
    options: Pick<
      Viewshed3DOptions,
      "maximumDistance" | "horizontalFov" | "verticalFov"
    >
  ) {
    if (
      options.maximumDistance <= 1 ||
      options.horizontalFov <= 0 ||
      options.horizontalFov >= Math.PI ||
      options.verticalFov <= 0 ||
      options.verticalFov >= Math.PI
    ) {
      throw new Error(
        "Viewshed3D needs positive FOVs below 180° and a range above one metre"
      );
    }
  }

  private static normaliseOptions(options: Viewshed3DOptions) {
    const alpha = options.alpha ?? DEFAULT_VIEWSHED_ALPHA;
    return {
      ...options,
      alpha,
      visibleColor: (options.visibleColor ?? Color.LIME).withAlpha(alpha),
      occludedColor: (options.occludedColor ?? Color.RED).withAlpha(alpha),
      showDebug: options.showDebug ?? false,
      textureSize: options.textureSize ?? DEFAULT_VIEWSHED_TEXTURE_SIZE
    };
  }
}
