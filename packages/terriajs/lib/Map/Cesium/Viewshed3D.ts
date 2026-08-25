import Camera from "terriajs-cesium/Source/Scene/Camera";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import Material from "terriajs-cesium/Source/Scene/Material";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import ShadowMap from "terriajs-cesium/Source/Scene/ShadowMap";
import ShadowMode from "terriajs-cesium/Source/Scene/ShadowMode";

/**
 * Parameters for an omnidirectional terrain viewshed. Distances are in metres.
 * The analysis covers a sphere of radius `maximumDistance` around the observer;
 * only terrain that is line-of-sight visible is tinted.
 */
export interface Viewshed3DOptions {
  observerPosition: Cartesian3;
  maximumDistance: number;
  visibleColor?: Color;
  alpha?: number;
  textureSize?: number;
  onTerrainLoadProgress?: (queuedTileCount: number) => void;
}

export interface Viewshed3DUpdateOptions extends Partial<
  Omit<Viewshed3DOptions, "textureSize">
> {}

export const DEFAULT_VIEWSHED_TEXTURE_SIZE = 512;
export const DEFAULT_VIEWSHED_ALPHA = 0.45;

/**
 * Cesium exposes ShadowMap as a public symbol but deliberately does not expose
 * construction or frame-state registration. All Cesium 26 renderer internals
 * needed for the terrain analysis are kept in this adapter, rather than leaking
 * into the UI/model layers or modifying terriajs-cesium itself.
 */
interface Cesium26ShadowMap {
  _shadowMapTexture?: unknown;
  _pointLightRadius: number;
  maximumDistance: number;
  _terrainBias: { depthBias: number };
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
    isPointLight: boolean;
    pointLightRadius: number;
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
  defaultCubeMap: unknown;
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
   * When true, the depth cube is held fixed. Eye-space remapping still happens
   * via the observer-position uniform; Cesium is not allowed to rebuild analysis
   * depth from navigation-driven terrain LOD changes.
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
      isPointLight: true,
      pointLightRadius: maximumDistance,
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
      (this.scene as Cesium26Scene).context.defaultCubeMap
    );
  }

  get hasTexture(): boolean {
    return this.shadowMap._shadowMapTexture !== undefined;
  }

  get depthBias(): number {
    return this.shadowMap._terrainBias.depthBias;
  }

  setRadius(maximumDistance: number) {
    this.shadowMap._pointLightRadius = maximumDistance;
    this.shadowMap.maximumDistance = maximumDistance;
  }

  /** Rebuild the analysis depth cube after explicit observer/option edits. */
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
    // Keep non-visible fragments fully transparent.
    material.alpha = 0.0;

    // GlobeFS sets positionToEyeEC = -v_positionEC, so negate once for EC.
    vec3 positionEC = -materialInput.positionToEyeEC;
    vec3 directionEC = positionEC - viewshedObserverPositionEC;
    float range = length(directionEC);

    if (range > viewshedMaximumDistance || range < 1e-3) {
        return material;
    }

    // Before the cubemap is ready, leave terrain unpainted.
    if (viewshedShadowReady < 0.5) {
        return material;
    }

    // Omnidirectional sampling matches Cesium's point-light shadow receive path:
    // depth is stored as distance/radius; lookup direction is in world space.
    vec3 directionWC = czm_inverseViewRotation * normalize(directionEC);
    float depth = range / viewshedMaximumDistance;
    float storedDepth = czm_unpackDepth(texture(viewshedShadowCube, directionWC));
    float depthBias = viewshedDepthBias * max(range * 0.01, 1.0);
    float visibility = step(depth - depthBias, storedDepth);

    if (visibility < 0.5) {
        return material;
    }

    material.diffuse = viewshedVisibleColor.rgb;
    material.alpha = viewshedVisibleColor.a;
    return material;
}`;

/**
 * GPU omnidirectional terrain visibility renderer for one observer. Callers
 * create it after choosing an observer and range point, call update while
 * editing, and always destroy it.
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
    Cartesian3.clone(this.options.observerPosition, this.camera.position);
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

    this.removeTileProgressListener =
      scene.globe.tileLoadProgressEvent.addEventListener(
        (queuedTileCount: number) => {
          this.options.onTerrainLoadProgress?.(queuedTileCount);
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
    this.scene.requestRender();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeTileProgressListener();
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
    // Point-light shadow maps only need the observer position; Cesium fills the
    // six cube faces with fixed world axes in computeOmnidirectional.
    Cartesian3.clone(this.options.observerPosition, this.camera.position);
    this.shadowAdapter.setRadius(this.options.maximumDistance);
  }

  private createTerrainMaterial() {
    const material = new Material({
      translucent: true,
      fabric: {
        type: "TerriaViewshed3DTerrain_v3",
        uniforms: {
          viewshedShadowCube: Material.DefaultCubeMapId,
          viewshedObserverPositionEC: new Cartesian3(),
          viewshedMaximumDistance: this.options.maximumDistance,
          viewshedDepthBias: this.shadowAdapter.depthBias,
          viewshedShadowReady: 0.0,
          viewshedVisibleColor: this.options.visibleColor
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

    setDynamicUniform("viewshedShadowCube", () => this.shadowAdapter.texture);
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
    setDynamicUniform("viewshedShadowReady", () =>
      this.shadowAdapter.hasTexture ? 1.0 : 0.0
    );
    setDynamicUniform("viewshedVisibleColor", () => this.options.visibleColor);
    return material;
  }

  private validateOptions(options: Pick<Viewshed3DOptions, "maximumDistance">) {
    if (options.maximumDistance <= 1) {
      throw new Error("Viewshed3D needs a range above one metre");
    }
  }

  private static normaliseOptions(options: Viewshed3DOptions) {
    const alpha = options.alpha ?? DEFAULT_VIEWSHED_ALPHA;
    return {
      ...options,
      alpha,
      visibleColor: (options.visibleColor ?? Color.LIME).withAlpha(alpha),
      textureSize: options.textureSize ?? DEFAULT_VIEWSHED_TEXTURE_SIZE
    };
  }
}
