import i18next from "i18next";
import {
  action,
  computed,
  makeObservable,
  observable,
  override,
  runInAction
} from "mobx";
import type proj4 from "proj4";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Color from "terriajs-cesium/Source/Core/Color";
import HeadingPitchRoll from "terriajs-cesium/Source/Core/HeadingPitchRoll";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Transforms from "terriajs-cesium/Source/Core/Transforms";
import CustomShader from "terriajs-cesium/Source/Scene/Model/CustomShader";
import loadBlob from "../../../Core/loadBlob";
import type { PlyModel } from "../../../Core/ply/plyToGlb";
import type {
  PlyWorkerRequest,
  PlyWorkerResponse
} from "../../../Core/ply/plyWorker";
import TerriaError from "../../../Core/TerriaError";
import Proj4Definitions from "../../../Map/Vector/Proj4Definitions";
import GltfMixin from "../../../ModelMixins/GltfMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import PlyCatalogItemTraits from "../../../Traits/TraitsClasses/PlyCatalogItemTraits";
import CommonStrata from "../../Definition/CommonStrata";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import HasLocalData from "../../HasLocalData";
import {
  SelectableDimension,
  SelectableDimensionGroup,
  SelectableDimensionNumeric
} from "../../SelectableDimensions/SelectableDimensions";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";

const LARGE_COORDINATE = 100000;

const COMMON_CRS = [
  { id: "EPSG:7791", name: "EPSG:7791 - RDN2008 / UTM 32N" },
  { id: "EPSG:6707", name: "EPSG:6707 - RDN2008 / UTM 32N (N-E)" },
  { id: "EPSG:25832", name: "EPSG:25832 - ETRS89 / UTM 32N" },
  { id: "EPSG:25833", name: "EPSG:25833 - ETRS89 / UTM 33N" },
  { id: "EPSG:32632", name: "EPSG:32632 - WGS 84 / UTM 32N" },
  { id: "EPSG:32633", name: "EPSG:32633 - WGS 84 / UTM 33N" },
  { id: "EPSG:3003", name: "EPSG:3003 - Monte Mario / Italy zone 1" },
  { id: "EPSG:3004", name: "EPSG:3004 - Monte Mario / Italy zone 2" }
];

interface ProjectedPlacement {
  longitude: number;
  latitude: number;
  height: number;
  convergence: number;
}

