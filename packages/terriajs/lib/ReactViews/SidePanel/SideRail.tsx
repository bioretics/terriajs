import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { RawButton } from "../../Styled/Button";
import Icon, { StyledIcon } from "../../Styled/Icon";
import { useViewState } from "../Context";
import { ExplorerWindowElementName } from "../ExplorerWindow/ExplorerWindow";

const Rail = styled.nav`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  width: ${(p) => p.theme.sideRailWidth}px;
  height: 100%;
  box-sizing: border-box;
  padding: 8px 0;
  background: ${(p) => p.theme.card};
  border-right: 1px solid ${(p) => p.theme.border};
`;

const RailButton = styled(RawButton)<{ active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-radius: ${(p) => p.theme.radiusMedium};
  color: ${(p) => (p.active ? p.theme.textLight : p.theme.mutedForeground)};
  background: ${(p) => (p.active ? p.theme.accent : "transparent")};
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  svg {
    fill: currentColor;
  }

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.accent};
    color: ${(p) => p.theme.textLight};
  }
`;

const RailLabel = styled.span`
  font-family: ${(p) => p.theme.fontBase};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
`;

/**
 * Narrow vertical rail on the left edge of the workspace (GeoLibre-style).
 * Toggles the docked workbench ("Layers") and the data catalogue.
 */
const SideRail: FC = observer(() => {
  const { t } = useTranslation();
  const viewState = useViewState();
  const terria = viewState.terria;

  const layersLabel = t(($) => $.sui.sideRail.layers);
  const catalogLabel = t(($) => $.sui.sideRail.catalog);
  const layersVisible = !viewState.isMapFullScreen;
  const catalogVisible = viewState.explorerPanelIsVisible;

  const showLayersEntry =
    terria.elements.get("show-workbench")?.visible !== false;
  const showCatalogEntry =
    terria.elements.get("side-panel-add-data")?.visible !== false;

  const toggleLayers = () => {
    viewState.setIsMapFullScreen(!viewState.isMapFullScreen);
  };

  const toggleCatalog = () => {
    runInAction(() => {
      if (catalogVisible) {
        viewState.closeCatalog();
      } else {
        viewState.setTopElement(ExplorerWindowElementName);
        viewState.openAddData();
      }
    });
  };

  return (
    <Rail aria-label={layersLabel}>
      {showLayersEntry && (
        <RailButton
          type="button"
          active={layersVisible}
          aria-pressed={layersVisible}
          title={
            layersVisible
              ? t(($) => $.sui.sideRail.hidePanel, { name: layersLabel })
              : t(($) => $.sui.sideRail.showPanel, { name: layersLabel })
          }
          onClick={toggleLayers}
        >
          <StyledIcon glyph={Icon.GLYPHS.layers} styledWidth="16px" />
          <RailLabel>{layersLabel}</RailLabel>
        </RailButton>
      )}
      {showCatalogEntry && (
        <RailButton
          type="button"
          active={catalogVisible}
          aria-pressed={catalogVisible}
          title={
            catalogVisible
              ? t(($) => $.sui.sideRail.hidePanel, { name: catalogLabel })
              : t(($) => $.sui.sideRail.showPanel, { name: catalogLabel })
          }
          onClick={toggleCatalog}
        >
          <StyledIcon glyph={Icon.GLYPHS.dataCatalog} styledWidth="16px" />
          <RailLabel>{catalogLabel}</RailLabel>
        </RailButton>
      )}
    </Rail>
  );
});

export default SideRail;
