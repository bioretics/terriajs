import classNames from "classnames";
import "inobounce";
import { action } from "mobx";
import { observer } from "mobx-react";
import { FC, DragEvent, ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DefaultTheme } from "styled-components";
import combine from "terriajs-cesium/Source/Core/combine";
import ViewState from "../../ReactViewModels/ViewState";
import Disclaimer from "../Disclaimer";
import DragDropFile from "../DragDropFile";
import { ExplorerWindowComponents } from "../ExplorerWindow/ExplorerWindowComponents";
import FeatureInfoPanel from "../FeatureInfo/FeatureInfoPanel";
import FeedbackForm from "../Feedback/FeedbackForm";
import { Medium, Small } from "../Generic/Responsive";
import SatelliteHelpPrompt from "../HelpScreens/SatelliteHelpPrompt";
import withFallback from "../HOCs/withFallback";
import ExperimentalFeatures from "./ExperimentalFeatures";
import { CollapsedNavigation } from "../Map/MapNavigation";
import HelpPanel from "../Map/Panels/HelpPanel/HelpPanel";
import PrintView from "../Map/Panels/SharePanel/Print/PrintView";
import TrainerBar from "./TrainerBar/TrainerBar";
import MobileHeader from "../Mobile/MobileHeader";
import MapInteractionWindow from "../Notification/MapInteractionWindow";
import Notification from "../Notification/Notification";
import SidePanel from "../SidePanel/SidePanel";
import SideRail from "../SidePanel/SideRail";
import StoryBuilder from "../Story/StoryBuilder";
import StoryPanel from "../Story/StoryPanel/StoryPanel";
import ClippingBoxToolLauncher from "../Tools/ClippingBox/ClippingBoxToolLauncher";
import Tool from "../Tools/Tool";
import TourPortal from "../Tour/TourPortal";
import WelcomeMessage from "../WelcomeMessage/WelcomeMessage";
import SelectableDimensionWorkflow from "../Workflow/SelectableDimensionWorkflow";
import WorkflowPanelPortal from "../Workflow/WorkflowPanelPortal";
import { ContextProviders } from "../Context";
import { GlobalTerriaStyles } from "./GlobalTerriaStyles";
import MapColumn from "../Map/MapColumn";
import MenuBar from "../Map/MenuBar/MenuBar";
import { StatusBar } from "../Map/BottomBar";
import processCustomElements from "./processCustomElements";
import SidePanelContainer from "./SidePanelContainer";
import Styles from "./standard-user-interface.scss";
import { terriaTheme } from "./StandardTheme";
import MeasurablePanel from "../MeasurableGeometry/MeasurablePanel";
import MeasurableDownloadPanel from "../MeasurableGeometry/MeasurableDownloadPanel";
import PlayPathPanel from "../MeasurableGeometry/PlayPathPanel";
import MicrozonationPanel from "../Microzonation/MicrozonationPanel";
import QueryWindow from "../QueryWindow/QueryWindow";
import { MessageModal } from "../MessageModal/MessageModal";
import ViewshedPanel from "../Viewshed/ViewshedPanel";
import LoginPanel from "../Login/LoginPanel";

export const animationDuration = 250;

interface StandardUserInterfaceProps {
  terria: ViewState["terria"];
  viewState: ViewState;
  themeOverrides?: Partial<DefaultTheme>;
  minimumLargeScreenWidth?: number;
  version: string;
  children?: ReactNode;
}

