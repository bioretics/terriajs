import React, { useState } from "react";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import EntityCollection from "terriajs-cesium/Source/DataSources/EntityCollection";
import PolylineGraphics from "terriajs-cesium/Source/DataSources/PolylineGraphics";
import exportKml from "terriajs-cesium/Source/DataSources/exportKml";
import DataUri from "../../Core/DataUri";
//import Dropdown from "../Generic/Dropdown";
import Icon from "../../Styled/Icon";
import Styles from "./elevation-download.scss";
//import PropTypes from "prop-types";
import { PathCustom } from "../../Models/Terria";
import { exportKmlResultKml } from "terriajs-cesium";

const Dropdown = require("../Generic/Dropdown");

interface Props {
  path: PathCustom;
  name: string;
  ellipsoid: Ellipsoid;
}

const ElevationDownload = (props: Props) => {
  const { path, name, ellipsoid } = props;

  const [kml, setKml] = useState<string>();

  const getLinks = () => {
    return [
      {
        href: DataUri.make("csv", generateCsvData(path)),
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
        href: DataUri.make("json", generateJson(path)),
        download: `${name}.json`,
        label: "JSON"
      }
    ].filter((download) => !!download.href);
  };

  const generateKml = async (path: PathCustom) => {
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

  const generateJson = (path: PathCustom) => {
    /*if (!path?.stopPoints) {
      return;
    }*/
    return JSON.stringify({
      type: "LineString",
      coordinates: path.stopPoints.map((elem) => [
        CesiumMath.toDegrees(elem.longitude),
        CesiumMath.toDegrees(elem.latitude),
        Math.round(elem.height)
      ])
      //properties: data?.properties
    });
  };

  const generateCsvData = (path: PathCustom) => {
    /*if (!path?.stopPoints) {
      return;
    }*/
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
    generateKml(path).then((res) => {
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

/*ElevationDownload.propTypes = {
  data: PropTypes.object,
  name: PropTypes.string,
  ellipsoid: PropTypes.object
};*/

export default ElevationDownload;
