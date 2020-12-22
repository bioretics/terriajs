import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import classNames from "classnames";

import DataCatalog from "../DataCatalog/DataCatalog.jsx";
import DataPreview from "../Preview/DataPreview.jsx";
import MobileSearch from "./MobileSearch.jsx";
import WorkbenchList from "../Workbench/WorkbenchList.jsx";
import ObserveModelMixin from "../ObserveModelMixin";
import Icon from "../Icon";

import Styles from "./mobile-modal-window.scss";


import MyDataTab from "../ExplorerWindow/Tabs/MyDataTab/MyDataTab.jsx";
import SidebarElevation from '../Map/Elevation/SidebarElevation.jsx';

const MobileModalWindow = createReactClass({
  displayName: "MobileModalWindow",
  mixins: [ObserveModelMixin],

  propTypes: {
    terria: PropTypes.object,
    viewState: PropTypes.object.isRequired
  },

  renderModalContent() {
    const viewState = this.props.viewState;
    const searchState = viewState.searchState;

    if (
      viewState.mobileView !== viewState.mobileViewOptions.data &&
      viewState.mobileView !== viewState.mobileViewOptions.preview &&
      searchState.showMobileLocationSearch &&
      searchState.locationSearchText.length > 0
    ) {
      return (
        <MobileSearch
          terria={this.props.terria}
          viewState={this.props.viewState}
        />
      );
    }

    switch (viewState.mobileView) {
      case viewState.mobileViewOptions.data:
        return (
          <div>
            <div>
              <DataCatalog
                items={this.props.terria.catalog.userAddedDataGroup.items}
                removable={true}
                viewState={this.props.viewState}
                terria={this.props.terria}
              />
            </div>
            <div>
              <DataCatalog
                terria={this.props.terria}
                viewState={this.props.viewState}
                items={this.props.terria.catalog.group.items}
              />
            </div>
          </div>
        );
      case viewState.mobileViewOptions.addData:
        return (
          <MyDataTab
            terria={this.props.terria}
            viewState={this.props.viewState}
          />
        );
      case viewState.mobileViewOptions.preview:
        return (
          <DataPreview
            terria={this.props.terria}
            viewState={this.props.viewState}
            previewed={this.props.viewState.previewedItem}
          />
        );
      case viewState.mobileViewOptions.userPreview:
        return (
          <DataPreview
            terria={this.props.terria}
            viewState={this.props.viewState}
            previewed={this.props.viewState.userDataPreviewedItem}
          />
        );
      case viewState.mobileViewOptions.nowViewing:
        return (
          <WorkbenchList
            viewState={this.props.viewState}
            terria={this.props.terria}
          />
        );
      case viewState.mobileViewOptions.elevationChart:
        return (
          <If condition={
            typeof this.props.terria.leaflet == "undefined" &&
            typeof this.props.terria.elevationPoints !== "undefined" //&&
            //this.props.terria.elevationPoints.length > 0
          }>
            <SidebarElevation
              terria={this.props.terria}
              viewState={this.props.viewState}
            />
          </If>
        );
      default:
        return null;
    }
  },

  onClearMobileUI() {
    this.props.viewState.switchMobileView(null);
    this.props.viewState.explorerPanelIsVisible = false;
    this.props.viewState.searchState.showMobileLocationSearch = false;
    this.props.viewState.searchState.showMobileCatalogSearch = false;
    this.props.viewState.searchState.catalogSearchText = "";
  },

  /* eslint-disable-next-line camelcase */
  UNSAFE_componentWillReceiveProps() {
    if (
      this.props.terria.nowViewing.items.length === 0 &&
      this.props.viewState.mobileView ===
        this.props.viewState.mobileViewOptions.nowViewing
    ) {
      this.props.viewState.switchMobileView(null);
      this.props.viewState.explorerPanelIsVisible = false;
    }
  },

  goBack() {
    this.props.viewState.mobileView = this.props.viewState.mobileViewOptions.data;
  },

  render() {
    const modalClass = classNames(Styles.mobileModal, {
      [Styles.isOpen]:
        this.props.viewState.explorerPanelIsVisible &&
        this.props.viewState.mobileView
    });
    const mobileView = this.props.viewState.mobileView;

    return (
      <div className={modalClass}>
        <div className={Styles.modalBg}>
          <div className={Styles.modalTop}>
            <If
              condition={
                this.props.viewState.explorerPanelIsVisible && mobileView
              }
            >
              <button
                type="button"
                className={Styles.doneButton}
                onClick={this.onClearMobileUI}
              >
                Done
              </button>
            </If>
            <button
              type="button"
              disabled={
                mobileView !== this.props.viewState.mobileViewOptions.preview
              }
              className={classNames(Styles.backButton, {
                [Styles.backButtonInactive]:
                  mobileView !== this.props.viewState.mobileViewOptions.preview
              })}
              onClick={this.goBack}
            >
              <Icon className={Styles.iconBack} glyph={Icon.GLYPHS.left} />
            </button>
          </div>

          {this.renderModalContent()}
        </div>
      </div>
    );
  }
});
module.exports = MobileModalWindow;
