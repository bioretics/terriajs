import classNames from "classnames";
import createReactClass from "create-react-class";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React from "react";
import { withTranslation } from "react-i18next";
import FeatureDetection from "terriajs-cesium/Source/Core/FeatureDetection";
import BottomDock from "../BottomDock/BottomDock";
import Loader from "../Loader";
import BottomLeftBar from "../Map/BottomLeftBar/BottomLeftBar";
import DistanceLegend from "../Map/Legend/DistanceLegend";
import LocationBar from "../Map/Legend/LocationBar";
import MenuBar from "../Map/MenuBar";
import MapNavigation from "../Map/Navigation/MapNavigation";
import TerriaViewerWrapper from "../Map/TerriaViewerWrapper";
import SlideUpFadeIn from "../Transitions/SlideUpFadeIn/SlideUpFadeIn";
import Styles from "./map-column.scss";
import Toast from "./Toast";
import Button from "../../Styled/Button";
import { withViewState } from "./ViewStateContext";

const chromeVersion = FeatureDetection.chromeVersion();

const flags = {
  moveForward: false,
  moveBackward: false,
  moveUp: false,
  moveDown: false,
  moveLeft: false,
  moveRight: false,
  rotateUp: false,
  rotateDown: false,
  rotateLeft: false,
  rotateRight: false
};

/**
 * Right-hand column that contains the map, controls that sit over the map and sometimes the bottom dock containing
 * the timeline and charts.
 */
const MapColumn = observer(
  createReactClass({
    displayName: "MapColumn",

    propTypes: {
      viewState: PropTypes.object.isRequired,
      customFeedbacks: PropTypes.array.isRequired,
      allBaseMaps: PropTypes.array.isRequired,
      animationDuration: PropTypes.number.isRequired,
      customElements: PropTypes.object.isRequired,
      t: PropTypes.func.isRequired
    },

    getInitialState() {
      return {};
    },

    onKeyDown(event) {
      const flagName = getFlagForKeyCode(event.key);
      if (typeof flagName !== "undefined") {
        flags[flagName] = true;
        keyboardTickFunc(this.props);
      }
    },

    onKeyUp(event) {
      const flagName = getFlagForKeyCode(event.key);
      if (typeof flagName !== "undefined") {
        flags[flagName] = false;
      }
    },

    render() {
      const { customElements } = this.props;
      const { t } = this.props;
      // TODO: remove? see: https://bugs.chromium.org/p/chromium/issues/detail?id=1001663
      const isAboveChrome75 =
        chromeVersion && chromeVersion[0] && Number(chromeVersion[0]) > 75;
      const mapCellClass = classNames(Styles.mapCell, {
        [Styles.mapCellChrome]: isAboveChrome75
      });
      const keyboardControlDescription =
        "Navigazione della mappa da tastiera\n  w = zoom in\n  s = zoom out\n  q = muovi in su\n  e = muovi in giù\n  d = muovi a sinistra\n  a = muovi a destra\n  r = ruota in su\n  f = ruota in giù\n  z = ruota a sinistra\n  x = ruota a destra";
      return (
        <div
          className={classNames(Styles.mapInner, {
            [Styles.mapInnerChrome]: isAboveChrome75
          })}
          onKeyDown={this.onKeyDown}
          onKeyUp={this.onKeyUp}
        >
          <div className={Styles.mapRow}>
            <div
              className={classNames(mapCellClass, Styles.mapCellMap)}
              ref={this.newMapCell}
            >
              <If condition={!this.props.viewState.hideMapUi}>
                <div
                  css={`
                    ${this.props.viewState.explorerPanelIsVisible &&
                      "opacity: 0.3;"}
                  `}
                >
                  <MenuBar
                    terria={this.props.viewState.terria}
                    viewState={this.props.viewState}
                    allBaseMaps={this.props.allBaseMaps}
                    menuItems={customElements.menu}
                    menuLeftItems={customElements.menuLeft}
                    animationDuration={this.props.animationDuration}
                    elementConfig={this.props.viewState.terria.elements.get(
                      "menu-bar"
                    )}
                  />
                  <MapNavigation
                    terria={this.props.viewState.terria}
                    viewState={this.props.viewState}
                    navItems={customElements.nav}
                    elementConfig={this.props.viewState.terria.elements.get(
                      "map-navigation"
                    )}
                  />
                </div>
              </If>
              <div
                className={Styles.mapWrapper}
                style={{
                  height: this.state.height || "100%"
                }}
              >
                <TerriaViewerWrapper
                  terria={this.props.viewState.terria}
                  viewState={this.props.viewState}
                />
              </div>
              <If condition={!this.props.viewState.hideMapUi}>
                <BottomLeftBar
                  terria={this.props.viewState.terria}
                  viewState={this.props.viewState}
                />
                <SlideUpFadeIn isVisible={this.props.viewState.isMapZooming}>
                  <Toast>
                    <Loader
                      message={t("toast.mapIsZooming")}
                      textProps={{
                        style: {
                          padding: "0 5px"
                        }
                      }}
                    />
                  </Toast>
                </SlideUpFadeIn>
                <div className={Styles.locationDistance}>
                  <LocationBar
                    terria={this.props.viewState.terria}
                    mouseCoords={
                      this.props.viewState.terria.currentViewer.mouseCoords
                    }
                  />
                  <DistanceLegend terria={this.props.viewState.terria} />
                </div>
              </If>
              {/* TODO: re-implement/support custom feedbacks */}
              {/* <If
                condition={
                  !this.props.customFeedbacks.length &&
                  this.props.viewState.terria.configParameters.feedbackUrl &&
                  !this.props.viewState.hideMapUi
                }
              >
                <div
                  className={classNames(Styles.feedbackButtonWrapper, {
                    [Styles.withTimeSeriesControls]: defined(
                      this.props.viewState.terria.timelineStack.top
                    )
                  })}
                >
                  <FeedbackButton
                    viewState={this.props.viewState}
                    btnText={t("feedback.feedbackBtnText")}
                  />
                </div>
              </If> */}

              <If
                condition={
                  this.props.customFeedbacks.length &&
                  this.props.viewState.terria.configParameters.feedbackUrl &&
                  !this.props.viewState.hideMapUi
                }
              >
                <For
                  each="feedbackItem"
                  of={this.props.customFeedbacks}
                  index="i"
                >
                  <div key={i}>{feedbackItem}</div>
                </For>
              </If>
              <If
                condition={
                  !this.props.viewState.useSmallScreenInterface &&
                  !this.props.viewState.hideMapUi
                }
              >
                <Button
                  type="button"
                  title={keyboardControlDescription}
                  style={{
                    right: "20px",
                    bottom: this.props.terria.configParameters.feedbackUrl
                      ? "110px"
                      : "75px",
                    position: "absolute"
                  }}
                  rounded
                  shortMinHeight
                  styledMinWidth={"80px"}
                  tabIndex={1}
                >
                  Naviga da tastiera
                </Button>
              </If>
            </div>
            <If
              condition={
                this.props.viewState.terria.configParameters.printDisclaimer
              }
            >
              <div className={classNames(Styles.mapCell, "print")}>
                <a
                  className={Styles.printDisclaimer}
                  href={
                    this.props.viewState.terria.configParameters.printDisclaimer
                      .url
                  }
                >
                  {
                    this.props.viewState.terria.configParameters.printDisclaimer
                      .text
                  }
                </a>
              </div>
            </If>
          </div>
          <If condition={!this.props.viewState.hideMapUi}>
            <div className={Styles.mapRow}>
              <div className={mapCellClass}>
                <BottomDock
                  terria={this.props.viewState.terria}
                  viewState={this.props.viewState}
                  elementConfig={this.props.viewState.terria.elements.get(
                    "bottom-dock"
                  )}
                />
              </div>
            </div>
          </If>
        </div>
      );
    }
  })
);

