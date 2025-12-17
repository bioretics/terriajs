import i18next from "i18next";
import { computed, makeObservable, override, runInAction } from "mobx";
import isDefined from "../../../Core/isDefined";
import TerriaError from "../../../Core/TerriaError";
import AutoRefreshingMixin from "../../../ModelMixins/AutoRefreshingMixin";
import TableMixin from "../../../ModelMixins/TableMixin";
import UrlMixin from "../../../ModelMixins/UrlMixin";
import Csv from "../../../Table/Csv";
import TableAutomaticStylesStratum from "../../../Table/TableAutomaticStylesStratum";
import CsvCatalogItemTraits from "../../../Traits/TraitsClasses/CsvCatalogItemTraits";
import CreateModel from "../../Definition/CreateModel";
import type { BaseModel } from "../../Definition/Model";
import StratumOrder from "../../Definition/StratumOrder";
import type HasLocalData from "../../HasLocalData";
import Terria from "../../Terria";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import type ExportableFormat from "../../../ViewModels/Measure/ExportableFormat";
import type { MeasurableGeometry } from "../../../ViewModels/Measure/MeasurableGeometryManager";
import type { DownloadLink } from "../../../ViewModels/Measure/MeasurableDownload";
import DataUri from "../../../Core/DataUri";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import type Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";

// Types of CSVs:
// - Points - Latitude and longitude columns or address
// - Regions - Region column
// - Chart - No spatial reference at all
// - Other geometry - e.g. a WKT column

