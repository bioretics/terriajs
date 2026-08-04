import classNames from "classnames";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import styled, { useTheme } from "styled-components";
import { useViewState } from "../../Context";
import withControlledVisibility from "../../HOCs/withControlledVisibility";
import LangPanel from "../Panels/LangPanel/LangPanel";
import SettingPanel from "../Panels/SettingPanel";
import SharePanel from "../Panels/SharePanel/SharePanel";
import ToolsPanel from "../Panels/ToolsPanel/ToolsPanel";
// Fork (rer3d) panels/buttons:
import ColorPanel from "../Panels/ColorPanel/ColorPanel";
import CoordsPanel from "../Panels/CoordsPanel/CoordsPanel";
import EmergencyPlansButton from "./EmergencyPlansButton/EmergencyPlansButton";
import LoginButton from "./LoginButton/LoginButton";
import MicrozonationButton from "./MicrozonationButton/MicrozonationButton";
import HelpButton from "./HelpButton/HelpButton";
import StoryButton from "./StoryButton/StoryButton";

import IElementConfig from "../../../Models/IElementConfig";
import Styles from "./menu-bar.scss";

const StyledMenuBar = styled.div<{ trainerBarVisible: boolean }>`
  pointer-events: none;
  ${(p) =>
    p.trainerBarVisible &&
    `
    top: ${Number(p.theme.trainerHeight) + Number(p.theme.mapButtonTop)}px;
  `}
`;

interface PropsType {
  animationDuration?: number;
  menuItems: React.ReactElement[];
  menuLeftItems: React.ReactElement[];
  elementConfig?: IElementConfig;
}

// The map navigation region
const MenuBar = observer((props: PropsType) => {
  const theme = useTheme();
  const viewState = useViewState();
  const terria = viewState.terria;
  const menuItems = props.menuItems || [];
  const handleClick = () => {
    runInAction(() => {
      viewState.topElement = "MenuBar";
    });
  };

  const storyEnabled = terria.configParameters.storyEnabled;
  const loginEnabled = !!terria.configParameters.userProfileLoginServiceUrl;
  const enableTools = terria.userProperties.get("tools") === "1";
  const microzonationEnabled = !!terria.configParameters.microzonationConfig;

  return (
    <StyledMenuBar
      className={classNames(
        viewState.topElement === "MenuBar" ? "top-element" : "",
        Styles.menuBar,
        {
          [Styles.menuBarWorkbenchClosed]: viewState.isMapFullScreen
        }
      )}
      onClick={handleClick}
      trainerBarVisible={viewState.trainerBarVisible}
    >
      <section>
        <ul className={classNames(Styles.menu)}>
          {enableTools && (
            <li className={Styles.menuItem}>
              <ToolsPanel
                elementConfig={terria.elements.get("menu-bar-tools")}
              />
            </li>
          )}
          {!viewState.useSmallScreenInterface &&
            props.menuLeftItems.map((element, i) => (
              <li className={Styles.menuItem} key={i}>
                {element}
              </li>
            ))}
        </ul>
      </section>
      <section className={classNames(Styles.flex)}>
        <ul className={classNames(Styles.menu)}>
          <li className={Styles.menuItem}>
            <SettingPanel
              terria={terria}
              viewState={viewState}
              elementConfig={terria.elements.get("menu-bar-settings")}
            />
          </li>
          {terria.configParameters.coordsConverterUrl && (
            <li className={Styles.menuItem}>
              <CoordsPanel terria={terria} viewState={viewState} />
            </li>
          )}
          <li className={Styles.menuItem}>
            <ColorPanel terria={terria} viewState={viewState} />
          </li>
          <li className={Styles.menuItem}>
            <HelpButton elementConfig={terria.elements.get("menu-bar-help")} />
          </li>

          {terria.configParameters?.languageConfiguration?.enabled ? (
            <li className={Styles.menuItem}>
              <LangPanel
                terria={terria}
                smallScreen={viewState.useSmallScreenInterface}
                elementConfig={terria.elements.get("menu-bar-lang")}
              />
            </li>
          ) : null}
        </ul>
        {storyEnabled && (
          <ul className={classNames(Styles.menu)}>
            <li className={Styles.menuItem}>
              <StoryButton
                terria={terria}
                viewState={viewState}
                theme={theme}
                elementConfig={terria.elements.get("menu-bar-story")}
              />
            </li>
          </ul>
        )}
        {microzonationEnabled && (
          <ul className={classNames(Styles.menu)}>
            <li className={Styles.menuItem}>
              <MicrozonationButton
                terria={terria}
                viewState={viewState}
                theme={theme}
              />
            </li>
            <li className={Styles.menuItem}>
              <EmergencyPlansButton
                terria={terria}
                viewState={viewState}
                theme={theme}
              />
            </li>
          </ul>
        )}
        <ul className={classNames(Styles.menu)}>
          <li className={Styles.menuItem}>
            <SharePanel
              terria={terria}
              viewState={viewState}
              elementConfig={terria.elements.get("menu-bar-share")}
            />
          </li>
        </ul>
        {loginEnabled && (
          <ul className={classNames(Styles.menu)}>
            <li className={Styles.menuItem}>
              <LoginButton
                terria={terria}
                viewState={viewState}
                theme={theme}
              />
            </li>
          </ul>
        )}
        {!viewState.useSmallScreenInterface &&
          menuItems.map((element, i) => (
            <li className={Styles.menuItem} key={i}>
              {element}
            </li>
          ))}
      </section>
    </StyledMenuBar>
  );
});

export default withControlledVisibility(MenuBar);
