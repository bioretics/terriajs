import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import "mutationobserver-shim";

import TerriaViewerWrapper from "../Map/TerriaViewerWrapper.jsx";
import LocationBar from "../Map/Legend/LocationBar.jsx";
import DistanceLegend from "../Map/Legend/DistanceLegend.jsx";
import FeedbackButton from "../Feedback/FeedbackButton.jsx";
import ObserveModelMixin from "../ObserveModelMixin";
import BottomDock from "../BottomDock/BottomDock.jsx";
import defined from "terriajs-cesium/Source/Core/defined";
import FeatureDetection from "terriajs-cesium/Source/Core/FeatureDetection";
import classNames from "classnames";

import Styles from "./map-column.scss";
import Styles2 from "../Feedback/feedback-button.scss";
import Icon from "../Icon.jsx";

const isIE = FeatureDetection.isInternetExplorer();

var flags = {
    moveForward : false,
    moveBackward : false,
    moveUp : false,
    moveDown : false,
    moveLeft : false,
    moveRight : false,
    rotateUp : false,
    rotateDown : false,
    rotateLeft : false,
    rotateRight : false
};

/**
 * Right-hand column that contains the map, controls that sit over the map and sometimes the bottom dock containing
 * the timeline and charts.
 *
 * Note that because IE9-11 is terrible the pure-CSS layout that is used in nice browsers doesn't work, so for IE only
 * we use a (usually polyfilled) MutationObserver to watch the bottom dock and resize when it changes.
 */
const MapColumn = createReactClass({
  displayName: "MapColumn",
  mixins: [ObserveModelMixin],

  propTypes: {
    terria: PropTypes.object.isRequired,
    viewState: PropTypes.object.isRequired,
    customFeedbacks: PropTypes.array.isRequired
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
    //this.props.terria.clock.onTick.addEventListener(keyboardTickFunc.bind(undefined, this.props));
    var flagName = getFlagForKeyCode(event.key);
    if (typeof flagName !== 'undefined') {
      flags[flagName] = true;
      keyboardTickFunc(this.props);
    }
  },

  onKeyUp(event) {
    //this.props.terria.clock.onTick.removeEventListener(keyboardTickFunc);
    var flagName = getFlagForKeyCode(event.key);
    if (typeof flagName !== 'undefined') {
      flags[flagName] = false;
    }
  },

  render() {
    const keyboardControlDescription = 'Navigazione della mappa da tastiera\n  w = zoom in\n  s = zoom out\n  q = muovi in su\n  e = muovi in giù\n  d = muovi a sinistra\n  a = muovi a destra\n  r = ruota in su\n  f = ruota in giù\n  z = ruota a sinistra\n  x = ruota a destra';
    return (
      <div className={Styles.mapInner} onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp}>
        <div className={Styles.mapRow}>
          <div
            className={classNames(Styles.mapCell, Styles.mapCellMap)}
            ref={this.newMapCell}
          >
            <div
              className={Styles.mapWrapper}
              style={{ height: this.state.height || (isIE ? "100vh" : "100%") }}
            >
              <TerriaViewerWrapper
                terria={this.props.terria}
                viewState={this.props.viewState}
              />
            </div>
            <If condition={!this.props.viewState.hideMapUi()}>
              <div className={Styles.locationDistance}>
                <LocationBar
                  terria={this.props.terria}
                  mouseCoords={this.props.viewState.mouseCoords}
                />
                <DistanceLegend terria={this.props.terria} />
              </div>
            </If>
            <If
              condition={
                !this.props.customFeedbacks.length &&
                this.props.terria.configParameters.feedbackUrl &&
                !this.props.viewState.hideMapUi()
              }
            >
              <div
                className={classNames(Styles.feedbackButtonWrapper, {
                  [Styles.withTimeSeriesControls]: defined(
                    this.props.terria.timeSeriesStack.topLayer
                  )
                })}
              >
                <FeedbackButton viewState={this.props.viewState} />
              </div>
            </If>

            <If
              condition={
                this.props.customFeedbacks.length &&
                this.props.terria.configParameters.feedbackUrl &&
                !this.props.viewState.hideMapUi()
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
            <If condition={!this.props.viewState.useSmallScreenInterface && !this.props.viewState.hideMapUi()}>
              <div className={Styles.feedbackButtonWrapper}>
                <div className={Styles2.feedback}>
                  <button type='button' className={Styles2.btnFeedback} title={keyboardControlDescription}>
                    <span>Naviga da tastiera</span>
                  </button>
                </div>
              </div>
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
        <If condition={!this.props.viewState.hideMapUi()}>
          <div className={Styles.mapRow}>
            <div className={Styles.mapCell}>
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
});

function getFlagForKeyCode(keyCode) {
    switch (keyCode) {
    case 'w':
        return 'moveForward';
    case 's':
        return 'moveBackward';
    case 'q':
        return 'moveUp';
    case 'e':
        return 'moveDown';
    case 'd':
        return 'moveRight';
    case 'a':
        return 'moveLeft';
    case 'r':
        return 'rotateUp';
    case 'f':
        return 'rotateDown';
    case 'z':
        return 'rotateLeft';
    case 'x':
        return 'rotateRight';                
    default:
        return undefined;
    }
}

function keyboardTickFunc(props) {
    var scene = props.terria.cesium.scene;
    var ellipsoid = scene.globe.ellipsoid;
    var camera = scene.camera;
    var cameraHeight = ellipsoid.cartesianToCartographic(camera.position).height;
    var moveRate = cameraHeight / 100.0;

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
    if(flags.rotateUp) {
        camera.lookUp();
    }
    if(flags.rotateDown) {
        camera.lookDown();
    }
    if(flags.rotateLeft) {
        camera.lookLeft();
    }
    if(flags.rotateRight) {
        camera.lookRight();
    }

    props.terria.currentViewer.notifyRepaintRequired();
}

export default MapColumn;