const StandardUserInterfaceBase: FC<StandardUserInterfaceProps> = observer(
  (props) => {
    const { t } = useTranslation();

    const acceptDragDropFile = action(() => {
      props.viewState.isDraggingDroppingFile = true;
      // if explorer window is already open, we open my data tab
      if (props.viewState.explorerPanelIsVisible) {
        props.viewState.openUserData();
      }
    });

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      if (props.terria.configParameters.disableUserAddedData) {
        return;
      }
      if (!e.dataTransfer.types || !e.dataTransfer.types.includes("Files")) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      acceptDragDropFile();
    };

    const shouldUseMobileInterface = () =>
      !props.terria.configParameters.disableMobileInterface &&
      // Fork (rer3d): wider small-screen breakpoint (1100px).
      document.body.clientWidth < (props.minimumLargeScreenWidth ?? 1100);

    const resizeListener = action(() => {
      props.viewState.useSmallScreenInterface = shouldUseMobileInterface();
    });

    useEffect(() => {
      window.addEventListener("resize", resizeListener, false);
      return () => {
        window.removeEventListener("resize", resizeListener, false);
      };
      /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, []);

    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    useEffect(resizeListener, [props.minimumLargeScreenWidth]);

    useEffect(() => {
      if (
        props.terria.configParameters.storyEnabled &&
        props.terria.stories &&
        props.terria.stories.length &&
        !props.viewState.storyShown
      ) {
        props.terria.notificationState.addNotificationToQueue({
          title: t(($) => $.sui.notifications.title),
          message: t(($) => $.sui.notifications.message),
          confirmText: t(($) => $.sui.notifications.confirmText),
          denyText: t(($) => $.sui.notifications.denyText),
          confirmAction: action(() => {
            props.viewState.storyShown = true;
          }),
          denyAction: action(() => {
            props.viewState.storyShown = false;
          }),
          type: "story",
          width: 300
        });
      }
      /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [props.terria.storyPromptShown]);

    // Merge theme in order of highest priority: themeOverrides props -> theme config parameter -> default terriaTheme
    const mergedTheme = combine(
      props.themeOverrides,
      combine(props.terria.configParameters.theme, terriaTheme, true),
      true
    );
    const theme = mergedTheme;

    const customElements = processCustomElements(
      props.viewState.useSmallScreenInterface,
      props.children
    );

    const showStoryBuilder =
      props.viewState.storyBuilderShown &&
      !props.viewState.useSmallScreenInterface;
    const showMicrozonationPanel =
      props.viewState.microzonationPanelShown &&
      !props.viewState.useSmallScreenInterface &&
      !!props.terria.configParameters.microzonationConfig;
    const showStoryPanel =
      props.terria.configParameters.storyEnabled &&
      props.terria.stories.length > 0 &&
      props.viewState.storyShown &&
      !props.viewState.explorerPanelIsVisible &&
      !props.viewState.storyBuilderShown;
    const disableMobileInterface =
      !!props.terria.configParameters.disableMobileInterface;
    const showChrome = !props.viewState.hideMapUi;

    return (
      <ContextProviders viewState={props.viewState} theme={mergedTheme}>
        <GlobalTerriaStyles />
        <TourPortal />
        <CollapsedNavigation />
        <SatelliteHelpPrompt />
        <Medium>
          <SelectableDimensionWorkflow />
        </Medium>
        <div className={Styles.storyWrapper}>
          {!props.viewState.disclaimerVisible && <WelcomeMessage />}
          <div
            className={Styles.uiRoot}
            css={`
              ${props.viewState.disclaimerVisible && `filter: blur(10px);`}
            `}
            onDragOver={handleDragOver}
          >
            <div
              className={Styles.ui}
              css={`
                background: ${theme.dark};
              `}
            >
              <div className={Styles.uiInner}>
                {/* Top toolbar (desktop) / mobile header */}
                {showChrome && !disableMobileInterface && (
                  <Small>
                    <MobileHeader
                      menuItems={customElements.menu}
                      menuLeftItems={customElements.menuLeft}
                      version={props.version}
                    />
                  </Small>
                )}
                {showChrome && (
                  <Medium>
                    <MenuBar
                      menuItems={customElements.menu}
                      menuLeftItems={customElements.menuLeft}
                      animationDuration={animationDuration}
                      version={props.version}
                      elementConfig={props.terria.elements.get("menu-bar")}
                    />
                  </Medium>
                )}

                {/* Workspace: side rail + docked workbench + map */}
                <div
                  className={classNames(Styles.workspace, {
                    [Styles.workspaceNoMobileHeader]: disableMobileInterface
                  })}
                >
                  {showChrome && (
                    <Medium>
                      <>
                        <SideRail />
                        <WorkflowPanelPortal
                          show={props.terria.isWorkflowPanelActive}
                        />
                        <SidePanelContainer
                          show={
                            !props.viewState.isMapFullScreen &&
                            !props.terria.isWorkflowPanelActive
                          }
                        >
                          <SidePanel />
                        </SidePanelContainer>
                      </>
                    </Medium>
                  )}

                  <section className={Styles.map}>
                    <MapColumn
                      customElements={customElements}
                      animationDuration={animationDuration}
                    />
                    <div id="map-data-attribution" />
                    {showChrome && (
                      <Medium>
                        <TrainerBar />
                      </Medium>
                    )}
                    <div
                      className={classNames(
                        Styles.featureInfo,
                        props.viewState.topElement === "FeatureInfo"
                          ? "top-element"
                          : "",
                        {
                          [Styles.featureInfoFullScreen]:
                            props.viewState.isMapFullScreen
                        }
                      )}
                      tabIndex={0}
                      onPointerDown={action(() => {
                        props.viewState.topElement = "FeatureInfo";
                      })}
                    >
                      <FeatureInfoPanel />
                      <MeasurablePanel
                        terria={props.terria}
                        viewState={props.viewState}
                      />
                      <MeasurableDownloadPanel
                        terria={props.terria}
                        viewState={props.viewState}
                      />
                      <PlayPathPanel
                        terria={props.terria}
                        viewState={props.viewState}
                      />
                      <ViewshedPanel
                        terria={props.terria}
                        viewState={props.viewState}
                      />
                      <LoginPanel
                        terria={props.terria}
                        viewState={props.viewState}
                      />
                    </div>
                    {showStoryPanel && (
                      <div
                        className={classNames(
                          Styles.storyPanel,
                          props.viewState.topElement === "StoryPanel"
                            ? "top-element"
                            : "",
                          {
                            [Styles.storyPanelFullScreen]:
                              props.viewState.isMapFullScreen
                          }
                        )}
                        tabIndex={0}
                        onPointerDown={action(() => {
                          props.viewState.topElement = "StoryPanel";
                        })}
                      >
                        <StoryPanel />
                      </div>
                    )}
                    <main>
                      <ExplorerWindowComponents.ExplorerWindow />
                      {/* Fork (rer3d): query-data window + message modal */}
                      <QueryWindow />
                      {props.terria.messageModal?.isVisible && (
                        <MessageModal
                          closeModal={() => props.viewState.closeMessageModal()}
                          header={props.terria.messageModal.header}
                          message={props.terria.messageModal.message}
                        />
                      )}
                      {props.terria.configParameters.experimentalFeatures &&
                        showChrome && (
                          <ExperimentalFeatures
                            experimentalItems={customElements.experimentalMenu}
                          />
                        )}
                    </main>
                  </section>
                </div>

                {/* Status bar */}
                {showChrome && <StatusBar />}
              </div>
            </div>
            <Medium>
              {/* I think this does what the previous boolean condition does, but without the console error */}
              {props.viewState.isToolOpen && (
                <Tool {...props.viewState.currentTool!} />
              )}
            </Medium>

            {props.viewState.panel}

            <Notification />
            <MapInteractionWindow />
            {!customElements.feedback.length &&
              props.terria.feedbackService &&
              showChrome &&
              props.viewState.feedbackFormIsVisible && <FeedbackForm />}
            <DragDropFile />
          </div>
          {props.terria.configParameters.storyEnabled && showStoryBuilder && (
            <StoryBuilder
              isVisible={showStoryBuilder}
              animationDuration={animationDuration}
            />
          )}
          {showMicrozonationPanel && (
            <MicrozonationPanel
              isVisible={showMicrozonationPanel}
              animationDuration={animationDuration}
            />
          )}
          {props.viewState.showHelpMenu &&
            props.viewState.topElement === "HelpPanel" && <HelpPanel />}
          <Disclaimer />
        </div>
        {props.viewState.printWindow && (
          <PrintView
            window={props.viewState.printWindow}
            closeCallback={() => props.viewState.setPrintWindow(null)}
          />
        )}
        <ClippingBoxToolLauncher viewState={props.viewState} />
      </ContextProviders>
    );
  }
);

export const StandardUserInterface = withFallback(StandardUserInterfaceBase);
export default withFallback(StandardUserInterfaceBase);
