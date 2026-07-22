import { sortBy, uniqBy } from "lodash-es";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import defined from "terriajs-cesium/Source/Core/defined";
import SplitDirection from "terriajs-cesium/Source/Scene/SplitDirection";
import {
  Category,
  DataSourceAction
} from "../../../Core/Analytics/analyticEvents";
import TerriaError from "../../../Core/TerriaError";
import filterOutUndefined from "../../../Core/filterOutUndefined";
import getDereferencedIfExists from "../../../Core/getDereferencedIfExists";
import getPath from "../../../Core/getPath";
import CatalogMemberMixin, {
  getName
} from "../../../ModelMixins/CatalogMemberMixin";
import DiffableMixin from "../../../ModelMixins/DiffableMixin";
import ExportableMixin from "../../../ModelMixins/ExportableMixin";
import MappableMixin from "../../../ModelMixins/MappableMixin";
import SearchableItemMixin from "../../../ModelMixins/SearchableItemMixin";
import TimeVarying from "../../../ModelMixins/TimeVarying";
import SplitItemReference from "../../../Models/Catalog/CatalogReferences/SplitItemReference";
import addUserCatalogMember from "../../../Models/Catalog/addUserCatalogMember";
import CommonStrata from "../../../Models/Definition/CommonStrata";
import { BaseModel } from "../../../Models/Definition/Model";
import hasTraits from "../../../Models/Definition/hasTraits";
import { ViewingControl } from "../../../Models/ViewingControls";
import getAncestors from "../../../Models/getAncestors";
import ViewState from "../../../ReactViewModels/ViewState";
import AnimatedSpinnerIcon from "../../../Styled/AnimatedSpinnerIcon";
import Box from "../../../Styled/Box";
import { RawButton } from "../../../Styled/Button";
import Icon, { StyledIcon } from "../../../Styled/Icon";
import Ul from "../../../Styled/List";
import SplitterTraits from "../../../Traits/TraitsClasses/SplitterTraits";
import { exportData } from "../../Preview/ExportData";
import LazyItemSearchTool from "../../Tools/ItemSearchTool/LazyItemSearchTool";
import WorkbenchButton from "../WorkbenchButton";
import {
  WorkbenchControls,
  enableAllControls,
  isControlEnabled
} from "./WorkbenchControls";
// Fork (rer3d): measurable-path / visualize-points / copy-layer features.
import MeasurableGeometryMixin from "../../../ModelMixins/MeasurableGeometryMixin";
import CsvCatalogItem from "../../../Models/Catalog/CatalogItems/CsvCatalogItem";
import GeoJsonCatalogItem from "../../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import KmlCatalogItem from "../../../Models/Catalog/CatalogItems/KmlCatalogItem";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import sampleTerrainMostDetailed from "terriajs-cesium/Source/Core/sampleTerrainMostDetailed";
import {
  MeasureAngleTool,
  MeasureLineTool,
  MeasurePointTool,
  MeasurePolygonTool,
  MeasureCircleTool
} from "../../Map/MapNavigation/Items";
import { MeasureToolsController } from "../../Map/MapNavigation/Items/MeasureTools";

const BoxViewingControl = styled(Box).attrs({
  centered: true,
  left: true,
  justifySpaceBetween: true
})``;

const ViewingControlMenuButton = styled(RawButton).attrs({
  // primaryHover: true
})`
  color: ${(props) => props.theme.textDarker};
  background-color: ${(props) => props.theme.textLight};

  ${StyledIcon} {
    width: 35px;
  }

  svg {
    fill: ${(props) => props.theme.textDarker};
    width: 18px;
    height: 18px;
  }
  & > span {
    // position: absolute;
    // left: 37px;
  }

  border-radius: 0;

  width: 124px;
  // ensure we support long strings
  min-height: 32px;
  display: block;

  &:hover,
  &:focus {
    color: ${(props) => props.theme.textLight};
    background-color: ${(props) => props.theme.colorPrimary};
    svg {
      fill: ${(props) => props.theme.textLight};
    }
  }
`;

interface PropsType {
  viewState: ViewState;
  item: BaseModel;
  controls?: WorkbenchControls;
}