function getFlagForKeyCode(keyCode) {
  switch (keyCode) {
    case "w":
      return "moveForward";
    case "s":
      return "moveBackward";
    case "q":
      return "moveUp";
    case "e":
      return "moveDown";
    case "d":
      return "moveRight";
    case "a":
      return "moveLeft";
    case "r":
      return "rotateUp";
    case "f":
      return "rotateDown";
    case "z":
      return "rotateLeft";
    case "x":
      return "rotateRight";
    default:
      return undefined;
  }
}

function keyboardTickFunc(props) {
  const scene = props.terria.cesium.scene;
  const ellipsoid = scene.globe.ellipsoid;
  const camera = scene.camera;
  const cameraHeight = ellipsoid.cartesianToCartographic(camera.position)
    .height;
  const moveRate = cameraHeight / 100.0;

  if (flags.moveForward) {
    camera.moveForward(moveRate);
  }
  if (flags.moveBackward) {
    camera.moveBackward(moveRate);
  }
  if (flags.moveUp) {
    camera.moveUp(moveRate);
  }
  if (flags.moveDown) {
    camera.moveDown(moveRate);
  }
  if (flags.moveLeft) {
    camera.moveLeft(moveRate);
  }
  if (flags.moveRight) {
    camera.moveRight(moveRate);
  }
  if (flags.rotateUp) {
    camera.lookUp();
  }
  if (flags.rotateDown) {
    camera.lookDown();
  }
  if (flags.rotateLeft) {
    camera.lookLeft();
  }
  if (flags.rotateRight) {
    camera.lookRight();
  }

  props.terria.currentViewer.notifyRepaintRequired();
}

export default withTranslation()(withViewState(MapColumn));