async function convertInWorker(
  request: PlyWorkerRequest
): Promise<PlyWorkerResponse> {
  const PlyWorker = (
    await import("worker-loader?filename=ply.[contenthash].worker.js!../../../Core/ply/plyWorker")
  ).default;
  const worker = new PlyWorker();
  try {
    return await new Promise<PlyWorkerResponse>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<PlyWorkerResponse>) =>
        resolve(event.data);
      worker.onerror = (event) => reject(new Error(event.message));
      worker.postMessage(request, [request.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

export default class PlyCatalogItem
  extends UrlMixin(GltfMixin(CreateModel(PlyCatalogItemTraits)))
  implements HasLocalData
{
  static readonly type = "ply";

  @observable hasLocalData = false;

  @observable.ref
  private model: (Omit<PlyModel, "glb"> & { url: string }) | undefined;

  @observable.ref
  private proj4: typeof proj4 | undefined;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
    this.setTrait(CommonStrata.defaults, "upAxis", "Z");
    this.setTrait(CommonStrata.defaults, "forwardAxis", "X");
    this.setTrait(CommonStrata.defaults, "opacity", 1);
  }

  get type() {
    return PlyCatalogItem.type;
  }

  @action
  setFileInput(file: File | Blob) {
    const dataUrl = URL.createObjectURL(file);
    this.setTrait(CommonStrata.user, "url", dataUrl);
    this.hasLocalData = true;
  }

  @computed
  protected get gltfModelUrl() {
    return this.model?.url;
  }

  protected override async forceLoadMetadata(): Promise<void> {
    const proj4 = (await import("proj4-fully-loaded"))
      .default as typeof import("proj4").default;
    runInAction(() => {
      this.proj4 = proj4;
    });
  }

  protected override async forceLoadMapItems(): Promise<void> {
    const url = this.url;
    const maximumPoints = this.maximumPoints;
    const maximumFileSizeMb = this.maximumFileSizeMb;
    if (url === undefined) return;

    const title = i18next.t(($) => $.models.ply.errorTitle);
    const blob = await loadBlob(proxyCatalogItemUrl(this, url));
    const sizeMb = blob.size / (1024 * 1024);
    if (sizeMb > maximumFileSizeMb) {
      throw new TerriaError({
        title,
        importance: 1,
        message: i18next.t(($) => $.models.ply.errors.tooLarge, {
          size: Math.ceil(sizeMb),
          max: maximumFileSizeMb
        })
      });
    }

    const response = await convertInWorker({
      buffer: await blob.arrayBuffer(),
      maximumPoints
    });
    if ("error" in response) {
      const { code, message } = response.error;
      throw new TerriaError({
        title,
        importance: 1,
        message: `${i18next.t(($) => $.models.ply.errors[code])}\n\n${i18next.t(
          ($) => $.models.ply.errorDetails,
          { details: message }
        )}`
      });
    }

    const { glb, ...model } = response.model;
    const glbUrl = URL.createObjectURL(
      new Blob([glb], { type: "model/gltf-binary" })
    );
    runInAction(() => {
      if (this.model) URL.revokeObjectURL(this.model.url);
      this.model = { ...model, url: glbUrl };
      if (this.crs === undefined) this.setDefaultOrigin(model.size);
    });
  }

  private setDefaultOrigin(size: [number, number, number]) {
    const { longitude, latitude, height } = this.origin;
    if (
      longitude !== undefined &&
      latitude !== undefined &&
      height !== undefined
    ) {
      return;
    }
    const center = Rectangle.center(
      this.terria.currentViewer.getCurrentCameraView().rectangle as Rectangle
    );
    const ground = this.terria.cesium?.scene.globe.getHeight(center) ?? 0;
    this.origin.setTrait(
      CommonStrata.defaults,
      "longitude",
      CesiumMath.toDegrees(center.longitude)
    );
    this.origin.setTrait(
      CommonStrata.defaults,
      "latitude",
      CesiumMath.toDegrees(center.latitude)
    );
    this.origin.setTrait(
      CommonStrata.defaults,
      "height",
      ground + (size[2] / 2) * (this.scale ?? 1)
    );
  }

  @computed
  private get projection():
    | { placement: ProjectedPlacement }
    | { warning: string }
    | undefined {
    const crs = this.crs?.trim().toUpperCase();
    const center = this.model?.center;
    const proj4 = this.proj4;
    if (!crs || !center || !proj4) return undefined;

    const invalid = {
      warning: i18next.t(($) => $.models.ply.invalidCrs, { crs })
    };
    try {
      const definition = Proj4Definitions[crs] ?? crs;
      const { projName } = new proj4.Proj(definition) as { projName?: string };
      const converter = proj4(definition, "EPSG:4326");
      if (projName === "longlat") {
        return {
          warning: i18next.t(($) => $.models.ply.geographicCrs, { crs })
        };
      }
      const [longitude, latitude] = converter.forward([center[0], center[1]]);
      const [northLongitude, northLatitude] = converter.forward([
        center[0],
        center[1] + 1
      ]);
      if (
        ![longitude, latitude, northLongitude, northLatitude].every(
          Number.isFinite
        )
      ) {
        return invalid;
      }
      const convergence = CesiumMath.toDegrees(
        Math.atan2(
          (northLongitude - longitude) *
            Math.cos(CesiumMath.toRadians(latitude)),
          northLatitude - latitude
        )
      );
      return {
        placement: {
          longitude,
          latitude,
          height: center[2] + this.heightOffset,
          convergence
        }
      };
    } catch {
      return invalid;
    }
  }

  @computed
  private get projectedPlacement() {
    const projection = this.projection;
    return projection && "placement" in projection
      ? projection.placement
      : undefined;
  }

  @override
  get cesiumPosition(): Cartesian3 {
    const placement = this.projectedPlacement;
    return placement
      ? Cartesian3.fromDegrees(
          placement.longitude,
          placement.latitude,
          placement.height
        )
      : super.cesiumPosition;
  }

  @override
  get cesiumRotation(): Quaternion {
    const { heading = 0, pitch = 0, roll = 0 } = this.rotation;
    const convergence = this.projectedPlacement?.convergence ?? 0;
    return Transforms.headingPitchRollQuaternion(
      this.cesiumPosition,
      HeadingPitchRoll.fromDegrees(heading + convergence, pitch, roll)
    );
  }

  @override
  get disableZoomTo() {
    return this.projectedPlacement === undefined && super.disableZoomTo;
  }

  protected get modelColor() {
    return Color.WHITE.withAlpha(this.opacity);
  }

  @computed
  protected get modelCustomShader() {
    if (!this.model?.isPointCloud) return undefined;
    return new CustomShader({
      vertexShaderText: `void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
        vsOutput.pointSize = ${this.pointSize.toFixed(1)};
      }`
    });
  }

  @override
  get shortReport(): string | undefined {
    if (this.terria.currentViewer.type === "Leaflet" || !this.model) {
      return super.shortReport;
    }
    const projection = this.projection;
    const { center, vertexCount, sourceVertexCount } = this.model;
    const notes = [
      projection && "warning" in projection ? projection.warning : undefined,
      !this.crs &&
      Math.max(Math.abs(center[0]), Math.abs(center[1])) > LARGE_COORDINATE
        ? i18next.t(($) => $.models.ply.largeCoordinates)
        : undefined,
      vertexCount < sourceVertexCount
        ? i18next.t(($) => $.models.ply.decimated, {
            shown: vertexCount.toLocaleString(),
            total: sourceVertexCount.toLocaleString()
          })
        : undefined,
      super.shortReport
    ].filter((note) => note !== undefined);
    return notes.length > 0 ? notes.join("\n\n") : undefined;
  }

  @override
  get selectableDimensions(): SelectableDimension[] {
    return [...super.selectableDimensions, this.georeferencingDimension];
  }

  @computed
  private get georeferencingDimension(): SelectableDimensionGroup {
    const labels = i18next.t(($) => $.models.ply.georeferencing, {
      returnObjects: true
    });
    const numeric = (
      id: string,
      name: string,
      value: number | undefined,
      set: (stratumId: string, value: number) => void
    ): SelectableDimensionNumeric => ({
      type: "numeric",
      id,
      name,
      value,
      setDimensionValue: (stratumId, value) => {
        if (value !== undefined && Number.isFinite(value)) {
          runInAction(() => set(stratumId, value));
        }
      }
    });

    const crs = this.crs;
    const crsOptions =
      crs === undefined || COMMON_CRS.some((option) => option.id === crs)
        ? COMMON_CRS
        : [{ id: crs, name: crs }, ...COMMON_CRS];

    return {
      type: "group",
      id: "ply-georeferencing",
      name: labels.name,
      selectableDimensions: [
        {
          type: "select",
          id: "crs",
          name: labels.crs,
          options: crsOptions,
          selectedId: crs,
          allowUndefined: true,
          allowCustomInput: true,
          undefinedLabel: labels.crsNone,
          setDimensionValue: (stratumId, value) =>
            runInAction(() =>
              this.setTrait(stratumId, "crs", value?.trim() || undefined)
            )
        },
        ...(crs === undefined
          ? [
              numeric(
                "longitude",
                labels.longitude,
                this.origin.longitude,
                (s, v) => this.origin.setTrait(s, "longitude", v)
              ),
              numeric(
                "latitude",
                labels.latitude,
                this.origin.latitude,
                (s, v) => this.origin.setTrait(s, "latitude", v)
              ),
              numeric("height", labels.height, this.origin.height, (s, v) =>
                this.origin.setTrait(s, "height", v)
              )
            ]
          : [
              numeric(
                "heightOffset",
                labels.heightOffset,
                this.heightOffset,
                (s, v) => this.setTrait(s, "heightOffset", v)
              )
            ]),
        numeric("heading", labels.heading, this.rotation.heading ?? 0, (s, v) =>
          this.rotation.setTrait(s, "heading", v)
        ),
        numeric("pitch", labels.pitch, this.rotation.pitch ?? 0, (s, v) =>
          this.rotation.setTrait(s, "pitch", v)
        ),
        numeric("roll", labels.roll, this.rotation.roll ?? 0, (s, v) =>
          this.rotation.setTrait(s, "roll", v)
        ),
        numeric("scale", labels.scale, this.scale ?? 1, (s, v) =>
          this.setTrait(s, "scale", v)
        ),
        ...(this.model?.isPointCloud
          ? [
              numeric("pointSize", labels.pointSize, this.pointSize, (s, v) =>
                this.setTrait(s, "pointSize", v)
              )
            ]
          : [])
      ]
    };
  }
}
