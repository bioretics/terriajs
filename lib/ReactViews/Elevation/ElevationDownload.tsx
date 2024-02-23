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
import Styles from "./elevation-download.scss";
import { exportKmlResultKml } from "terriajs-cesium";
import { PathCustom } from "../../ViewModels/PathManager";

const Dropdown = require("../Generic/Dropdown");

interface Props {
  path: PathCustom;
  name: string;
  ellipsoid: Ellipsoid;
}

const ElevationDownload = (props: Props) => {
  const { path, name, ellipsoid } = props;

  const [kmlLines, setKmlLines] = useState<string>();
  const [kmlPoints, setKmlPoints] = useState<string>();

  const getLinks = () => {
    return [
      {
        href: DataUri.make("csv", generateCsvData(path)),
        download: `${name}.csv`,
        label: "CSV"
      },
      {
        href: kmlLines
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              kmlLines
            )
          : false,
        download: `${name}_lines.kml`,
        label: "Linee KML"
      },
      {
        href: kmlPoints
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              kmlPoints
            )
          : false,
        download: `${name}_points.kml`,
        label: "Punti KML"
      },
      {
        href: DataUri.make("json", generateJsonLineStrings(path)),
        download: `${name}_lines.json`,
        label: "Linee JSON"
      },
      {
        href: DataUri.make("json", generateJsonPoints(path)),
        download: `${name}_points.json`,
        label: "Punti JSON"
      },
      {
        href: DataUri.make("xml", generateGpxTracks(path)),
        download: `${name}_lines.gpx`,
        label: "Linee GPX"
      },
      {
        href: DataUri.make("xml", generateGpxWaypoints(path)),
        download: `${name}_points.gpx`,
        label: "Punti GPX"
      }
    ].filter((download) => !!download.href);
  };

  const generateKmlLines = async (path: PathCustom) => {
    if (!path?.stopPoints) {
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
          positions: path.stopPoints.map((elem) =>
            Cartographic.toCartesian(elem, ellipsoid)
          )
        })
      })
    );
    const res = (await exportKml(output)) as exportKmlResultKml;
    return res.kml;
  };

  const generateKmlPoints = async (path: PathCustom) => {
    if (!path?.stopPoints) {
      return;
    }
    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: ellipsoid
    };
    path.stopPoints.forEach((elem, index) => {
      output.entities.add(
        new Entity({
          id: index.toString(),
          point: new PointGraphics({}),
          position: Cartographic.toCartesian(elem, ellipsoid)
        })
      );
    });
    const res = (await exportKml(output)) as exportKmlResultKml;
    return res.kml;
  };

  const generateJsonLineStrings = (path: PathCustom) => {
    return JSON.stringify({
      type: "LineString",
      coordinates: path.stopPoints.map((elem) => [
        CesiumMath.toDegrees(elem.longitude),
        CesiumMath.toDegrees(elem.latitude),
        Math.round(elem.height)
      ])
    });
  };

  const generateJsonPoints = (path: PathCustom) => {
    return JSON.stringify({
      type: "FeatureCollection",
      features: path.stopPoints.map((elem) => {
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

  const generateGpxTracks = (path: PathCustom): string => {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      <trk>
        <name>Percorso</name>
        <desc>Percorso salvato da rer3d-map</desc>
        <trkseg>
          ${path.stopPoints
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

  const generateGpxWaypoints = (path: PathCustom): string => {
    return `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="runtracker">
      <metadata/>
      ${path.stopPoints
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

  const generateCsvData = (path: PathCustom) => {
    const rows = [Object.keys(path.stopPoints[0]).join(",")];
    rows.push(
      ...path.stopPoints.map((elem) =>
        [
          CesiumMath.toDegrees(elem.longitude),
          CesiumMath.toDegrees(elem.latitude),
          Math.round(elem.height)
        ].join(",")
      )
    );
    return rows.join("\n");
  };

  const icon = (
    <span className={Styles.iconDownload}>
      <Icon glyph={Icon.GLYPHS.opened} />
    </span>
  );

  if (ellipsoid) {
    generateKmlLines(path).then((res) => {
      setKmlLines(res);
    });
    generateKmlPoints(path).then((res) => {
      setKmlPoints(res);
    });
  }

  return (
    <Dropdown
      options={getLinks()}
      textProperty="label"
      theme={{
        dropdown: Styles.download,
        list: Styles.dropdownList,
        button: Styles.dropdownButton,
        icon: icon
      }}
      buttonClassName={Styles.btn}
    >
      Download
    </Dropdown>
  );
};

export default ElevationDownload;
