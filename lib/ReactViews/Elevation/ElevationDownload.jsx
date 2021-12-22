import React, { useState } from "react";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityCollection from "terriajs-cesium/Source/DataSources/EntityCollection";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import exportKml from "terriajs-cesium/Source/DataSources/exportKml";
import DataUri from "../../Core/DataUri";
import Dropdown from "../Generic/Dropdown";
import Icon from "../../Styled/Icon";
import Styles from "./elevation-download.scss";
import PropTypes from "prop-types";

const ElevationDownload = props => {
  const { data, name, ellipsoid } = props;

  const [kml, setKml] = useState(null);

  const getLinks = () => {
    return [
      {
        href: DataUri.make("csv", generateCsvData(data)),
        download: `${name}.csv`,
        label: "CSV"
      },
      {
        href: kml
          ? DataUri.make(
              "application/vnd.google-earth.kml+xml;charset=utf-8",
              kml
            )
          : false,
        download: `${name}.kml`,
        label: "KML"
      },
      {
        href: DataUri.make("json", generateJson(data)),
        download: `${name}.json`,
        label: "JSON"
      }
    ].filter(download => !!download.href);
  };

  const generateKml = async data => {
    if (!data || !data.pathPoints) {
      return;
    }
    const output = {
      entities: new EntityCollection(),
      kmz: false,
      ellipsoid: ellipsoid
    };
    output.entities.add(
      new Entity({
        id: 0,
        polyline: new PolylineGraphics({
          positions: data.pathPoints.map(elem =>
            Cartographic.toCartesian(elem, ellipsoid)
          )
        })
      })
    );
    const res = await exportKml(output);
    return res.kml;
  };

  const generateJson = data => {
    if (!data || !data.pathPoints) {
      return;
    }

    return JSON.stringify({
      type: "LineString",
      coordinates: data.pathPoints.map(elem => [
        CesiumMath.toDegrees(elem.longitude),
        CesiumMath.toDegrees(elem.latitude),
        Math.round(elem.height)
      ]),
      properties: data?.properties
    });
  };

  const generateCsvData = data => {
    if (!data || !data.pathPoints) {
      return;
    }
    const rows = [Object.keys(data.pathPoints[0]).join(",")];
    rows.push(
      ...data.pathPoints.map(elem =>
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
    generateKml(data).then(res => {
      setKml(res);
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

ElevationDownload.propTypes = {
  data: PropTypes.object,
  name: PropTypes.string,
  ellipsoid: PropTypes.object
};

export default ElevationDownload;