const ViewingControls: React.FC<PropsType> = observer((props) => {
  const { viewState, item, controls = enableAllControls } = props;
  const { t } = useTranslation();
  const [isMenuOpen, setIsOpen] = useState(false);
  const [isMapZoomingToCatalogItem, setIsMapZoomingToCatalogItem] =
    useState(false);

  useEffect(() => {
    const hideMenu = () => {
      setIsOpen(false);
    };

    window.addEventListener("click", hideMenu);
    return () => window.removeEventListener("click", hideMenu);
  }, [viewState]);

  const removeFromMap = useCallback(() => {
    const terria = viewState.terria;
    terria.workbench.remove(item);
    terria.removeSelectedFeaturesForModel(item);
    if (TimeVarying.is(item)) viewState.terria.timelineStack.remove(item);
    viewState.terria.analytics.logEvent(
      Category.dataSource,
      DataSourceAction.removeFromWorkbench,
      getPath(item)
    );
  }, [item, viewState]);

  const zoomTo = useCallback(() => {
    const viewer = viewState.terria.currentViewer;
    if (!MappableMixin.isMixedInto(item)) return;

    setIsMapZoomingToCatalogItem(true);
    viewer.zoomTo(item).finally(() => {
      setIsMapZoomingToCatalogItem(false);
    });
  }, [item, viewState]);

  const splitItem = useCallback(() => {
    const terria = item.terria;
    const splitRef = new SplitItemReference(createGuid(), terria);

    runInAction(async () => {
      if (!hasTraits(item, SplitterTraits, "splitDirection")) return;

      if (item.splitDirection === SplitDirection.NONE) {
        item.setTrait(
          CommonStrata.user,
          "splitDirection",
          SplitDirection.RIGHT
        );
      }

      splitRef.setTrait(CommonStrata.user, "splitSourceItemId", item.uniqueId);
      terria.addModel(splitRef);
      terria.showSplitter = true;

      await splitRef.loadReference();
      runInAction(() => {
        const target = splitRef.target;
        if (target) {
          target.setTrait(
            CommonStrata.user,
            "name",
            t(($) => $.splitterTool.workbench.copyName, {
              name: getName(item)
            })
          );

          // Set a direction opposite to the original item
          target.setTrait(
            CommonStrata.user,
            "splitDirection",
            item.splitDirection === SplitDirection.LEFT
              ? SplitDirection.RIGHT
              : SplitDirection.LEFT
          );
        }
      });

      // Add it to terria.catalog, which is required so the new item can be shared.
      addUserCatalogMember(terria, splitRef, {
        open: false
      });
    });
  }, [item, t]);

  const openDiffTool = useCallback(() => {
    viewState.openTool({
      toolName: "Difference",
      getToolComponent: () =>
        import("../../Tools/DiffTool/DiffTool").then((m) => m.default),
      params: {
        sourceItem: item
      }
    });
  }, [item, viewState]);

  const searchItem = useCallback(() => {
    runInAction(() => {
      if (!SearchableItemMixin.isMixedInto(item)) return;

      let itemSearchProvider;
      try {
        itemSearchProvider = item.createItemSearchProvider();
      } catch (error) {
        viewState.terria.raiseErrorToUser(error);
        return;
      }
      viewState.openTool({
        toolName: "Search Item",
        getToolComponent: () => LazyItemSearchTool,
        params: {
          item,
          itemSearchProvider,
          viewState
        }
      });
    });
  }, [item, viewState]);

  const previewItem = useCallback(async () => {
    // Open up all the parents (doesn't matter that this sets it to enabled as well because it already is).
    getAncestors(item)
      .map((item) => getDereferencedIfExists(item))
      .forEach((group) => {
        runInAction(() => {
          group.setTrait(CommonStrata.user, "isOpen", true);
        });
      });
    viewState
      .viewCatalogMember(item)
      .then((result) => result.raiseError(viewState.terria));
  }, [item, viewState]);

  const exportDataClicked = useCallback(() => {
    if (!ExportableMixin.isMixedInto(item)) return;

    // Fork (rer3d): measurable items open the download panel.
    if (MeasurableGeometryMixin.isMixedInto(item)) {
      runInAction(() => {
        viewState.measurableDownloadPanelDefaultName = getName(item) || "";
        viewState.measurableDownloadPanelIsVisible = true;
      });
    }

    exportData(item).catch((e) => {
      item.terria.raiseErrorToUser(e);
    });
  }, [item, viewState]);

  // Fork (rer3d): duplicate a layer (without splitting the screen).
  const copyItem = useCallback(() => {
    const terria = item.terria;
    const splitRef = new SplitItemReference(createGuid(), terria);

    runInAction(async () => {
      splitRef.setTrait(CommonStrata.user, "splitSourceItemId", item.uniqueId);
      terria.addModel(splitRef);

      await splitRef.loadReference();
      runInAction(() => {
        const target = splitRef.target;
        if (target) {
          target.setTrait(
            CommonStrata.user,
            "name",
            t(($) => $.splitterTool.workbench.copyName, {
              name: getName(item)
            })
          );
        }
      });

      // Add it to terria.catalog, which is required so the new item can be shared.
      addUserCatalogMember(terria, splitRef, {
        open: false
      });
    });
  }, [item, t]);

  // Fork (rer3d): visualize CSV/KML/GeoJSON/GPX data as a measurable path.
  const canVisualizePoints = !!(
    item?.uniqueId?.includes(".csv") ||
    item?.uniqueId?.includes(".kml") ||
    (item?.uniqueId?.includes(".json") &&
      !(CatalogMemberMixin.isMixedInto(item) && item.disableAboutData)) ||
    item?.uniqueId?.includes(".gpx") ||
    item?.uniqueId?.includes(".geojson")
  );

  const visualizePointsClicked = useCallback(async () => {
    try {
      if (item?.uniqueId?.includes(".csv")) {
        await (item as CsvCatalogItem).sampleFromCsvData();
        return;
      }

      if (item?.uniqueId?.includes(".kml")) {
        await (item as KmlCatalogItem).sampleFromKmlData();
        return;
      }

      if (
        item?.uniqueId?.includes(".json") &&
        !(CatalogMemberMixin.isMixedInto(item) && item.disableAboutData)
      ) {
        await (item as GeoJsonCatalogItem).sampleFromGeojsonData();
        return;
      }

      if (
        item?.uniqueId?.includes(".gpx") ||
        item?.uniqueId?.includes(".geojson")
      ) {
        const fc = await (item as GeoJsonCatalogItem).forceLoadGeojsonData();
        if (!fc) return;

        const positions: Cartographic[] = [];
        const descriptions: string[] = [];

        const features = fc.features ?? [];
        const firstFeature = features[0];

        const hasMetadataOnlyFirstFeature =
          firstFeature && (firstFeature?.properties as any)?.name;

        const pathNotes =
          (fc as any).path_notes ||
          (fc as any).properties?.path_notes ||
          (firstFeature?.properties as any)?.path_notes ||
          (firstFeature?.properties as any)?.desc ||
          "";

        const featuresToProcess = hasMetadataOnlyFirstFeature
          ? features.slice(1)
          : features;

        featuresToProcess.forEach((feature) => {
          if (!feature.geometry) return;
          switch (feature.geometry.type) {
            case "Point": {
              const coords = feature.geometry.coordinates;
              const lon = coords[0];
              const lat = coords[1];
              const alt = coords.length > 2 ? coords[2] : 0;
              positions.push(
                Cartographic.fromDegrees(
                  lon as number,
                  lat as number,
                  alt as number
                )
              );
              descriptions.push(
                (feature.properties as any)?.description ||
                  (feature.properties as any)?.desc ||
                  ""
              );
              break;
            }
            case "LineString": {
              const coordsArray = feature.geometry.coordinates;
              coordsArray.forEach((coords: any) => {
                const lon = coords[0];
                const lat = coords[1];
                const alt = coords.length > 2 ? coords[2] : 0;
                positions.push(Cartographic.fromDegrees(lon, lat, alt));
              });
              descriptions.push(
                (feature.properties as any)?.description ||
                  (feature.properties as any)?.desc ||
                  ""
              );
              break;
            }
            default:
              break;
          }
        });

        if (positions.length === 0) return;
        if (!item.terria) return;
        const terrainProvider = item.terria.cesium?.scene?.terrainProvider;
        const canSampleTerrain =
          !!terrainProvider && !!(terrainProvider as any).availability;
        const resolvedPositions =
          canSampleTerrain && positions.every((pos) => pos.height < 1)
            ? await sampleTerrainMostDetailed(terrainProvider, positions)
            : positions;

        item.terria.measurableGeometryManager[
          item.terria.measurableGeometryIndex
        ].sampleFromCartographics(
          resolvedPositions,
          false,
          true,
          descriptions,
          pathNotes
        );
        return;
      }
    } catch (error) {
      viewState.terria.raiseErrorToUser(
        TerriaError.from(error, {
          title: "Error visualizing points",
          message: "Failed to process the data for visualization."
        })
      );
    }
  }, [item, viewState]);

  const viewingControls = useMemo(() => {
    if (!CatalogMemberMixin.isMixedInto(item)) {
      return [];
    }

    // Global viewing controls (usually defined by plugins).
    const globalViewingControls = filterOutUndefined(
      viewState.globalViewingControlOptions.map(
        (generateViewingControlForItem) => {
          try {
            return generateViewingControlForItem(item);
          } catch (err) {
            TerriaError.from(err).log();
            return undefined;
          }
        }
      )
    );
    // Item specific viewing controls
    const itemViewingControls: ViewingControl[] = item.viewingControls;

    // Collate list, unique by id and sorted by name
    return sortBy(
      uniqBy([...itemViewingControls, ...globalViewingControls], "id"),
      "name"
    ).filter(({ id }) => {
      // Exclude disabled controls
      return isControlEnabled(controls, id);
    });
  }, [item, controls, viewState.globalViewingControlOptions]);

  const renderViewingControlsMenu = () => {
    const canSplit =
      controls.compare &&
      !item.terria.configParameters.disableSplitter &&
      hasTraits(item, SplitterTraits, "splitDirection") &&
      hasTraits(item, SplitterTraits, "disableSplitter") &&
      !item.disableSplitter &&
      defined(item.splitDirection) &&
      item.terria.currentViewer.canShowSplitter;

    const handleOnClick = (viewingControl: ViewingControl) => {
      try {
        viewingControl.onClick(viewState);
      } catch (err) {
        viewState.terria.raiseErrorToUser(TerriaError.from(err));
      }
    };

    return (
      <ul>
        {viewingControls.map((viewingControl) => (
          <li key={viewingControl.id}>
            <ViewingControlMenuButton
              onClick={() => handleOnClick(viewingControl)}
              title={viewingControl.iconTitle}
            >
              <BoxViewingControl>
                <StyledIcon {...viewingControl.icon} />
                <span>{viewingControl.name}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ))}
        {canSplit ? (
          <li key={"workbench.splitItem"}>
            <ViewingControlMenuButton
              onClick={splitItem}
              title={t(($) => $.workbench.splitItemTitle)}
            >
              <BoxViewingControl>
                <StyledIcon glyph={Icon.GLYPHS.compare} />
                <span>{t(($) => $.workbench.splitItem)}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ) : null}
        {/* Fork (rer3d): duplicate layer */}
        {canSplit ? (
          <li key={"workbench.copyItem"}>
            <ViewingControlMenuButton
              onClick={copyItem}
              title={t(($) => $.workbench.copyItemTitle)}
            >
              <BoxViewingControl>
                <StyledIcon glyph={Icon.GLYPHS.copy} />
                <span>{t(($) => $.workbench.copyItem)}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ) : null}
        {controls.difference &&
        viewState.useSmallScreenInterface === false &&
        DiffableMixin.isMixedInto(item) &&
        !item.isShowingDiff &&
        item.canDiffImages ? (
          <li key={"workbench.diffImage"}>
            <ViewingControlMenuButton
              onClick={openDiffTool}
              title={t(($) => $.workbench.diffImageTitle)}
            >
              <BoxViewingControl>
                <StyledIcon glyph={Icon.GLYPHS.difference} />
                <span>{t(($) => $.workbench.diffImage)}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ) : null}
        {controls.exportData &&
        viewState.useSmallScreenInterface === false &&
        ExportableMixin.isMixedInto(item) &&
        item.canExportData ? (
          <li key={"workbench.exportData"}>
            <ViewingControlMenuButton
              onClick={exportDataClicked}
              title={t(($) => $.workbench.exportDataTitle)}
            >
              <BoxViewingControl>
                <StyledIcon glyph={Icon.GLYPHS.upload} />
                <span>{t(($) => $.workbench.exportData)}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ) : null}
        {controls.search &&
        viewState.useSmallScreenInterface === false &&
        SearchableItemMixin.isMixedInto(item) &&
        item.canSearch ? (
          <li key={"workbench.searchItem"}>
            <ViewingControlMenuButton
              onClick={searchItem}
              title={t(($) => $.workbench.searchItemTitle)}
            >
              <BoxViewingControl>
                <StyledIcon glyph={Icon.GLYPHS.search} />
                <span>{t(($) => $.workbench.searchItem)}</span>
              </BoxViewingControl>
            </ViewingControlMenuButton>
          </li>
        ) : null}
        {/* Fork (rer3d): use layer as measurable path + play path */}
        {MeasurableGeometryMixin.isMixedInto(item) && item.canUseAsPath && (
          <>
            <li key={"workbench.measureItem"}>
              <ViewingControlMenuButton
                disabled={
                  viewState.measurablePanelIsVisible &&
                  !viewState.terria.measurableGeomList[
                    viewState.terria.measurableGeometryIndex
                  ].isFileUploaded
                }
                onClick={() =>
                  runInAction(() => {
                    if (
                      viewState.playPathPanelIsVisible ||
                      viewState.measurableDownloadPanelIsVisible
                    ) {
                      viewState.measurablePanelIsVisible = true;
                    }
                    item.computePath();
                    [
                      MeasureToolsController.id,
                      MeasureLineTool.id,
                      MeasurePolygonTool.id,
                      MeasurePointTool.id,
                      MeasureAngleTool.id,
                      MeasureCircleTool.id
                    ].forEach((id) =>
                      viewState.terria.mapNavigationModel.disable(id)
                    );
                  })
                }
                title={t(($) => $.workbench.pathItemTitle)}
              >
                <BoxViewingControl>
                  <StyledIcon glyph={Icon.GLYPHS.lineChart} />
                  <span>{t(($) => $.workbench.pathItem)}</span>
                </BoxViewingControl>
              </ViewingControlMenuButton>
            </li>
            <li>
              <ViewingControlMenuButton
                onClick={() => {
                  if (MeasurableGeometryMixin.isMixedInto(item)) {
                    runInAction(() => {
                      item.computePath();
                      viewState.playPathPanelIsVisible = true;
                    });
                  }
                }}
              >
                <BoxViewingControl>
                  <StyledIcon glyph={Icon.GLYPHS.play} />
                  <span>{t(($) => $.workbench.playPath)}</span>
                </BoxViewingControl>
              </ViewingControlMenuButton>
            </li>
          </>
        )}
        {/* Fork (rer3d): visualize data points as a measurable path */}
        {(!MeasurableGeometryMixin.isMixedInto(item) || !item.canUseAsPath) &&
          canVisualizePoints && (
            <li key={`${item.uniqueId}-measureItem`}>
              <ViewingControlMenuButton onClick={visualizePointsClicked}>
                <BoxViewingControl>
                  <StyledIcon glyph={Icon.GLYPHS.lineChart} />
                  <span>{t(($) => $.workbench.pointsItem)}</span>
                </BoxViewingControl>
              </ViewingControlMenuButton>
            </li>
          )}
        <li key={"workbench.removeFromMap"}>
          <ViewingControlMenuButton
            onClick={removeFromMap}
            title={t(($) => $.workbench.removeFromMapTitle)}
          >
            <BoxViewingControl>
              <StyledIcon glyph={Icon.GLYPHS.cancel} />
              <span>{t(($) => $.workbench.removeFromMap)}</span>
            </BoxViewingControl>
          </ViewingControlMenuButton>
        </li>
      </ul>
    );
  };

  return (
    <Box>
      <Ul
        css={`
          list-style: none;
          padding-left: 0;
          margin: 0;
          width: 100%;
          position: relative;
          display: flex;
          justify-content: space-between;

          li {
            display: block;
            float: left;
            box-sizing: border-box;
          }
          & > button:last-child {
            margin-right: 0;
          }
        `}
        gap={2}
      >
        <WorkbenchButton
          onClick={zoomTo}
          title={t(($) => $.workbench.zoomToTitle)}
          disabled={
            !controls.idealZoom ||
            // disabled if the item cannot be zoomed to or if a zoom is already in progress
            (MappableMixin.isMixedInto(item) && item.disableZoomTo) ||
            isMapZoomingToCatalogItem === true
          }
          iconElement={() =>
            isMapZoomingToCatalogItem ? (
              <AnimatedSpinnerIcon />
            ) : (
              <Icon glyph={Icon.GLYPHS.search} />
            )
          }
        >
          {t(($) => $.workbench.zoomTo)}
        </WorkbenchButton>
        <WorkbenchButton
          onClick={previewItem}
          title={t(($) => $.workbench.previewItemTitle)}
          iconElement={() => <Icon glyph={Icon.GLYPHS.about} />}
          disabled={
            !controls.aboutData ||
            (CatalogMemberMixin.isMixedInto(item) && item.disableAboutData)
          }
        >
          {t(($) => $.workbench.previewItem)}
        </WorkbenchButton>
        <WorkbenchButton
          css="flex-grow:0;"
          onClick={(e) => {
            e.stopPropagation();
            if (isMenuOpen) {
              setIsOpen(false);
            } else {
              setIsOpen(true);
            }
          }}
          title={t(($) => $.workbench.showMoreActionsTitle)}
          iconOnly
          iconElement={() => <Icon glyph={Icon.GLYPHS.menuDotted} />}
        />
      </Ul>
      {isMenuOpen && (
        <Box
          css={`
            position: absolute;
            z-index: 100;
            right: 0;
            top: 0;
            top: 32px;
            top: 42px;

            padding: 0;
            margin: 0;

            ul {
              list-style: none;
            }
          `}
        >
          {renderViewingControlsMenu()}
        </Box>
      )}
    </Box>
  );
});

ViewingControls.displayName = "ViewingControls";

export default ViewingControls;
