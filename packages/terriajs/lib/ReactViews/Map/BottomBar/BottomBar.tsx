import { VFC } from "react";
import Box from "../../../Styled/Box";
import { useViewState } from "../../Context";
import { MapCredits } from "./Credits";
import { DistanceLegend } from "./DistanceLegend";
import { LocationBar } from "./LocationBar";
import { useTheme } from "styled-components";

export const BottomBar: VFC = () => {
  const viewState = useViewState();
  const theme = useTheme();
  return (
    <Box
      justifySpaceBetween
      css={`
        /* Fork (rer3d): rounded translucent bottom bar */
        border-radius: 8px 8px 8px 8px;
        font-size: 0.7rem;
        width: 96%;
        background: ${theme.darkTranslucent ?? theme.transparentDark};
        backdrop-filter: blur(5px);
        margin-top: 2px;
      `}
    >
      <MapCredits
        hideTerriaLogo={!!viewState.terria.configParameters.hideTerriaLogo}
        credits={viewState.terria.configParameters.extraCreditLinks?.slice()}
        currentViewer={viewState.terria.mainViewer.currentViewer}
        searchBarModel={viewState.terria.searchBarModel}
      />
      <Box paddedHorizontally={4} gap={2}>
        {!viewState.useSmallScreenInterface && (
          <LocationBar
            mouseCoords={viewState.terria.currentViewer.mouseCoords}
          />
        )}
        <DistanceLegend />
      </Box>
    </Box>
  );
};
