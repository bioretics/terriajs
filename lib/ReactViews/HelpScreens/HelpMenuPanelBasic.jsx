"use strict";

import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import ObserveModelMixin from "../ObserveModelMixin";
import classNames from "classnames";
import MenuPanel from "../StandardUserInterface/customizable/MenuPanel.jsx";

import Styles from "./help-panel.scss";
import DropdownStyles from "../Map/Panels/panel.scss";
import helpIcon from "../../../wwwroot/images/icons/help.svg";

import { withTranslation } from "react-i18next";

const HelpMenuPanelBasic = createReactClass({
  displayName: "HelpMenuPanelBasic",
  mixins: [ObserveModelMixin],

  propTypes: {
    viewState: PropTypes.object.isRequired,
    t: PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      isOpen: false
    };
  },

  toggleShowHelpMenu(bool) {
    this.props.viewState.showHelpMenu = bool;
  },

  onOpenChanged(open) {
    this.toggleShowHelpMenu(open);
    this.setState({
      isOpen: open
    });
  },

  render() {
    const dropdownTheme = {
      btn: Styles.btnShare,
      outer: Styles.sharePanel,
      inner: Styles.dropdownInner,
      icon: helpIcon
    };
    const isOpen = this.props.viewState.showHelpMenu;

    const { t } = this.props;

    return (
      <MenuPanel
        theme={dropdownTheme}
        btnText={t("helpMenu.btnText")}
        viewState={this.props.viewState}
        isOpen={isOpen}
        onDismissed={() => {
          this.toggleShowHelpMenu(false);
        }}
        btnTitle={t("helpMenu.btnTitle")}
        onOpenChanged={this.onOpenChanged}
        // forceClosed={this.props.viewState.showSatelliteGuidance}
        smallScreen={this.props.viewState.useSmallScreenInterface}
      >
        <If condition={isOpen}>
          <div className={classNames(Styles.viewer, DropdownStyles.section)}>
            <label className={DropdownStyles.heading}>
              {t("helpMenu.helpMenuHeader")}
            </label>
            <ul className={Styles.viewerSelector}>
            <li className={Styles.listItem}>
                <a
                  target="_blank"
                  href="https://geoportale.regione.emilia-romagna.it/it/contenuti/geoportale-3d"
                  className={Styles.btnViewer}
                >
                  About
                </a>
              </li>
              <li className={Styles.listItem}>
                <button
                  onClick={() => {
                    var message = `
                      <div>
                          <p>La navigazione della mappa 3D è possibile in uno dei seguenti modi:</p>
                          <p>* usando il mouse ed il tasto CTRL;</p>
                          <p>* tramite i controlli sulla destra dell'interfaccia;</p>
                          <p>* attivando il bottone "Naviga da tastiera" ed usando poi questi tasti della tastiera:<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; w = zoom in<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; s = zoom out<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; q = muovi in su<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; e = muovi in giù<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; d = muovi a sinistra<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; a = muovi a destra<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; r = ruota in su<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; f = ruota in giù<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; z = ruota a sinistra<br>
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; x = ruota a destra</p>
                      </div>
                    `;
                    var options = {
                      title: 'Come navigare',
                      confirmText: ("Ok"),
                      width: 600,
                      height: 450,
                      message: message,
                      horizontalPadding : 100
                    };
                    this.props.viewState.notifications.push(options);
                  }}
                  className={Styles.btnViewer}
                >
              
                  {/*<NavigationHelpButton terria={this.props.terria} viewState={this.props.viewState}/>*/}
                  Come navigare
                  </button>
              </li>
              <li className={Styles.listItem}>
                <button
                  onClick={() => {
                    this.toggleShowHelpMenu(false);
                    this.props.viewState.showWelcomeMessage = true;
                    this.props.viewState.topElement = "WelcomeMessage";
                  }}
                  className={Styles.btnViewer}
                >
                  {t("helpMenu.helpMenuOpenWelcome")}
                </button>
              </li>
              <li className={Styles.listItem}>
                <button
                  onClick={() => {
                    this.toggleShowHelpMenu(false);
                    this.props.viewState.showSatelliteGuidance = true;
                    this.props.viewState.topElement = "Guide";
                  }}
                  className={Styles.btnViewer}
                >
                  {t("helpMenu.helpMenuSatelliteGuideTitle")}
                </button>
              </li>
              <li className={Styles.listItem}>
                <a
                  target="_blank"
                  href="./help/help.html"
                  className={Styles.btnViewer}
                >
                  {t("helpMenu.helpMenuMoreHelpTitle")}
                </a>
              </li>
            </ul>
          </div>
        </If>
      </MenuPanel>
    );
  }
});

export default withTranslation()(HelpMenuPanelBasic);
