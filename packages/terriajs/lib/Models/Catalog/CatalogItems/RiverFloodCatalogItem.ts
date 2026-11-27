import i18next from "i18next";
import {
  computed,
  makeObservable,
  observable,
  override,
  runInAction
} from "mobx";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import loadJson from "../../../Core/loadJson";
import TerriaError from "../../../Core/TerriaError";
import {
  downstreamProfile,
  linesFromGeoJson,
  resampleLine,
  riverSurfaceMesh,
  SurfaceMesh,
  surfaceGeometry
} from "../../../Core/water/waterSurface";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import WaterSurfaceMixin from "../../../ModelMixins/WaterSurfaceMixin";
import RiverFloodCatalogItemTraits from "../../../Traits/TraitsClasses/RiverFloodCatalogItemTraits";
import { RectangleTraits } from "../../../Traits/TraitsClasses/MappableTraits";
import CommonStrata from "../../Definition/CommonStrata";
import createStratumInstance from "../../Definition/createStratumInstance";
import CreateModel from "../../Definition/CreateModel";
import { ModelConstructorParameters } from "../../Definition/Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";

export default class RiverFloodCatalogItem extends UrlMixin(
  WaterSurfaceMixin(CreateModel(RiverFloodCatalogItemTraits))
) {
  static readonly type = "river-flood";

  @observable.ref
  private surfaces: SurfaceMesh[] | undefined;

  @observable
  private profileFromTerrain = true;

  constructor(...args: ModelConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  get type() {
    return RiverFloodCatalogItem.type;
  }

  protected async forceLoadMapItems(): Promise<void> {
    const url = this.url;
    const spacing = this.sampleSpacing;
    const halfWidth = this.halfWidth;
    const terrainProvider = this.terria.cesium?.terrainProvider;
    if (url === undefined) return;

    const lines = linesFromGeoJson(
      await loadJson(proxyCatalogItemUrl(this, url))
    ).filter((line) => line.length > 1);
    if (lines.length === 0) {
      throw new TerriaError({
        title: i18next.t(($) => $.models.waterSurface.errorTitle),
        message: i18next.t(($) => $.models.waterSurface.noRiverLine),
        importance: 1
      });
    }

    const hasTerrain = terrainProvider?.availability !== undefined;
    const surfaces = await Promise.all(
      lines.map(async (line) => {
        const samples = resampleLine(line, spacing);
        const heights = hasTerrain
          ? (
              await sampleTerrainMostDetailed(
                terrainProvider!,
                samples.map((s) =>
                  Cartographic.fromDegrees(s.longitude, s.latitude)
                )
              )
            ).map((c) => c.height)
          : samples.map(() => 0);
        return riverSurfaceMesh(
          samples,
          downstreamProfile(heights),
          halfWidth,
          Math.min(spacing, halfWidth / 2)
        );
      })
    );

    const points = surfaces.flatMap((mesh) => mesh.points);
    const longitudes = points.map((p) => p.longitude);
    const latitudes = points.map((p) => p.latitude);
    runInAction(() => {
      this.surfaces = surfaces;
      this.profileFromTerrain = hasTerrain;
      this.setTrait(
        CommonStrata.defaults,
        "rectangle",
        createStratumInstance(RectangleTraits, {
          west: Math.min(...longitudes),
          south: Math.min(...latitudes),
          east: Math.max(...longitudes),
          north: Math.max(...latitudes)
        })
      );
    });
  }

  @override
  get shortReport(): string | undefined {
    if (
      this.terria.currentViewer.type === "Leaflet" ||
      this.profileFromTerrain
    ) {
      return super.shortReport;
    }
    return i18next.t(($) => $.models.waterSurface.noTerrain);
  }

  @computed
  protected get waterSurfaceGeometry() {
    return this.surfaces ? surfaceGeometry(this.surfaces) : undefined;
  }
}
