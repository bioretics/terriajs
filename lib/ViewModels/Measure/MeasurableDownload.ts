import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityCollection from "terriajs-cesium/Source/DataSources/EntityCollection";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import exportKml from "terriajs-cesium/Source/DataSources/exportKml";
import PointGraphics from "terriajs-cesium/Source/DataSources/PointGraphics";
import DataUri from "../../Core/DataUri";
import { exportKmlResultKml } from "terriajs-cesium";
import { MeasurableGeometry } from "./MeasurableGeometryManager";
import i18next from "i18next";

export interface DownloadLink {
  key: string;
  href?: string | false;
  download?: string;
  label: string;
}

export default class MeasurableDownload {
  private ellipsoid: Ellipsoid;
  private name: string;
  private pathNotes: string;

  private kmlMultiPathPolygon: string | undefined;
  private kmlMultiPathLines: string | undefined;
  private kmlPolygon: string | undefined;
  private kmlLines: string | undefined;
  private kmlPoints: string | undefined;

  constructor(ellipsoid: Ellipsoid, name: string = "", pathNotes: string = "") {
    this.ellipsoid = ellipsoid;
    this.name = name;
    this.pathNotes = pathNotes;
  }

  setName(name: string): void {
    this.name = name;
  }

  setPathNotes(pathNotes: string): void {
    this.pathNotes = pathNotes;
  }

  async initializeKmlData(
    geom: MeasurableGeometry,
    geomList?: MeasurableGeometry[]
  ): Promise<void> {
    if (!this.ellipsoid || !geom) return;

    try {
      this.kmlPolygon = await this.generateKmlPolygon(geom);
      this.kmlLines = await this.generateKmlLines(geom);
      this.kmlPoints = await this.generateKmlPoints(geom);

      if (geomList && geomList.length > 1) {
        this.kmlMultiPathPolygon = await this.generateMultiPathKmlPolygon(
          geomList
        );
        this.kmlMultiPathLines = await this.generateMultiPathKmlLines(geomList);
      }
    } catch (error) {
      console.error("Error generating KML data:", error);
    }
  }

