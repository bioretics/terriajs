import React, { useState } from "react";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityCollection from "terriajs-cesium/Source/DataSources/EntityCollection";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import exportKml from "terriajs-cesium/Source/DataSources/exportKml";
import PointGraphics from "terriajs-cesium/Source/DataSources/PointGraphics";
import DataUri from "../../Core/DataUri";
import Icon from "../../Styled/Icon";
import Styles from "./measurable-download.scss";
import { exportKmlResultKml } from "terriajs-cesium";
import { MeasurableGeometry } from "../../ViewModels/MeasurableGeometryManager";
import i18next from "i18next";
import { useTheme } from "styled-components";
import { Button } from "../../Styled/Button";
import Select from "../../Styled/Select";

interface Props {
  geom: MeasurableGeometry;
  name: string;
  pathNotes: string;
  ellipsoid: Ellipsoid;
}

const MeasurableDownload = (props: Props) => {
  const { geom, name, pathNotes, ellipsoid } = props;
  const theme = useTheme();
  const [selectedFormat, setSelectedFormat] = React.useState<string>("");

  const [kmlLines, setKmlLines] = useState<string>();
  const [kmlPoints, setKmlPoints] = useState<string>();

  const getLinks = () => {
    return [
      {
        key: "",
        label: i18next.t("downloadData.formatPlaceholder")
      },
      {
        key: "csv",
        href: DataUri.make("csv", generateCsvData(geom)),
        download: `${name}.csv`,
        label: "CSV"
      },
      {
        key: "kmlLines",
        href: kmlLines
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              kmlLines
            )
          : false,
        download: `${name}_lines.kml`,
        label: `${i18next.t("downloadData.lines")} KML`
      },
      {
        key: "kmlPoints",
        href: kmlPoints
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              kmlPoints
            )
          : false,
        download: `${name}_points.kml`,
        label: `${i18next.t("downloadData.points")} KML`
      },
      {
        key: "jsonLines",
        href: DataUri.make("json", generateJsonLineStrings(geom)),
        download: `${name}_lines.json`,
        label: `${i18next.t("downloadData.lines")} JSON`
      },
      {
        key: "jsonPoints",
        href: DataUri.make("json", generateJsonPoints(geom)),
        download: `${name}_points.json`,
        label: `${i18next.t("downloadData.points")} JSON`
      },
      {
        key: "gpxTracks",
        href: DataUri.make("xml", generateGpxTracks(geom)),
        download: `${name}_lines.gpx`,
        label: `${i18next.t("downloadData.lines")} GPX`
      },
      {
        key: "gpxWaypoints",
        href: DataUri.make("xml", generateGpxWaypoints(geom)),
        download: `${name}_points.gpx`,
        label: `${i18next.t("downloadData.points")} GPX`
      }
    ].filter((download) => download.key === "" || !!download.href);
  };

  const generateKmlLines = async (geom: MeasurableGeometry) => {
    if (!geom?.stopPoints) {
      return;
    }
    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: ellipsoid
    };
    output.entities.add(
      new Entity({
        id: "0",
        polyline: new PolylineGraphics({
          positions: geom.stopPoints.map((elem) =>
            Cartographic.toCartesian(elem, ellipsoid)
          )
        }),
        description: `
          <p id="name"><strong>${name}</strong></p>
          <p id="pathNotes"><strong>${pathNotes}</strong></p>
        `
      })
    );

    const res = (await exportKml(output)) as exportKmlResultKml;
    return res.kml;
  };

  const generateKmlPoints = async (geom: MeasurableGeometry) => {
    if (!geom?.stopPoints) {
      return;
    }
    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: ellipsoid
    };
    geom.stopPoints.forEach((elem, index) => {
      output.entities.add(
        new Entity({
          id: index.toString(),
          point: new PointGraphics({}),
          position: Cartographic.toCartesian(elem, ellipsoid),
          description: `
            <p id="name"><strong>${name}</strong></p>
            <p id="pathNotes"><strong>${pathNotes}</strong></p>
          `
        })
      );
    });

    const res = (await exportKml(output)) as exportKmlResultKml;

    return res.kml;
  };

  const generateJsonLineStrings = (geom: MeasurableGeometry) => {
    return JSON.stringify({
      name: name || "",
      path_notes: pathNotes || "",
      type: "LineString",
      coordinates: geom.stopPoints.map((elem) => [
        CesiumMath.toDegrees(elem.longitude),
        CesiumMath.toDegrees(elem.latitude),
        Math.round(elem.height)
      ])
    });
  };

  const generateJsonPoints = (geom: MeasurableGeometry) => {
    return JSON.stringify({
      name: name || "",
      path_notes: pathNotes || "",
      type: "FeatureCollection",
      features: geom.stopPoints.map((elem) => {
        return {
          type: "Feature",
          properties: {},
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
  };

  const generateGpxTracks = (geom: MeasurableGeometry): string => {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      <trk>
        <name>${name}</name>
        <desc>${pathNotes}</desc>
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
  };

  const generateGpxWaypoints = (geom: MeasurableGeometry): string => {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      ${geom.stopPoints
        .map(
          (elem, index) =>
            `<wpt name="Tappa ${index}"
              lat="${CesiumMath.toDegrees(elem.latitude)}"
              lon="${CesiumMath.toDegrees(elem.longitude)}"
              ele="${elem.height.toFixed(2)}">
            </wpt>`
        )
        .join("")}
    </gpx>`;
  };

  const generateCsvData = (geom: MeasurableGeometry) => {
    const headers = [
      "name",
      "path_notes",
      ...Object.keys(geom.stopPoints[0])
    ].join(",");

    const rows = geom.stopPoints.map((elem) => {
      return [
        name || "",
        pathNotes || "",
        CesiumMath.toDegrees(elem.longitude),
        CesiumMath.toDegrees(elem.latitude),
        Math.round(elem.height)
      ].join(",");
    });

    return [headers, ...rows].join("\n");
  };

  const icon = (
    <span className={Styles.iconDownload}>
      <Icon glyph={Icon.GLYPHS.opened} />
    </span>
  );

  if (ellipsoid) {
    generateKmlLines(geom).then((res) => {
      setKmlLines(res);
    });
    generateKmlPoints(geom).then((res) => {
      setKmlPoints(res);
    });
  }

  const handleDownload = () => {
    const links = getLinks();
    const linkObj = links.find((link) => link.key === selectedFormat);
    if (linkObj && linkObj.href) {
      const a = document.createElement("a");
      a.href = linkObj.href as string;
      a.download = linkObj.download;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <Select
        css={`
          padding-top: 5px;
        `}
        value={selectedFormat}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setSelectedFormat(e.target.value)
        }
        className={Styles.dropdownList}
      >
        {getLinks().map((link) => (
          <option key={link.key} value={link.key}>
            {link.label}
          </option>
        ))}
      </Select>
      <Button
        css={`
          color: ${theme.textLight};
          background: ${theme.colorPrimary};
          margin-left: 10px;
        `}
        onClick={handleDownload}
        disabled={!name || selectedFormat === ""}
      >
        {i18next.t("Download")}
      </Button>
    </div>
  );
};

export default MeasurableDownload;