// Types of time varying:
// - ID+time column -> point moves, region changes (continuously?) over time
// - points, no ID, time -> "blips" with a duration (perhaps provided by another column)
//
export default class CsvCatalogItem
  extends AutoRefreshingMixin(
    TableMixin(UrlMixin(CreateModel(CsvCatalogItemTraits)))
  )
  implements HasLocalData, ExportableFormat
{
  static get type() {
    return "csv";
  }

  private _csvFile?: File;

  constructor(
    id: string | undefined,
    terria: Terria,
    sourceReference: BaseModel | undefined
  ) {
    super(id, terria, sourceReference);
    makeObservable(this);
    this.strata.set(
      TableAutomaticStylesStratum.stratumName,
      new TableAutomaticStylesStratum(this)
    );
  }

  get type() {
    return CsvCatalogItem.type;
  }

  setFileInput(file: File) {
    this._csvFile = file;
  }

  @computed
  get hasLocalData(): boolean {
    return isDefined(this._csvFile);
  }

  @override
  get cacheDuration(): string {
    for (const stratum of this.strataTopToBottom.values()) {
      const duration = (stratum as any).cacheDuration as string | undefined;
      if (isDefined(duration)) return duration;
    }

    return "1d";
  }

  private formatNumber(value: number | undefined, digits: number): string {
    if (typeof value !== "number" || !isFinite(value)) return "";
    return value.toFixed(digits);
  }

  private generatePointsCsvData(
    geom: MeasurableGeometry,
    name: string
  ): string {
    const isPointsOnly = geom.onlyPoints === true;
    const headers = isPointsOnly
      ? [
          "name",
          "path_notes",
          "longitude",
          "latitude",
          "height",
          "description"
        ].join(",")
      : [
          "name",
          "path_notes",
          "longitude",
          "latitude",
          "height",
          "alt_diff",
          "geodetic_distance",
          "air_distance",
          "ground_distance",
          "slope"
        ].join(",");

    if (!geom.stopPoints || geom.stopPoints.length === 0) {
      return headers;
    }

    const rows = [headers];

    const stopGeodeticDistances = geom.stopGeodeticDistances ?? [];
    const stopAirDistances = geom.stopAirDistances ?? [];
    const stopGroundDistances = geom.stopGroundDistances ?? [];

    rows.push(
      ...geom.stopPoints.map((elem, index) => {
        const baseColumns: (string | number)[] = [
          index === 0 ? name : "",
          index === 0 ? geom.pathNotes ?? "" : "",
          CesiumMath.toDegrees(elem.longitude),
          CesiumMath.toDegrees(elem.latitude),
          Math.round(elem.height)
        ];

        if (isPointsOnly) {
          return [...baseColumns, geom.pointDescriptions?.[index] || ""].join(
            ","
          );
        }

        const prev = index > 0 ? geom.stopPoints[index - 1] : undefined;

        const altDiff =
          index > 0 && prev
            ? this.formatNumber(elem.height - prev.height, 0)
            : "";

        const geodeticDistance =
          index > 0 ? this.formatNumber(stopGeodeticDistances[index], 2) : "";
        const airDistance =
          index > 0 ? this.formatNumber(stopAirDistances[index], 2) : "";
        const groundDistance =
          index > 0 ? this.formatNumber(stopGroundDistances[index], 2) : "";

        let slope = "";
        const airDistNum = stopAirDistances[index];
        if (index > 0 && prev && typeof airDistNum === "number" && airDistNum) {
          slope = Math.abs(
            (100 * (elem.height - prev.height)) / airDistNum
          ).toFixed(1);
        }

        return [
          ...baseColumns,
          altDiff,
          geodeticDistance,
          airDistance,
          groundDistance,
          slope
        ].join(",");
      })
    );

    return rows.join("\n");
  }

  static generatePathSummaryCsvData(options: {
    geom: MeasurableGeometry;
    name: string;
    kind: MeasurableSummaryKind;
    ellipsoid?: Ellipsoid;
  }): { csv: string; filename: string } {
    const { geom, name, kind, ellipsoid } = options;
    const pathNotes = geom.pathNotes ?? "";

    if (kind === "polygon") {
      const geoAreaM2 = geom.geodeticArea ?? 0;
      const airAreaM2 = geom.airArea ?? 0;

      const headers = [
        "name",
        "path_notes",
        "geodetic_area_km2",
        "geodetic_area_ha",
        "air_area_km2",
        "air_area_ha",
        "geodetic_perimeter",
        "air_perimeter",
        "ground_perimeter"
      ].join(",");

      const values = [
        name,
        pathNotes,
        formatSummaryNumber(geoAreaM2 > 0 ? geoAreaM2 / 1_000_000 : 0, 6),
        formatSummaryNumber(geoAreaM2 > 0 ? geoAreaM2 * 0.0001 : 0, 4),
        formatSummaryNumber(airAreaM2 > 0 ? airAreaM2 / 1_000_000 : 0, 6),
        formatSummaryNumber(airAreaM2 > 0 ? airAreaM2 * 0.0001 : 0, 4),
        formatSummaryNumber(geom.geodeticDistance ?? 0, 2),
        formatSummaryNumber(geom.airDistance ?? 0, 2),
        formatSummaryNumber(geom.groundDistance ?? 0, 2)
      ].join(",");

      return {
        csv: [headers, values].join("\n"),
        filename: `${name}_path.csv`
      };
    }

    const { altMin, altMax } = getAltMinMax(geom.stopPoints);
    const bearing = getBearingDegrees(geom.stopPoints, ellipsoid);
    const altDiff = getAltDiff(geom.stopPoints);

    if (kind === "line") {
      const headers = [
        "name",
        "path_notes",
        "alt_min",
        "alt_max",
        "bearing",
        "alt_diff",
        "geodetic_distance",
        "air_distance",
        "ground_distance"
      ].join(",");

      const values = [
        name,
        pathNotes,
        formatSummaryNumber(altMin, 0),
        formatSummaryNumber(altMax, 0),
        bearing,
        altDiff,
        formatSummaryNumber(geom.geodeticDistance, 2),
        formatSummaryNumber(geom.airDistance, 2),
        formatSummaryNumber(geom.groundDistance, 2)
      ].join(",");

      return {
        csv: [headers, values].join("\n"),
        filename: `${name}_path.csv`
      };
    }

    // points
    const headers = [
      "name",
      "path_notes",
      "alt_min",
      "alt_max",
      "bearing",
      "alt_diff"
    ].join(",");
    const values = [
      name,
      pathNotes,
      formatSummaryNumber(altMin, 0),
      formatSummaryNumber(altMax, 0),
      bearing,
      altDiff
    ].join(",");

    return {
      csv: [headers, values].join("\n"),
      filename: `${name}_path.csv`
    };
  }

  async generateDownloadLinks(
    geom: MeasurableGeometry,
    name: string,
    isMultiPath: boolean
  ): Promise<DownloadLink[]> {
    if (isMultiPath) return [];

    return [
      {
        key: "csv",
        href: DataUri.make("csv", this.generatePointsCsvData(geom, name)),
        download: `${name}_points.csv`,
        label: "CSV"
      }
    ];
  }

  @override
  get _canExportData() {
    return (
      isDefined(this._csvFile) ||
      isDefined(this.csvString) ||
      isDefined(this.url)
    );
  }

  protected async _exportData() {
    if (isDefined(this._csvFile)) {
      return {
        name: (this.name || this.uniqueId)!,
        file: this._csvFile
      };
    }
    if (isDefined(this.csvString)) {
      return {
        name: (this.name || this.uniqueId)!,
        file: new Blob([this.csvString])
      };
    }

    if (isDefined(this.url)) {
      return this.url;
    }

    throw new TerriaError({
      sender: this,
      message: "No data available to download."
    });
  }

  /*
   * The polling URL to use for refreshing data.
   */
  @computed get refreshUrl() {
    return this.polling.url || this.url;
  }

  /*
   * Called by AutoRefreshingMixin to get the polling interval
   */
  @override
  get refreshInterval() {
    if (this.refreshUrl) {
      return this.polling.seconds;
    }
  }

  /*
   * Hook called by AutoRefreshingMixin to refresh data.
   *
   * The refresh happens only if a `refreshUrl` is defined.
   * If `shouldReplaceData` is true, then the new data replaces current data,
   * otherwise new data is appended to current data.
   */
  refreshData() {
    if (!this.refreshUrl) {
      return;
    }

    Csv.parseUrl(
      proxyCatalogItemUrl(this, this.refreshUrl),
      true,
      this.ignoreRowsStartingWithComment
    ).then((dataColumnMajor) => {
      runInAction(() => {
        if (this.polling.shouldReplaceData) {
          this.dataColumnMajor = dataColumnMajor;
        } else {
          this.append(dataColumnMajor);
        }
      });
    });
  }

  public forceLoadTableData(): Promise<string[][]> {
    if (this.csvString !== undefined) {
      return Csv.parseString(
        this.csvString,
        true,
        this.ignoreRowsStartingWithComment
      );
    } else if (this._csvFile !== undefined) {
      return Csv.parseFile(
        this._csvFile,
        true,
        this.ignoreRowsStartingWithComment
      );
    } else if (this.url !== undefined) {
      return Csv.parseUrl(
        proxyCatalogItemUrl(this, this.url),
        true,
        this.ignoreRowsStartingWithComment
      );
    } else {
      return Promise.reject(
        new TerriaError({
          sender: this,
          title: i18next.t("models.csv.unableToLoadItemTitle"),
          message: i18next.t("models.csv.unableToLoadItemMessage")
        })
      );
    }
  }

  public async sampleFromCsvData(): Promise<void> {
    const data = await this.forceLoadTableData();

    const columns = data.reduce((acc, row) => {
      const [columnName, ...values] = row;
      acc[columnName] = values;
      return acc;
    }, {} as { [key: string]: any[] });

    const path_notes = columns["path_notes"]?.[0] || "";
    const longitudes = columns["longitude"] || [];
    const latitudes = columns["latitude"] || [];
    const heights = columns["height"] || [];
    const descriptions = columns["description"] || [];

    const positions = longitudes.map((longitude: number, i: number) =>
      Cartographic.fromDegrees(longitude, latitudes[i], heights[i])
    );

    if (!this.terria?.cesium?.scene) {
      return;
    }
    const terrainProvider = this.terria.cesium.scene.terrainProvider;

    const resolvedPositions = positions.every((pos) => pos.height < 1)
      ? await sampleTerrainMostDetailed(terrainProvider, positions)
      : positions;

    this.terria.measurableGeometryManager[
      this.terria.measurableGeometryIndex
    ].sampleFromCartographics(
      resolvedPositions,
      false,
      true,
      descriptions,
      path_notes
    );
  }
}

