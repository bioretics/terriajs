import { observer } from "mobx-react";
import { FC } from "react";
import styled from "styled-components";
import { useViewState } from "../../Context";
import { MapCredits } from "./Credits";
import { LocationBar } from "./LocationBar";

// Docked status bar under the workspace (GeoLibre-style): monospace
// coordinate readout on the left, map credits on the right.
const StatusBarContainer = styled.footer`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 0 0 auto;
  height: ${(p) => p.theme.statusBarHeight}px;
  padding: 0 12px;
  box-sizing: border-box;
  border-top: 1px solid ${(p) => p.theme.border};
  background: ${(p) => p.theme.statusBarBg};
  color: ${(p) => p.theme.mutedForeground};
  font-family: ${(p) => p.theme.fontMono};
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
`;

const Spacer = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

export const StatusBar: FC = observer(() => {
  const viewState = useViewState();
  return (
    <StatusBarContainer>
      {!viewState.useSmallScreenInterface && (
        <LocationBar mouseCoords={viewState.terria.currentViewer.mouseCoords} />
      )}
      <Spacer />
      <MapCredits
        hideTerriaLogo={!!viewState.terria.configParameters.hideTerriaLogo}
        credits={viewState.terria.configParameters.extraCreditLinks?.slice()}
        currentViewer={viewState.terria.mainViewer.currentViewer}
        searchBarModel={viewState.terria.searchBarModel}
      />
    </StatusBarContainer>
  );
});

/** @deprecated use StatusBar */
export const BottomBar = StatusBar;
