import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import DataUri from "../../Core/DataUri";
import { MeasurableGeometry } from "../../ViewModels/Measure/MeasurableGeometryManager";
import i18next from "i18next";
import { useTheme } from "styled-components";
import { Button } from "../../Styled/Button";
import Terria from "../../Models/Terria";
import addUserFiles from "../../Models/Catalog/addUserFiles";
import ViewState from "../../ReactViewModels/ViewState";
import { observer } from "mobx-react";

interface Props {
  terria: Terria;
  viewState: ViewState;
  pathNotes: string;
  layerName?: string;
  onClick?: () => void;
}

const MeasurableTransform = observer((props: Props) => {
  const { terria, viewState, pathNotes, layerName, onClick } = props;
  const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
  const theme = useTheme();

  const getDownloadLinks = (geom: MeasurableGeometry, isMultiPath: boolean) => {
    const baseDownloads = [
      {
        key: "jsonPolygon",
        href: DataUri.make("json", generateJsonPolygon(geom)),
        download: `${layerName}_polygon.geojson`,
        label: `${i18next.t("downloadData.polygon")} GEOJSON`
      },
      {
        key: "jsonLines",
        href: DataUri.make("json", generateJsonLineStrings(geom)),
        download: `${layerName}_lines.geojson`,
        label: `${i18next.t("downloadData.lines")} GEOJSON`
      },
      {
        key: "jsonPoints",
        href: DataUri.make("json", generateJsonPoints(geom)),
        download: `${layerName}_points.geojson`,
        label: `${i18next.t("downloadData.points")} GEOJSON`
      }
    ];

    const multiPathDownloads = [
      {
        key: "jsonMultiPathPolygon",
        href: DataUri.make(
          "json",
          generateMultiPathJsonPolygon(terria.measurableGeomList)
        ),
        download: `${layerName}_polygon_multipath.geojson`,
        label: `${i18next.t("downloadData.polygon")} GEOJSON`
      },
      {
        key: "jsonMultiPathLines",
        href: DataUri.make(
          "json",
          generateMultiPathJsonLineStrings(terria.measurableGeomList)
        ),
        download: `${layerName}_lines_multipath.geojson`,
        label: `${i18next.t("downloadData.lines")} GEOJSON`
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
  };

  const generateJsonPolygon = (geom: MeasurableGeometry) => {
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
      name: layerName || "",
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      },
      properties: {
        path_notes: pathNotes || ""
      }
    });
  };

  const generateJsonLineStrings = (geom: MeasurableGeometry) => {
    return JSON.stringify({
      name: layerName || "",
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
  };

  const generateJsonPoints = (geom: MeasurableGeometry) => {
    return JSON.stringify({
      name: layerName || "",
      path_notes: pathNotes || "",
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
  };

  const generateMultiPathJsonPolygon = (
    geomList: MeasurableGeometry[]
  ): string => {
    return JSON.stringify({
      type: "FeatureCollection",
      name: layerName || "",
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
  };

  const generateMultiPathJsonLineStrings = (
    geomList: MeasurableGeometry[]
  ): string => {
    return JSON.stringify({
      type: "FeatureCollection",
      name: layerName || "",
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
  };

  const dataURItoFile = (dataURI: string, filename: string): File => {
    const [header, data] = dataURI.split(",");
    if (!data) {
      throw new Error("Invalid URI");
    }
    const mimeMatch = header.match(/data:([^;]+)(;base64)?/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const isBase64 = header.includes(";base64");
    let byteString: string;
    if (isBase64) {
      byteString = atob(data);
    } else {
      byteString = decodeURIComponent(data);
    }
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mime });
    return new File([blob], filename, { type: mime });
  };

  const generateCircleGeoJson = (geom: MeasurableGeometry) => {
    const center = geom.circleCenter;
    const radius = geom.circleRadius ?? 0;
    if (!center || radius <= 0) return "";

    const numPoints = 64;
    const earthRadius = Ellipsoid.WGS84.maximumRadius;
    const angularDistance = radius / earthRadius;
    const coordinates: number[][] = [];

    for (let i = 0; i <= numPoints; i++) {
      const bearing = (2 * Math.PI * (i % numPoints)) / numPoints;
      const lat1 = center.latitude;
      const lon1 = center.longitude;
      const sinLat1 = Math.sin(lat1);
      const cosLat1 = Math.cos(lat1);
      const sinAd = Math.sin(angularDistance);
      const cosAd = Math.cos(angularDistance);
      const lat2 = Math.asin(
        sinLat1 * cosAd + cosLat1 * sinAd * Math.cos(bearing)
      );
      const lon2 =
        lon1 +
        Math.atan2(
          Math.sin(bearing) * sinAd * cosLat1,
          cosAd - sinLat1 * Math.sin(lat2)
        );
      coordinates.push([
        CesiumMath.toDegrees(lon2),
        CesiumMath.toDegrees(lat2)
      ]);
    }

    return JSON.stringify({
      name: layerName || "",
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      },
      properties: {
        path_notes: pathNotes || "",
        isCircle: true,
        radius: radius,
        diameter: geom.circleDiameter ?? 0,
        perimeter: geom.circlePerimeter ?? 0,
        area: geom.circleArea ?? 0,
        center_lat: CesiumMath.toDegrees(center.latitude),
        center_lon: CesiumMath.toDegrees(center.longitude)
      }
    });
  };

  const handleUploadFile = (e: any) => {
    addUserFiles(e.target.files, terria, viewState, undefined, true);
  };

  const handleTransform = () => {
    if (geom.isCircle) {
      const circleJson = generateCircleGeoJson(geom);
      if (!circleJson) return;
      const href = DataUri.make("json", circleJson);
      try {
        const file = dataURItoFile(
          href as string,
          `${layerName}_circle.geojson`
        );
        handleUploadFile({ target: { files: [file] } });
        onClick?.();
      } catch (e) {
        console.error("Unable to create File from Data URI:", e);
      }
      return;
    }

    const validPaths = terria.measurableGeomList.filter(
      (geom) => geom.stopPoints && geom.stopPoints.length > 0
    );

    const isMultiPath = validPaths.length > 1;
    const links = getDownloadLinks(geom, isMultiPath);

    let format = "";
    if (geom.onlyPoints) {
      format = "jsonPoints";
    } else if (geom.isClosed) {
      format = isMultiPath ? "jsonMultiPathPolygon" : "jsonPolygon";
    } else {
      format = isMultiPath ? "jsonMultiPathLines" : "jsonLines";
    }

    const linkObj = links.find((l) => l.key === format);
    if (!linkObj?.href) {
      return;
    }

    try {
      const file = dataURItoFile(linkObj.href as string, linkObj.download!);
      handleUploadFile({ target: { files: [file] } });
      onClick?.();
    } catch (e) {
      console.error("Unable to create File from Data URI:", e);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <Button
        title={i18next.t("transformLayer.transformation")}
        css={`
          color: ${theme.textLight};
          background: ${theme.colorPrimary};
        `}
        onClick={() => {
          handleTransform();
        }}
        disabled={!layerName}
      >
        {i18next.t("transformLayer.transform")}
      </Button>
    </div>
  );
});
export default MeasurableTransform;
