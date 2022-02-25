import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import "mutationobserver-shim";

import TerriaViewerWrapper from "../Map/TerriaViewerWrapper";
import DistanceLegend from "../Map/Legend/DistanceLegend";
// import FeedbackButton from "../Feedback/FeedbackButton";
import LocationBar from "../Map/Legend/LocationBar";
import MapNavigation from "../Map/Navigation/MapNavigation";
import MenuBar from "../Map/MenuBar";
import MapDataCount from "../BottomDock/MapDataCount";
// import defined from "terriajs-cesium/Source/Core/defined";
import FeatureDetection from "terriajs-cesium/Source/Core/FeatureDetection";
import BottomDock from "../BottomDock/BottomDock";
import classNames from "classnames";
import { withTranslation } from "react-i18next";
import Toast from "./Toast";
import Loader from "../Loader";
import Styles from "./map-column.scss";
import { observer } from "mobx-react";
import SlideUpFadeIn from "../Transitions/SlideUpFadeIn/SlideUpFadeIn";
import Button from "../../Styled/Button";

const isIE = FeatureDetection.isInternetExplorer();
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
 *
 * Note that because IE9-11 is terrible the pure-CSS layout that is used in nice browsers doesn't work, so for IE only
 * we use a (usually polyfilled) MutationObserver to watch the bottom dock and resize when it changes.
 */
const MapColumn = observer(
  createReactClass({
    displayName: "MapColumn",

    propTypes: {
      terria: PropTypes.object.isRequired,
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

    /* eslint-disable-next-line camelcase */
    UNSAFE_componentWillMount() {
      if (isIE) {
        this.observer = new MutationObserver(this.resizeMapCell);
        window.addEventListener("resize", this.resizeMapCell, false);
      }
    },

    addBottomDock(bottomDock) {
      if (isIE) {
        this.observer.observe(bottomDock, {
          childList: true,
          subtree: true
        });
      }
    },

    newMapCell(mapCell) {
      if (isIE) {
        this.mapCell = mapCell;

        this.resizeMapCell();
      }
    },

    resizeMapCell() {
      if (this.mapCell) {
        this.setState({
          height: this.mapCell.offsetHeight
        });
      }
    },

    componentWillUnmount() {
      if (isIE) {
        window.removeEventListener("resize", this.resizeMapCell, false);
        this.observer.disconnect();
      }
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
      // const { t } = this.props;
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
                    terria={this.props.terria}
                    viewState={this.props.viewState}
                    allBaseMaps={this.props.allBaseMaps}
                    menuItems={customElements.menu}
                    menuLeftItems={customElements.menuLeft}
                    animationDuration={this.props.animationDuration}
                    elementConfig={this.props.terria.elements.get("menu-bar")}
                  />
                  <MapNavigation
                    terria={this.props.terria}
                    viewState={this.props.viewState}
                    navItems={customElements.nav}
                    elementConfig={this.props.terria.elements.get(
                      "map-navigation"
                    )}
                  />
                </div>
              </If>
              <div
                className={Styles.mapWrapper}
                style={{
                  height: this.state.height || (isIE ? "100vh" : "100%")
                }}
              >
                <TerriaViewerWrapper
                  terria={this.props.terria}
                  viewState={this.props.viewState}
                />
              </div>
              <Choose>
                <When condition={this.props.viewState.useSmallScreenInterface}>
                  <div className={Styles.distanceLegendMobile}>
                    <DistanceLegend terria={this.props.terria} />
                  </div>
                </When>
                <Otherwise>
                  <MapDataCount
                    terria={this.props.terria}
                    viewState={this.props.viewState}
                    elementConfig={this.props.terria.elements.get(
                      "map-data-count"
                    )}
                  />
                  <SlideUpFadeIn isVisible={this.props.viewState.isMapZooming}>
                    <Toast>
                      <Loader
                        message={this.props.t("toast.mapIsZooming")}
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
                      terria={this.props.terria}
                      mouseCoords={this.props.terria.currentViewer.mouseCoords}
                    />
                    <DistanceLegend terria={this.props.terria} />
                  </div>
                </Otherwise>
              </Choose>
              <If
                condition={
                  this.props.customFeedbacks.length &&
                  this.props.terria.configParameters.feedbackUrl &&
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
            <If condition={this.props.terria.configParameters.printDisclaimer}>
              <div className={classNames(Styles.mapCell, "print")}>
                <a
                  className={Styles.printDisclaimer}
                  href={this.props.terria.configParameters.printDisclaimer.url}
                >
                  {this.props.terria.configParameters.printDisclaimer.text}
                </a>
              </div>
            </If>
          </div>
          <If condition={!this.props.viewState.hideMapUi}>
            <div className={Styles.mapRow}>
              <div className={mapCellClass}>
                <BottomDock
                  terria={this.props.terria}
                  viewState={this.props.viewState}
                  domElementRef={this.addBottomDock}
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

export default withTranslation()(MapColumn);
