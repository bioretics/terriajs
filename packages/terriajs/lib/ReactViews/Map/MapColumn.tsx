import { observer } from "mobx-react";
import { FC, useRef } from "react";
import { useTranslation } from "react-i18next";
import Box from "../../Styled/Box";
import ActionBarPortal from "../ActionBar/ActionBarPortal";
import BottomDock from "../BottomDock/BottomDock";
import { useViewState } from "../Context";
import Loader from "../Loader";
import SlideUpFadeIn from "../Transitions/SlideUpFadeIn/SlideUpFadeIn";
import { DistanceLegend } from "./BottomBar";
import BottomLeftBar from "./BottomLeftBar/BottomLeftBar";
import { MapNavigation } from "./MapNavigation";
import { ProgressBar } from "./ProgressBar";
import { TerriaViewerWrapper } from "./TerriaViewerWrapper";
import Toast from "./Toast";
import { useTheme } from "styled-components";

interface IMapColumnProps {
  animationDuration: number;
  customElements: any;
}

/**
 * The map area: the viewer, the controls that sit over the map and the
 * bottom dock containing the timeline and charts. The menu bar and the status
 * bar are rendered by StandardUserInterface around the workspace.
 */
export const MapColumn: FC<IMapColumnProps> = observer(({ customElements }) => {
  const viewState = useViewState();
  const theme = useTheme();
  const { t } = useTranslation();
  const loaderRef = useRef(null);

  // Keep the bottom dock clear of the map controls column on the right.
  const controlsColumnWidth = viewState.useSmallScreenInterface
    ? 0
    : Number(theme.mapControlSize) + Number(theme.workbenchMargin) * 2;

  return (
    <Box
      column
      fullWidth
      fullHeight
      css={`
        * {
          box-sizing: border-box;
        }
      `}
    >
      <Box column fullWidth fullHeight>
        <div
          css={{
            position: "absolute",
            top: "0",
            left: "0",
            zIndex: 1,
            width: "100%"
          }}
        >
          <ProgressBar />
        </div>
        {!viewState.hideMapUi && (
          <div
            css={`
              ${viewState.explorerPanelIsVisible && "opacity: 0.3;"}
            `}
          >
            <MapNavigation
              viewState={viewState}
              navItems={customElements.nav}
              elementConfig={viewState.terria.elements.get("map-navigation")}
            />
          </div>
        )}
        <Box
          position="absolute"
          css={{ top: "0", zIndex: 0 }}
          fullWidth
          fullHeight
        >
          <TerriaViewerWrapper />
        </Box>
        {!viewState.hideMapUi && (
          <>
            <ActionBarPortal show={viewState.isActionBarVisible} />
            <SlideUpFadeIn
              isVisible={viewState.isMapZooming}
              nodeRef={loaderRef}
            >
              <Toast ref={loaderRef}>
                <Loader
                  message={t(($) => $.toast.mapIsZooming)}
                  textProps={{
                    style: {
                      padding: "0 5px"
                    }
                  }}
                />
              </Toast>
            </SlideUpFadeIn>
            <div
              css={`
                position: absolute;
                left: 0;
                right: ${controlsColumnWidth}px;
                bottom: 0;
              `}
            >
              <Box
                fullWidth
                alignItemsFlexEnd
                gap={2}
                css={`
                  padding: 0 ${theme.workbenchMargin}px
                    ${theme.workbenchMargin}px;
                `}
              >
                <DistanceLegend />
                <BottomLeftBar />
              </Box>
              <BottomDock
                terria={viewState.terria}
                viewState={viewState}
                elementConfig={viewState.terria.elements.get("bottom-dock")}
              />
            </div>

            {viewState.terria.configParameters.printDisclaimer && (
              <a
                css={`
                  display: none;
                  @media print {
                    display: block;
                    width: 100%;
                    clear: both;
                  }
                `}
                href={viewState.terria.configParameters.printDisclaimer.url}
              >
                {viewState.terria.configParameters.printDisclaimer.text}
              </a>
            )}
          </>
        )}
      </Box>
    </Box>
  );
});

export default MapColumn;
