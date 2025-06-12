import React, { useState, useEffect } from "react";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Styles from "./measurable-download.scss";
import i18next from "i18next";
import { useTheme } from "styled-components";
import { Button } from "../../Styled/Button";
import Select from "../../Styled/Select";
import Terria from "../../Models/Terria";
import Checkbox from "../../Styled/Checkbox";
import Input from "../../Styled/Input";
import MeasurableDownload, {
  DownloadLink
} from "../../ViewModels/Measure/MeasurableDownload";

interface Props {
  terria: Terria;
  pathNotes: string;
  ellipsoid: Ellipsoid;
}

const MeasurableDownloadButton = (props: Props) => {
  const { terria, pathNotes, ellipsoid } = props;
  const [name, setName] = useState<string>("");
  const geom = terria.measurableGeomList[terria.measurableGeometryIndex];
  const theme = useTheme();
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [downloadCurrent, setDownloadCurrent] = useState<boolean>(true);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [measurableDownload, setMeasurableDownload] =
    useState<MeasurableDownload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (ellipsoid) {
      const download = new MeasurableDownload(ellipsoid, "", "");
      setMeasurableDownload(download);
    }
  }, [ellipsoid]);

  useEffect(() => {
    if (measurableDownload) {
      measurableDownload.setName(name);
      measurableDownload.setPathNotes(pathNotes);
    }
  }, [measurableDownload, name, pathNotes]);

  useEffect(() => {
    const loadData = async () => {
      if (measurableDownload && geom && ellipsoid) {
        try {
          setIsLoading(true);

          await measurableDownload.initializeKmlData(
            geom,
            downloadCurrent ? undefined : terria.measurableGeomList
          );

          const links = measurableDownload.getDownloadLinks(
            geom,
            !downloadCurrent,
            downloadCurrent ? undefined : terria.measurableGeomList
          );
          setDownloadLinks(links);
        } catch (error) {
          console.error("Error loading download data:", error);
          setDownloadLinks([]);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadData();
  }, [
    measurableDownload,
    geom,
    downloadCurrent,
    terria.measurableGeomList,
    ellipsoid,
    name,
    pathNotes
  ]);

  const handleDownload = () => {
    if (measurableDownload) {
      const linkObj = downloadLinks.find((link) => link.key === selectedFormat);
      if (linkObj) {
        measurableDownload.downloadFile(linkObj);
      }
    }
  };

  return (
    <>
      <div style={{ marginBottom: "5px" }}>
        <Input
          dark
          type="text"
          placeholder={i18next.t("downloadData.filenamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label style={{ display: "flex", alignItems: "center" }}>
          <Checkbox
            isDisabled={terria.measurableGeomList.length <= 1}
            isChecked={downloadCurrent}
            onChange={(e) => setDownloadCurrent(e.target.checked)}
          />
          <span style={{ marginTop: "5px" }}>
            {"Download " + i18next.t("downloadData.downloadCurrent")}
          </span>
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Select
          title={i18next.t("downloadData.formatPlaceholder")}
          css={`
            padding-top: 5px;
          `}
          value={selectedFormat}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedFormat(e.target.value);
            e.target.blur();
          }}
          onBlur={(e: React.ChangeEvent<HTMLSelectElement>) => e.target.blur()}
          className={Styles.dropdownList}
          disabled={isLoading}
        >
          {downloadLinks.map((link) => (
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
          disabled={
            !name || selectedFormat === "" || !measurableDownload || isLoading
          }
        >
          {isLoading ? i18next.t("loader.loading") : i18next.t("Download")}
        </Button>
      </div>
    </>
  );
};

export default MeasurableDownloadButton;