export type MeasurableSummaryKind = "points" | "line" | "polygon";

function formatSummaryNumber(
  value: number | undefined,
  digits: number
): string {
  if (typeof value !== "number" || !isFinite(value)) return "";
  return value.toFixed(digits);
}

function getAltMinMax(stopPoints: MeasurableGeometry["stopPoints"]) {
  const heights = (stopPoints ?? [])
    .map((p) => p.height)
    .filter((h) => isFinite(h));
  const altMin = heights.length > 0 ? Math.min(...heights) : undefined;
  const altMax = heights.length > 0 ? Math.max(...heights) : undefined;
  return { altMin, altMax };
}

function getAltDiff(stopPoints: MeasurableGeometry["stopPoints"]) {
  const start = stopPoints?.[0];
  const end = stopPoints?.at(-1);
  if (!start || !end) return "";
  if (!isFinite(start.height) || !isFinite(end.height)) return "";
  return (end.height - start.height).toFixed(0);
}

function getBearingDegrees(
  stopPoints: MeasurableGeometry["stopPoints"],
  ellipsoid?: Ellipsoid
): string {
  if (!ellipsoid) return "";
  if (!stopPoints || stopPoints.length < 2) return "";
  const start = stopPoints[0];
  const end = stopPoints.at(-1);
  if (!end) return "";
  const geo = new EllipsoidGeodesic(start, end, ellipsoid);
  return ((CesiumMath.toDegrees(geo.startHeading) + 360) % 360).toFixed(0);
}

export function getSummaryKind(options: {
  geom: MeasurableGeometry;
  activeToolIsPolygon: boolean;
}): MeasurableSummaryKind {
  const { geom, activeToolIsPolygon } = options;
  if (activeToolIsPolygon || geom.hasArea || geom.isClosed) return "polygon";
  if (geom.onlyPoints) return "points";
  return "line";
}

export const generatePathSummaryCsvData =
  CsvCatalogItem.generatePathSummaryCsvData;

StratumOrder.addLoadStratum(TableAutomaticStylesStratum.stratumName);
