import { runInAction } from "mobx";
import { observer } from "mobx-react";
import {
  FC,
  ComponentPropsWithoutRef,
  Ref,
  MouseEventHandler,
  forwardRef
} from "react";
import { useTranslation, withTranslation } from "react-i18next";
import styled, { DefaultTheme, withTheme } from "styled-components";
import {
  Category,
  DataSourceAction,
  HelpAction
} from "../../Core/Analytics/analyticEvents";
import getPath from "../../Core/getPath";
import { applyTranslationIfExists } from "../../Language/languageHelpers";
import MappableMixin from "../../ModelMixins/MappableMixin";
import ViewState from "../../ReactViewModels/ViewState";
import Box from "../../Styled/Box";
import Button, { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import Text from "../../Styled/Text";
import { useViewState, withViewState } from "../Context";
import { ExplorerWindowElementName } from "../ExplorerWindow/ExplorerWindow";
import { useRefForTerria } from "../Hooks/useRefForTerria";
import SearchBoxAndResults from "../Search/SearchBoxAndResults";
import Workbench from "../Workbench/Workbench";

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid ${(p) => p.theme.border};
`;

const HeaderTitle = styled(Text).attrs({ as: "h2" })`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: ${(p) => p.theme.textLight};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
`;

const HeaderDivider = styled.span`
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: ${(p) => p.theme.border};
`;

/** 28px ghost icon button, as used in GeoLibre panel headers. */
export const PanelIconButton = styled(RawButton)<{ danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${(p) => p.theme.radiusMedium};
  color: ${(p) => (p.danger ? p.theme.textWarning : p.theme.mutedForeground)};
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.accent};
    color: ${(p) => (p.danger ? p.theme.textWarning : p.theme.textLight)};
  }

  &[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SearchArea = styled.div`
  flex: 0 0 auto;
  padding: 8px 8px 0;
`;

const EmptyHint = styled(Box)`
  color: ${(p) => p.theme.mutedForeground};
  font-size: 12px;
  line-height: 18px;

  h5 {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 600;
    color: ${(p) => p.theme.textLight};
  }

  ul {
    padding-inline-start: 18px;
    margin: 0;
  }
`;

interface EmptyWorkbenchProps {
  theme: DefaultTheme;
}

type TransContent = {
  heading?: string;
  body?: string;
  list?: string[];
}[];

const EmptyWorkbench: FC<EmptyWorkbenchProps> = observer(() => {
  const { t } = useTranslation();
  const viewState = useViewState();
  const transContent = t(($) => $.emptyWorkbenchInfo, {
    returnObjects: true
  }) as TransContent;

  return (
    <Box overflowY="auto" scroll column fullWidth>
      <EmptyHint column gap={3} styledPadding="16px 12px">
        {transContent?.map((content, idx) => (
          <div key={idx}>
            {content.heading && <h5>{content.heading}</h5>}
            {content.body && <div>{content.body}</div>}
            {content.list && (
              <ul>
                {content.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <Box centered css="margin-top: 8px">
          <Button
            textLight
            transparentBg
            shortMinHeight
            onClick={() => {
              viewState.terria.analytics.logEvent(
                Category.help,
                HelpAction.takeTour
              );
              runInAction(() => {
                viewState.setTourIndex(0);
              });
            }}
            renderIcon={() => (
              <StyledIcon light styledWidth={"16px"} glyph={Icon.GLYPHS.info} />
            )}
            textProps={{
              medium: true,
              textLight: true
            }}
          >
            {t(($) => $.helpPanel.takeTour)}
          </Button>
        </Box>
      </EmptyHint>
    </Box>
  );
});

type HeaderButtonProps = {
  glyph: { id: string };
  children?: React.ReactNode;
} & ComponentPropsWithoutRef<typeof PanelIconButton>;

const HeaderButton = forwardRef<HTMLButtonElement, HeaderButtonProps>(
  function HeaderButton({ glyph, ...rest }, ref) {
    return (
      <PanelIconButton ref={ref} type="button" {...rest}>
        <StyledIcon glyph={glyph} />
      </PanelIconButton>
    );
  }
);

export const EXPLORE_MAP_DATA_NAME = "ExploreMapDataButton";
export const SIDE_PANEL_UPLOAD_BUTTON_NAME = "SidePanelUploadButton";

interface SidePanelProps {
  viewState: ViewState;
  refForExploreMapData: Ref<HTMLButtonElement>;
  refForUploadData: Ref<HTMLButtonElement>;
  theme: DefaultTheme;
}

const SidePanel = observer<React.FC<SidePanelProps>>(
  ({ viewState, theme, refForExploreMapData, refForUploadData }) => {
    const terria = viewState.terria;
    const { t, i18n } = useTranslation();
    const workbench = terria.workbench;
    const itemCount = workbench.items.length;

    const onAddDataClicked: MouseEventHandler<HTMLButtonElement> = (e) => {
      e.stopPropagation();
      viewState.setTopElement(ExplorerWindowElementName);
      viewState.openAddData();
    };

    const onAddLocalDataClicked: MouseEventHandler<HTMLButtonElement> = (e) => {
      e.stopPropagation();
      viewState.setTopElement(ExplorerWindowElementName);
      viewState.openUserData();
    };

    // Workbench-wide actions (previously in the BadgeBar).
    const allHidden = workbench.items
      .filter((it): it is MappableMixin.Instance =>
        MappableMixin.isMixedInto(it)
      )
      .every((it) => !it.show);
    const shouldExpandAll = workbench.shouldExpandAll;

    const toggleAllVisibility = () =>
      runInAction(() => {
        if (allHidden) workbench.enableAll();
        else workbench.disableAll();
      });

    const toggleAllExpanded = () =>
      runInAction(() => {
        if (shouldExpandAll) workbench.expandAll();
        else workbench.collapseAll();
      });

    const removeAll = () =>
      runInAction(() => {
        workbench.items.forEach((item) => {
          terria.analytics.logEvent(
            Category.dataSource,
            DataSourceAction.removeAllFromWorkbench,
            getPath(item)
          );
          terria.removeSelectedFeaturesForModel(item);
        });
        workbench.removeAll();
        (terria.timelineStack.items as any).clear();
      });

    const layersLabel = t(($) => $.sui.sideRail.layers);
    const addData = t(($) => $.addData.addDataBtnText);
    const uploadText = t(($) => $.models.catalog.upload);

    return (
      <Box column styledMinHeight={"0"} flex={1} fullHeight>
        <PanelHeader>
          <HeaderTitle title={layersLabel}>
            {layersLabel}
            {itemCount > 0 ? ` (${itemCount})` : ""}
          </HeaderTitle>
          <HeaderActions>
            {terria.elements.get("side-panel-add-data")?.visible !== false && (
              <HeaderButton
                ref={refForExploreMapData}
                glyph={Icon.GLYPHS.add}
                onClick={onAddDataClicked}
                title={addData}
                aria-label={addData}
              />
            )}
            {terria.elements.get("side-panel-upload-data")?.visible !== false &&
              !terria.configParameters.disableUserAddedData && (
                <HeaderButton
                  ref={refForUploadData}
                  glyph={Icon.GLYPHS.uploadThin}
                  onClick={onAddLocalDataClicked}
                  title={t(($) => $.addData.load)}
                  aria-label={uploadText}
                />
              )}
            {itemCount > 0 && (
              <>
                <HeaderDivider />
                <HeaderButton
                  glyph={allHidden ? Icon.GLYPHS.enable : Icon.GLYPHS.disable}
                  onClick={toggleAllVisibility}
                  title={
                    allHidden
                      ? t(($) => $.workbench.enableAll)
                      : t(($) => $.workbench.disableAll)
                  }
                />
                <HeaderButton
                  glyph={
                    shouldExpandAll
                      ? Icon.GLYPHS.expandAll
                      : Icon.GLYPHS.collapse
                  }
                  onClick={toggleAllExpanded}
                  title={
                    shouldExpandAll
                      ? t(($) => $.workbench.expandAll)
                      : t(($) => $.workbench.collapseAll)
                  }
                />
                <HeaderButton
                  glyph={Icon.GLYPHS.trashcan}
                  danger
                  onClick={removeAll}
                  title={t(($) => $.workbench.removeAll)}
                />
              </>
            )}
            <HeaderDivider />
            <HeaderButton
              glyph={Icon.GLYPHS.leftSmall}
              onClick={() => viewState.setIsMapFullScreen(true)}
              title={t(($) => $.sui.hideWorkbench)}
              aria-label={t(($) => $.sui.hideWorkbench)}
            />
          </HeaderActions>
        </PanelHeader>
        <SearchArea>
          <SearchBoxAndResults
            placeholder={applyTranslationIfExists(
              terria.searchBarModel.placeholder,
              i18n
            )}
          />
        </SearchArea>
        <Box
          fullHeight
          column
          flex={1}
          css={`
            overflow: hidden;
          `}
        >
          {itemCount > 0 ? (
            <Workbench viewState={viewState} terria={terria} />
          ) : (
            <EmptyWorkbench theme={theme} />
          )}
        </Box>
      </Box>
    );
  }
);

// Used to create two refs for <SidePanel /> to consume, rather than
// using the withTerriaRef() HOC twice, designed for a single ref
const SidePanelWithRefs: FC<
  Omit<SidePanelProps, "refForExploreMapData" | "refForUploadData">
> = (props) => {
  const refForExploreMapData = useRefForTerria(
    EXPLORE_MAP_DATA_NAME,
    props.viewState
  );
  const refForUploadData = useRefForTerria(
    SIDE_PANEL_UPLOAD_BUTTON_NAME,
    props.viewState
  );
  return (
    <SidePanel
      {...props}
      refForExploreMapData={refForExploreMapData as Ref<HTMLButtonElement>}
      refForUploadData={refForUploadData as Ref<HTMLButtonElement>}
    />
  );
};

export default withTranslation()(withViewState(withTheme(SidePanelWithRefs)));