  getDownloadLinks(
    geom: MeasurableGeometry,
    isMultiPath: boolean,
    geomList?: MeasurableGeometry[]
  ): DownloadLink[] {
    const baseDownloads: DownloadLink[] = [
      {
        key: "",
        label: i18next.t("downloadData.formatPlaceholder")
      },
      {
        key: "csv",
        href: DataUri.make("csv", this.generateCsvData(geom)),
        download: `${this.name}_points.csv`,
        label: "CSV"
      },
      {
        key: "kmlPolygon",
        href: this.kmlPolygon
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              this.kmlPolygon
            )
          : false,
        download: `${this.name}_polygon.kml`,
        label: `${i18next.t("downloadData.polygon")} KML`
      },
      {
        key: "kmlLines",
        href: this.kmlLines
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              this.kmlLines
            )
          : false,
        download: `${this.name}_lines.kml`,
        label: `${i18next.t("downloadData.lines")} KML`
      },
      {
        key: "kmlPoints",
        href: this.kmlPoints
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              this.kmlPoints
            )
          : false,
        download: `${this.name}_points.kml`,
        label: `${i18next.t("downloadData.points")} KML`
      },
      {
        key: "jsonPolygon",
        href: DataUri.make("json", this.generateJsonPolygon(geom)),
        download: `${this.name}_polygon.json`,
        label: `${i18next.t("downloadData.polygon")} JSON`
      },
      {
        key: "jsonLines",
        href: DataUri.make("json", this.generateJsonLineStrings(geom)),
        download: `${this.name}_lines.json`,
        label: `${i18next.t("downloadData.lines")} JSON`
      },
      {
        key: "jsonPoints",
        href: DataUri.make("json", this.generateJsonPoints(geom)),
        download: `${this.name}_points.json`,
        label: `${i18next.t("downloadData.points")} JSON`
      },
      {
        key: "gpxPolygon",
        href: DataUri.make("xml", this.generateGpxTracks(geom)),
        download: `${this.name}_polygon.gpx`,
        label: `${i18next.t("downloadData.polygon")} GPX`
      },
      {
        key: "gpxTracks",
        href: DataUri.make("xml", this.generateGpxTracks(geom)),
        download: `${this.name}_lines.gpx`,
        label: `${i18next.t("downloadData.lines")} GPX`
      },
      {
        key: "gpxWaypoints",
        href: DataUri.make("xml", this.generateGpxWaypoints(geom)),
        download: `${this.name}_points.gpx`,
        label: `${i18next.t("downloadData.points")} GPX`
      }
    ];

    const multiPathDownloads: DownloadLink[] = [
      {
        key: "",
        label: i18next.t("downloadData.formatPlaceholder")
      },
      {
        key: "kmlMultiPathLinksPolygon",
        href:
          geomList && this.kmlMultiPathPolygon
            ? DataUri.make(
                "application/vnd.google-earth.kml+xml;charset=utf-8",
                this.kmlMultiPathPolygon
              )
            : false,
        download: `${this.name}_polygon_multipath.kml`,
        label: `${i18next.t("downloadData.polygon")} KML`
      },
      {
        key: "kmlMultiPathLinksLines",
        href:
          geomList && this.kmlMultiPathLines
            ? DataUri.make(
                "application/vnd.google-earth.kml+xml;charset=utf-8",
                this.kmlMultiPathLines
              )
            : false,
        download: `${this.name}_lines_multipath.kml`,
        label: `${i18next.t("downloadData.lines")} KML`
      },
      {
        key: "jsonMultiPathPolygon",
        href: geomList
          ? DataUri.make("json", this.generateMultiPathJsonPolygon(geomList))
          : false,
        download: `${this.name}_polygon_multipath.json`,
        label: `${i18next.t("downloadData.polygon")} JSON`
      },
      {
        key: "jsonMultiPathLines",
        href: geomList
          ? DataUri.make(
              "json",
              this.generateMultiPathJsonLineStrings(geomList)
            )
          : false,
        download: `${this.name}_lines_multipath.json`,
        label: `${i18next.t("downloadData.lines")} JSON`
      }
    ];

    const finalDownloads = isMultiPath ? multiPathDownloads : baseDownloads;

    return finalDownloads
      .filter((download) => download.key === "" || !!download.href)
      .filter((download) => {
        if (geom.onlyPoints) {
          return (
            !download.download?.includes("_lines") &&
            !download.download?.includes("_polygon")
          );
        } else if (geom.isClosed) {
          return (
            !download.download?.includes("_points") &&
            !download.download?.includes("_lines")
          );
        } else {
          return (
            !download.download?.includes("_points") &&
            !download.download?.includes("_polygon")
          );
        }
      });
  }

  downloadFile(link: DownloadLink): void {
    if (link.href && link.download) {
      const a = document.createElement("a");
      a.href = link.href;
      a.download = link.download;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  private generateCsvData(geom: MeasurableGeometry): string {
    const headers = [
      "name",
      "path_notes",
      ...Object.keys(geom.stopPoints[0]),
      "description"
    ].join(",");

    const rows = [headers];

    rows.push(
      ...geom.stopPoints.map((elem, index) =>
        [
          this.name,
          this.pathNotes,
          CesiumMath.toDegrees(elem.longitude),
          CesiumMath.toDegrees(elem.latitude),
          Math.round(elem.height),
          geom.pointDescriptions?.[index] || ""
        ].join(",")
      )
    );

    return rows.join("\n");
  }

  private generateJsonPolygon(geom: MeasurableGeometry): string {
    const coordinates = geom.stopPoints.map((elem) => [
      CesiumMath.toDegrees(elem.longitude),
      CesiumMath.toDegrees(elem.latitude)
    ]);

    if (
      coordinates.length &&
      (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
        coordinates[0][1] !== coordinates[coordinates.length - 1][1])
    ) {
      coordinates.push(coordinates[0]);
    }

    return JSON.stringify({
      name: this.name || "",
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      },
      properties: {
        path_notes: this.pathNotes || ""
      }
    });
  }

  private generateJsonLineStrings(geom: MeasurableGeometry): string {
    return JSON.stringify({
      name: this.name || "",
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: geom.stopPoints.map((elem) => [
          CesiumMath.toDegrees(elem.longitude),
          CesiumMath.toDegrees(elem.latitude),
          Math.round(elem.height)
        ])
      },
      properties: {
        path_notes: geom.pathNotes || ""
      }
    });
  }

  private generateJsonPoints(geom: MeasurableGeometry): string {
    return JSON.stringify({
      name: this.name || "",
      path_notes: this.pathNotes || "",
      type: "FeatureCollection",
      features: geom.stopPoints.map((elem, index) => {
        return {
          type: "Feature",
          properties: {
            description: geom.pointDescriptions?.[index] || ""
          },
          geometry: {
            coordinates: [
              CesiumMath.toDegrees(elem.longitude),
              CesiumMath.toDegrees(elem.latitude),
              elem.height
            ],
            type: "Point"
          }
        };
      })
    });
  }

  private generateGpxTracks(geom: MeasurableGeometry): string {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      <trk>
        <name>${this.name}</name>
        <desc>${this.pathNotes}</desc>
        <trkseg>
          ${geom.stopPoints
            .map(
              (elem) =>
                `<trkpt lat="${CesiumMath.toDegrees(elem.latitude)}"
                  lon="${CesiumMath.toDegrees(elem.longitude)}"
                  ele="${elem.height.toFixed(2)}">
                </trkpt>`
            )
            .join("")}
        </trkseg>
      </trk>
    </gpx>`;
  }

  private generateGpxWaypoints(geom: MeasurableGeometry): string {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      ${geom.stopPoints
        .map((elem, index) => {
          let waypoint = "";
          if (index === 0) {
            waypoint += `<wpt name="Info File" lat="${CesiumMath.toDegrees(
              geom.stopPoints[0].latitude
            )}" lon="${CesiumMath.toDegrees(geom.stopPoints[0].longitude)}">
                             <name>${this.name}</name>
                             <desc>${this.pathNotes}</desc>
                           </wpt>`;
          }
          waypoint += `<wpt name="Tappa ${index}"
                          lat="${CesiumMath.toDegrees(elem.latitude)}"
                          lon="${CesiumMath.toDegrees(elem.longitude)}"
                          ele="${elem.height.toFixed(2)}">
                          <desc>${geom.pointDescriptions?.[index] || ""}</desc>
                        </wpt>`;
          return waypoint;
        })
        .join("")}
    </gpx>`;
  }

  private async generateKmlPolygon(
    geom: MeasurableGeometry
  ): Promise<string | undefined> {
    if (!geom?.stopPoints) return undefined;

    const coords = geom.stopPoints.map((point) => {
      const lon = CesiumMath.toDegrees(point.longitude);
      const lat = CesiumMath.toDegrees(point.latitude);
      return `${lon},${lat}`;
    });

    if (coords[0] !== coords[coords.length - 1]) {
      coords.push(coords[0]);
    }

    const coordsString = coords.join(" ");

    const kml = `<?xml version="1.0" encoding="utf-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document id="root_doc">
          <Folder>
          <Placemark id="0">
              <name>${this.name}</name>
              <description>${this.pathNotes}</description>
              <Style>
                <LineStyle>
                  <color>ff0000ff</color>
                </LineStyle>
                <PolyStyle>
                  <fill>0</fill>
                </PolyStyle>
              </Style>
              <Polygon>
                <altitudeMode>clampToGround</altitudeMode>
                <outerBoundaryIs>
                  <LinearRing>
                    <altitudeMode>clampToGround</altitudeMode>
                    <coordinates>${coordsString}</coordinates>
                  </LinearRing>
                </outerBoundaryIs>
              </Polygon>
            </Placemark>
          </Folder>
        </Document>
      </kml>`;

    return kml;
  }

  private async generateKmlLines(
    geom: MeasurableGeometry
  ): Promise<string | undefined> {
    if (!geom?.stopPoints || !this.ellipsoid) return undefined;

    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: this.ellipsoid
    };

    output.entities.add(
      new Entity({
        id: "0",
        polyline: new PolylineGraphics({
          positions: geom.stopPoints.map((elem) =>
            Cartographic.toCartesian(elem, this.ellipsoid)
          )
        }),
        name: this.name,
        description: this.pathNotes
      })
    );

    const res = (await exportKml(output)) as exportKmlResultKml;
    return res.kml;
  }

  private async generateKmlPoints(
    geom: MeasurableGeometry
  ): Promise<string | undefined> {
    if (!geom?.stopPoints || !this.ellipsoid) return undefined;

    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: this.ellipsoid
    };

    geom.stopPoints.forEach((elem, index) => {
      output.entities.add(
        new Entity({
          id: index.toString(),
          point: new PointGraphics({}),
          position: Cartographic.toCartesian(elem, this.ellipsoid),
          description: geom.pointDescriptions?.[index]
        })
      );
    });

    const res = (await exportKml(output)) as exportKmlResultKml;
    res.kml = res.kml
      .replace(
        /<Document\s+xmlns="">/,
        `<Document xmlns=""><Folder><name>${
          this.name || ""
        }</name><description>${this.pathNotes || ""}</description>`
      )
      .replace(/<\/Document>/, "</Folder></Document>");
    return res.kml;
  }

  private async generateMultiPathKmlPolygon(
    geomList: MeasurableGeometry[]
  ): Promise<string | undefined> {
    if (!geomList?.length) return undefined;

    let polygonsContent = "";
    geomList.forEach((geom, idx) => {
      const coords = geom.stopPoints.map((pt) => {
        const lon = CesiumMath.toDegrees(pt.longitude);
        const lat = CesiumMath.toDegrees(pt.latitude);
        return `${lon},${lat}`;
      });

      if (coords[0] !== coords[coords.length - 1]) {
        coords.push(coords[0]);
      }

      const coordsString = coords.join(" ");

      polygonsContent += `<Placemark id="${idx}">
          <description>${geom.pathNotes ?? ""}</description>
          <Style>
            <LineStyle>
              <color>ff0000ff</color>
            </LineStyle>
            <PolyStyle>
              <fill>0</fill>
            </PolyStyle>
          </Style>
          <Polygon>
            <altitudeMode>clampToGround</altitudeMode>
            <outerBoundaryIs>
              <LinearRing>
                <altitudeMode>clampToGround</altitudeMode>
                <coordinates>${coordsString}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>`;
    });

    return `<?xml version="1.0" encoding="utf-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document id="root_doc">
          <Folder>
          <name>${this.name || ""}</name>
            ${polygonsContent}
          </Folder>
        </Document>
      </kml>`;
  }

  private async generateMultiPathKmlLines(
    geomList: MeasurableGeometry[]
  ): Promise<string | undefined> {
    if (!geomList?.length || !this.ellipsoid) return undefined;

    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: this.ellipsoid
    };

    geomList.forEach((geom, idx) => {
      output.entities.add(
        new Entity({
          id: idx.toString(),
          polyline: new PolylineGraphics({
            positions: geom.stopPoints.map((elem) =>
              Cartographic.toCartesian(elem, this.ellipsoid)
            )
          }),
          description: geom.pathNotes
        })
      );
    });

    const res = (await exportKml(output)) as exportKmlResultKml;
    res.kml = res.kml
      .replace(
        /<Document\s+xmlns="">/,
        `<Document xmlns=""><Folder><name>${this.name || ""}</name>`
      )
      .replace(/<\/Document>/, "</Folder></Document>");
    return res.kml;
  }

  private generateMultiPathJsonPolygon(
    geomList: MeasurableGeometry[]
  ): string {
    return JSON.stringify({
      type: "FeatureCollection",
      name: this.name || "",
      features: geomList.map((geom) => {
        const coordinates = geom.stopPoints.map((elem) => [
          CesiumMath.toDegrees(elem.longitude),
          CesiumMath.toDegrees(elem.latitude)
        ]);

        if (
          coordinates.length &&
          (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1])
        ) {
          coordinates.push(coordinates[0]);
        }

        return {
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: [[coordinates]]
          },
          properties: {
            path_notes: geom.pathNotes
          }
        };
      })
    });
  }

  private generateMultiPathJsonLineStrings(
    geomList: MeasurableGeometry[]
  ): string {
    return JSON.stringify({
      type: "FeatureCollection",
      name: this.name || "",
      features: geomList.map((geom) => ({
        type: "Feature",
        geometry: {
          type: "MultiLineString",
          coordinates: [
            geom.stopPoints.map((elem) => [
              CesiumMath.toDegrees(elem.longitude),
              CesiumMath.toDegrees(elem.latitude),
              Math.round(elem.height)
            ])
          ]
        },
        properties: {
          path_notes: geom.pathNotes
        }
      }))
    });
  }
}
