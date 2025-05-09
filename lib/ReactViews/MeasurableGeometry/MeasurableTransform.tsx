import CesiumMath from "terriajs-cesium/Source/Core/Math";
import DataUri from "../../Core/DataUri";
import { MeasurableGeometry } from "../../ViewModels/MeasurableGeometryManager";
import i18next from "i18next";
import { useTheme } from "styled-components";
import { Button } from "../../Styled/Button";
import Terria from "../../Models/Terria";
import addUserFiles from "../../Models/Catalog/addUserFiles";
import ViewState from "../../ReactViewModels/ViewState";
import MappableMixin from "../../ModelMixins/MappableMixin";

interface Props {
  terria: Terria;
  viewState: ViewState;
  pathNotes: string;
}

const MeasurableTransform = (props: Props) => {
  const { terria, viewState, pathNotes } = props;
  const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
  const theme = useTheme();
  const name = getTimeDateStamp();

  function getTimeDateStamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${hours}${minutes}${seconds}${day}${month}${year}`;
  }

  const getDownloadLinks = (geom: MeasurableGeometry, isMultiPath: boolean) => {
    const baseDownloads = [
      {
        key: "jsonPolygon",
        href: DataUri.make("json", generateGeoJsonPolygon(geom)),
        download: `${name}_polygon.json`,
        label: `${i18next.t("downloadData.polygon")} JSON`
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
      }
    ];

    const multiPathDownloads = [
      {
        key: "jsonMultiPathPolygon",
        href: DataUri.make(
          "json",
          generateMultiPathGeoJsonPolygon(terria.measurableGeomList)
        ),
        download: `${name}_polygon_multipath.json`,
        label: `${i18next.t("downloadData.polygon")} JSON`
      },
      {
        key: "jsonMultiPathLines",
        href: DataUri.make(
          "json",
          generateMultiPathJsonLineStrings(terria.measurableGeomList)
        ),
        download: `${name}_lines_multipath.json`,
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
  };

  const generateGeoJsonPolygon = (geom: MeasurableGeometry) => {
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
      name: name || "",
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
      name: name || "",
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
      name: name || "",
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

  const generateMultiPathGeoJsonPolygon = (
    geomList: MeasurableGeometry[]
  ): string => {
    return JSON.stringify({
      type: "FeatureCollection",
      name: name || "",
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
      name: name || "",
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

  const onFileAddFinished = async (files: any) => {
    const file = files.find((f: any) => MappableMixin.isMixedInto(f));
    if (file) {
      const result = await viewState.viewCatalogMember(file);
      if (result.error) {
        result.raiseError(terria);
      } else {
        if (!file.disableZoomTo) {
          terria.currentViewer.zoomTo(file, 1);
        }
      }
    }
    viewState.myDataIsUploadView = false;
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

  const handleUploadFile = (e: any) => {
    console.log("handleUploadFile", e.target.files);

    addUserFiles(e.target.files, terria, viewState).then(
      (addedCatalogItems) => {
        console.log("addedCatalogItems", addedCatalogItems);
        if (addedCatalogItems && addedCatalogItems.length > 0) {
          onFileAddFinished(addedCatalogItems);
        }
      }
    );
  };

  const handleTransform = () => {
    const links = getDownloadLinks(geom, terria.measurableGeomList.length > 1);
    let format = "";
    if (geom.onlyPoints) {
      format = "jsonPoints";
    } else if (geom.isClosed) {
      format = "jsonPolygon";
    } else {
      format = "jsonLines";
    }
    const linkObj = links.find((l) => l.key === format);
    if (!linkObj?.href) return;

    try {
      const file = dataURItoFile(linkObj.href as string, linkObj.download!);
      handleUploadFile({ target: { files: [file] } });
    } catch (e) {
      console.error("Unable to create File from Data URI:", e);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Button
          css={`
            color: ${theme.textLight};
            background: ${theme.colorPrimary};
            margin-left: 10px;
          `}
          onClick={handleTransform}
          disabled={!name}
        >
          {i18next.t("measure.measureTransform")}
        </Button>
      </div>
    </>
  );
};
export default MeasurableTransform;
