import { runInAction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import ChartPanel from "../Custom/Chart/ChartPanel";
import ElevationChartPanel from "../Custom/Chart/ElevationChartPanel";
import measureElement from "../HOCs/measureElement";
import withControlledVisibility from "../HOCs/withControlledVisibility";
import Styles from "./bottom-dock.scss";
import ChartDisclaimer from "./ChartDisclaimer";
import Timeline from "./Timeline/Timeline";

interface PropsType {
  terria: Terria;
  viewState: ViewState;
  heightFromMeasureElementHOC: number;
  domElementRef: (element: HTMLDivElement) => void;
}

@observer
class BottomDock extends React.Component<PropsType> {
  refToMeasure?: HTMLDivElement;

  handleClick() {
    runInAction(() => {
      this.props.viewState.topElement = "BottomDock";
    });
  }

  componentDidUpdate(prevProps: PropsType) {
    if (
      prevProps.heightFromMeasureElementHOC !==
      this.props.heightFromMeasureElementHOC
    ) {
      this.props.viewState.setBottomDockHeight(
        this.props.heightFromMeasureElementHOC
      );
    }
  }

  render() {
    const { terria } = this.props;
    const top = terria.timelineStack.top;

    return (
      <div
        className={`${Styles.bottomDock} ${
          this.props.viewState.topElement === "BottomDock" ? "top-element" : ""
        }`}
        ref={element => {
          if (element !== null) {
            this.props.domElementRef(element);
            this.refToMeasure = element;
          }
        }}
        tabIndex={0}
        onClick={this.handleClick}
        css={`
          background: ${(p: any) => p.theme.dark};
        `}
      >
        <div id="TJS-BottomDockFirstPortal" />
        <ChartDisclaimer terria={terria} viewState={this.props.viewState} />
        <ChartPanel terria={terria} viewState={this.props.viewState} />
        {this.props.viewState.elevationChartIsVisible &&
          !!terria.pathPoints &&
          terria.pathPoints.length > 0 && (
            <ElevationChartPanel
              terria={terria}
              viewState={this.props.viewState}
            />
          )}
        {top && (
          <Timeline
            terria={terria}
            elementConfig={this.props.terria.elements.get("timeline")}
          />
        )}
        {/* Used for react portals - do not remove without updating portals using this */}
        <div id="TJS-BottomDockLastPortal" />
      </div>
    );
  }
}

export default withControlledVisibility(measureElement(BottomDock, false));
