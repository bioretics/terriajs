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
import ViewState from "../../ReactViewModels/ViewState";
import { observer } from "mobx-react";

interface Props {
  terria: Terria;
  viewState: ViewState;
  pathNotes: string;
  ellipsoid: Ellipsoid;
}

const MeasurableDownloadContent = observer((props: Props) => {
  const { terria, viewState, pathNotes, ellipsoid } = props;
  const [name, setName] = useState<string>("");
  const [selectedElementIndex, setSelectedElementIndex] = useState<number>(
    terria.measurableGeometryIndex
  );
  const geom = terria.measurableGeomList[selectedElementIndex];
  const theme = useTheme();
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [downloadCurrent, setDownloadCurrent] = useState<boolean>(true);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [measurableDownload, setMeasurableDownload] =
    useState<MeasurableDownload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (ellipsoid) {
      const download = new MeasurableDownload(terria);
      setMeasurableDownload(download);
    }
  }, [ellipsoid, terria]);

  useEffect(() => {
    if (viewState.measurableDownloadPanelIsVisible) {
      setName("");
      setSelectedFormat("");
      setSelectedElementIndex(terria.measurableGeometryIndex);
    }
  }, [viewState.measurableDownloadPanelIsVisible]);

  useEffect(() => {
    const loadData = async () => {
      if (geom && measurableDownload) {
        try {
          setIsLoading(true);
          const isMultiPath = !downloadCurrent;
          const geomListForMultiPath = !downloadCurrent
            ? terria.measurableGeomList
            : undefined;

          const allLinks = await measurableDownload.generateAllFormatLinks(
            geom,
            name,
            isMultiPath,
            geomListForMultiPath,
            ellipsoid
          );

          setDownloadLinks(allLinks);
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
    name,
    geom,
    selectedElementIndex,
    pathNotes,
    ellipsoid,
    downloadCurrent,
    measurableDownload,
    terria.measurableGeomList,
    viewState.measurableDownloadPanelIsVisible
  ]);

  const handleDownload = () => {
    if (measurableDownload) {
      const success = measurableDownload.handleDownload(
        downloadLinks,
        selectedFormat
      );
      if (!success) {
        console.error("Failed to download file");
      }
    }
  };

  const isDownloadDisabled =
    !measurableDownload ||
    !measurableDownload.isValidForDownload(name, selectedFormat, isLoading);

  return (
    <>
      {terria.measurableGeomList.length > 1 && (
        <div style={{ marginBottom: "10px" }}>
          <Select
            title={i18next.t("measurableGeometry.changePath")}
            value={selectedElementIndex}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const newIndex = parseInt(e.target.value, 10);
              setSelectedElementIndex(newIndex);
              setSelectedFormat("");
              e.target.blur();
            }}
            onBlur={(e: React.ChangeEvent<HTMLSelectElement>) =>
              e.target.blur()
            }
            disabled={isLoading || !downloadCurrent}
          >
            {terria.measurableGeomList.map((geom, index) => {
              const hasValidPoints =
                geom.stopPoints && geom.stopPoints.length > 0;
              return (
                <option key={index} value={index} disabled={!hasValidPoints}>
                  {`${i18next.t("measurableGeometry.elementPlaceholder")} ${
                    index + 1
                  }`}
                </option>
              );
            })}
          </Select>
        </div>
      )}

      <div style={{ marginBottom: "5px" }}>
        <Input
          dark
          type="text"
          placeholder={i18next.t("downloadData.filenamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {terria.measurableGeomList.length > 1 && (
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
      )}
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
          disabled={isLoading || !name}
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
          disabled={isDownloadDisabled}
        >
          {isLoading
            ? i18next.t("loader.loadingMessage")
            : i18next.t("Download")}
        </Button>
      </div>
    </>
  );
});

export default MeasurableDownloadContent;
