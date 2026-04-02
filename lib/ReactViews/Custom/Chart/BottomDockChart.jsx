import { observer } from "mobx-react";
import {
  action,
  autorun,
  computed,
  makeObservable,
  observable,
  reaction
} from "mobx";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { RectClipPath } from "@visx/clip-path";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { withParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { Line } from "@visx/shape";
import PropTypes from "prop-types";
import React from "react";
import groupBy from "lodash-es/groupBy";
import minBy from "lodash-es/minBy";
import Legends from "./Legends";
import LineChart from "./LineChart";
import MomentLinesChart from "./MomentLinesChart";
import MomentPointsChart from "./MomentPointsChart";
import Tooltip from "./Tooltip";
import ZoomX from "./ZoomX";
import Styles from "./bottom-dock-chart.scss";
import LineAndPointChart from "./LineAndPointChart";
import PointOnMap from "./PointOnMap";
import { terriaTheme } from "../../StandardUserInterface";
import html2canvas from "html2canvas";

const chartMinWidth = 110;
const defaultGridColor = "#efefef";
const labelColor = "#efefef";

@observer
class BottomDockChart extends React.Component {
  static propTypes = {
    terria: PropTypes.object.isRequired,
    parentWidth: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    chartItems: PropTypes.array.isRequired,
    xAxis: PropTypes.object.isRequired,
    margin: PropTypes.object,
    chartItemKeyForPointMouseNear: PropTypes.object,
    onPointMouseNear: PropTypes.func,
    onPointerOverChartChange: PropTypes.func,
    selectedStopPointIdx: PropTypes.number,
    selectedSampledPointIdx: PropTypes.number
  };

  static defaultProps = {
    parentWidth: 0
  };

  render() {
    return (
      <Chart
        {...this.props}
        width={Math.max(
          chartMinWidth,
          this.props.width || this.props.parentWidth
        )}
        chartItemKeyForPointMouseNear={this.props.chartItemKeyForPointMouseNear}
        onPointMouseNear={this.props.onPointMouseNear}
        onPointerOverChartChange={this.props.onPointerOverChartChange}
        selectedStopPointIdx={this.props.selectedStopPointIdx}
        selectedSampledPointIdx={this.props.selectedSampledPointIdx}
      />
    );
  }
}

export default withParentSize(BottomDockChart);

@observer
class Chart extends React.Component {
  static propTypes = {
    terria: PropTypes.object.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    chartItems: PropTypes.array.isRequired,
    xAxis: PropTypes.object.isRequired,
    margin: PropTypes.object,
    chartItemKeyForPointMouseNear: PropTypes.object,
    onPointMouseNear: PropTypes.func,
    onPointerOverChartChange: PropTypes.func,
    selectedStopPointIdx: PropTypes.number,
    selectedSampledPointIdx: PropTypes.number
  };

  static defaultProps = {
    margin: { left: 20, right: 30, top: 10, bottom: 50 }
  };

  @observable.ref zoomedXScale;
  @observable mouseCoords;
  @observable isMouseOverChart = false;

  constructor(props) {
    super(props);
    makeObservable(this);
  }

  @computed
  get chartItems() {
    return sortChartItemsByType(this.props.chartItems)
      .map((chartItem) => {
        return {
          ...chartItem,
          points: [...chartItem.points].sort((p1, p2) => p1.x - p2.x)
        };
      })
      .filter((chartItem) => chartItem.points.length > 0);
  }

  @computed
  get plotHeight() {
    const { height, margin } = this.props;
    return height - margin.top - margin.bottom - Legends.maxHeightPx;
  }

  @computed
  get plotWidth() {
    const { width, margin } = this.props;
    return width - margin.left - margin.right - this.estimatedYAxesWidth;
  }

  @computed
  get adjustedMargin() {
    const margin = this.props.margin;
    return {
      ...margin,
      left: margin.left + this.estimatedYAxesWidth
    };
  }

  @computed
  get initialXScale() {
    const xAxis = this.props.xAxis;
    const domain = calculateDomain(this.chartItems);
    const params = {
      domain: domain.x,
      range: [0, this.plotWidth]
    };
    if (xAxis.scale === "linear") return scaleLinear(params);
    else return scaleTime(params);
  }

  @computed
  get xScale() {
    return this.zoomedXScale || this.initialXScale;
  }

  @computed
  get yAxes() {
    const range = [this.plotHeight, 0];
    const chartItemsByUnit = groupBy(this.chartItems, "units");
    return Object.entries(chartItemsByUnit).map(([units, chartItems]) => {
      return {
        units: units === "undefined" ? undefined : units,
        scale: scaleLinear({ domain: calculateDomain(chartItems).y, range }),
        color: chartItems[0].getColor()
      };
    });
  }

  @computed
  get initialScales() {
    return this.chartItems.map((c) => ({
      x: this.initialXScale,
      y: this.yAxes.find((y) => y.units === c.units).scale
    }));
  }

  @computed
  get zoomedScales() {
    return this.chartItems.map((c) => ({
      x: this.xScale,
      y: this.yAxes.find((y) => y.units === c.units).scale
    }));
  }

  @computed
  get cursorX() {
    if (this.pointsNearMouse.length > 0)
      return this.xScale(this.pointsNearMouse[0].point.x);
    return this.mouseCoords && this.mouseCoords.x;
  }

  @computed
  get pointsNearMouse() {
    if (!this.mouseCoords) return [];
    return this.chartItems
      .map((chartItem) => ({
        chartItem,
        point: findNearestPoint(
          chartItem.points,
          this.mouseCoords,
          this.xScale,
          7
        )
      }))
      .filter(({ point }) => point !== undefined);
  }

  @computed
  get tooltip() {
    const margin = this.adjustedMargin;
    const tooltip = {
      items: this.pointsNearMouse
    };

    if (!this.mouseCoords || this.mouseCoords.x < this.plotWidth * 0.5) {
      tooltip.right = this.props.width - (this.plotWidth + margin.right);
    } else {
      tooltip.left = margin.left;
    }

    tooltip.bottom = this.props.height - (margin.top + this.plotHeight);
    return tooltip;
  }

  @computed
  get estimatedYAxesWidth() {
    const numTicks = 4;
    const tickLabelFontSize = 10;
    // We need to consider only the left most Y-axis as its label values appear
    // outside the chart plot area. The labels of inner y-axes appear inside
    // the plot area.
    const leftmostYAxis = this.yAxes[0];
    const maxLabelDigits = Math.max(
      0,
      ...leftmostYAxis.scale.ticks(numTicks).map((n) => n.toString().length)
    );
    return maxLabelDigits * tickLabelFontSize;
  }

  @action
  setZoomedXScale(scale) {
    this.zoomedXScale = scale;
  }

  @action
  setMouseCoords(coords) {
    this.mouseCoords = coords;
  }

  @action
  setIsMouseOverChart(value) {
    this.isMouseOverChart = value;
  }

  setMouseCoordsFromEvent(event) {
    const coords = localPoint(event.currentTarget, event);
    if (!coords) return;
    this.setIsMouseOverChart(true);
    this.props.onPointerOverChartChange?.(true);
    this.setMouseCoords({
      x: coords.x - this.adjustedMargin.left,
      y: coords.y - this.adjustedMargin.top
    });
  }

  componentDidMount() {
    this.disposeReaction = reaction(
      () =>
        `${this.props.selectedSampledPointIdx}:${this.props.selectedStopPointIdx}`,
      () => {
        if (this.isMouseOverChart) return;
        const { selectedSampledPointIdx, selectedStopPointIdx } = this.props;
        // Prefer sampled index when both are set (e.g. chart hover / table row with ground match) so cursor x uses ground path.
        const isStopPointSelected =
          (selectedSampledPointIdx === null ||
            selectedSampledPointIdx === undefined) &&
          selectedStopPointIdx !== null &&
          selectedStopPointIdx !== undefined;

        const idx = isStopPointSelected
          ? selectedStopPointIdx
          : selectedSampledPointIdx;

        if (typeof idx === "number" && this.props.chartItems) {
          const points = isStopPointSelected
            ? this.props.terria.measurableGeomList[
                this.props.terria.measurableGeometryIndex
              ].stopPoints
            : this.props.terria.measurableGeomList[
                this.props.terria.measurableGeometryIndex
              ].sampledPoints;

          const geom =
            this.props.terria.measurableGeomList[
              this.props.terria.measurableGeometryIndex
            ];
          const sumDistances = isStopPointSelected
            ? geom.stopAirDistances
                .slice(0, idx + 1)
                .reverse()
                .reduce((acc, distance) => acc + distance, 0)
            : (() => {
                const sdist = geom.sampledDistances ?? [];
                let s = 0;
                for (let j = 0; j <= idx; j++) {
                  s += sdist[j] ?? 0;
                }
                return s;
              })();

          const selectedPoint = {
            x: sumDistances,
            y: points[idx].height
          };

          // Simulate the mouse coords from the selected point coords in the chart.
          const xCoord = this.xScale(selectedPoint.x);
          const yCoord = this.yAxes[0].scale(selectedPoint.y);

          this.setMouseCoords({
            x: xCoord,
            y: yCoord
          });
        } else if (!this.isMouseOverChart) {
          this.setMouseCoords(undefined);
        }
      }
    );
  }

  componentWillUnmount() {
    if (this.disposeReaction) {
      this.disposeReaction();
    }
  }

  // Clear zoom before the next paint when data changes so Plot.doZoom does not use a stale x-scale.
  UNSAFE_componentWillReceiveProps(nextProps) {
    const prevSignature = getChartDataSignature(this.props.chartItems);
    const nextSignature = getChartDataSignature(nextProps.chartItems);
    if (prevSignature !== nextSignature) {
      this.setZoomedXScale(undefined);
      this.setMouseCoords(undefined);
    }
  }

  componentDidUpdate() {
    // When pointsNearMouse changes, call onPointMouseNear callback to create the placeholder
    autorun(() => {
      if (
        this.pointsNearMouse &&
        this.pointsNearMouse.length > 0 &&
        this.props.onPointMouseNear
      ) {
        const pointNearMouse = this.pointsNearMouse.find(
          (elem) =>
            elem.chartItem.key ===
              this.props.chartItemKeyForPointMouseNear.AirChart ||
            elem.chartItem.key ===
              this.props.chartItemKeyForPointMouseNear.GroundChart
        );
        if (pointNearMouse) {
          this.props.onPointMouseNear(pointNearMouse.point);
        }
      }
    });
  }

  @observable isDownloading;
  chartRef = React.createRef();

  @action
  setIsDownloading(isDownloading) {
    this.isDownloading = isDownloading;
  }

  downloadChart = () => {
    this.setIsDownloading(true);
    setTimeout(() => {
      if (this.chartRef.current) {
        html2canvas(this.chartRef.current)
          .then((canvas) => {
            const dataURL = canvas.toDataURL("image/jpeg");
            const link = document.createElement("a");
            link.href = dataURL;
            link.download = "chart-screenshot.jpeg";
            link.click();
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => {
            this.setIsDownloading(false);
          });
      } else {
        this.setIsDownloading(false);
      }
    }, 0);
  };

  render() {
    const { height, xAxis, terria } = this.props;
    if (this.chartItems.length === 0)
      return <div className={Styles.empty}>No data available</div>;
    return (
      <div
        className={Styles.chart}
        ref={this.chartRef}
        style={{ background: terriaTheme.charcoalGrey }}
      >
        <ZoomX
          key={getChartDataSignature(this.props.chartItems)}
          surface="#zoomSurface"
          initialScale={this.initialXScale}
          scaleExtent={[1, Infinity]}
          translateExtent={[
            [0, 0],
            [Infinity, Infinity]
          ]}
          onZoom={(zoomedScale) => this.setZoomedXScale(zoomedScale)}
        >
          <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
            <button
              type="button"
              className={Styles.btn}
              style={{
                marginTop: "auto",
                marginBottom: "auto",
                color: "#ffffff",
                background: "#519ac2",
                border: "1px solid #ffffff",
                borderRadius: 4,
                display: this.isDownloading ? "none" : "inline-block"
              }}
              onClick={this.downloadChart}
              disabled={this.isDownloading}
            >
              Download
            </button>
            <Legends width={this.plotWidth} chartItems={this.chartItems} />
          </div>
          <div style={{ position: "relative" }}>
            <svg
              width="100%"
              height={height}
              onMouseEnter={() => {
                this.setIsMouseOverChart(true);
                this.props.onPointerOverChartChange?.(true);
              }}
              onMouseMove={this.setMouseCoordsFromEvent.bind(this)}
              onMouseLeave={() => {
                this.setIsMouseOverChart(false);
                this.props.onPointerOverChartChange?.(false);
                this.setMouseCoords(undefined);
                // On mouseLeave event remove position placeholder
                this.props.onPointMouseNear(undefined);
              }}
            >
              <Group
                left={this.adjustedMargin.left}
                top={this.adjustedMargin.top}
              >
                <RectClipPath
                  id="plotClip"
                  width={this.plotWidth}
                  height={this.plotHeight}
                />
                <XAxis
                  top={this.plotHeight + 1}
                  scale={this.xScale}
                  label={xAxis.units || (xAxis.scale === "time" && "Date")}
                />
                {this.yAxes.map((y, i) => (
                  <YAxis
                    {...y}
                    key={`y-axis-${y.units}`}
                    color={this.yAxes.length > 1 ? y.color : defaultGridColor}
                    offset={i * 50}
                  />
                ))}
                {this.yAxes.map((y, i) => (
                  <GridRows
                    key={`grid-${y.units}`}
                    width={this.plotWidth}
                    height={this.plotHeight}
                    scale={y.scale}
                    numTicks={4}
                    stroke={this.yAxes.length > 1 ? y.color : defaultGridColor}
                    lineStyle={{ opacity: 0.3 }}
                  />
                ))}
                <svg
                  id="zoomSurface"
                  clipPath="url(#plotClip)"
                  pointerEvents="all"
                >
                  <rect
                    width={this.plotWidth}
                    height={this.plotHeight}
                    fill="transparent"
                  />
                  {this.cursorX !== null && this.cursorX !== undefined && (
                    <Cursor x={this.cursorX} stroke={defaultGridColor} />
                  )}
                  <Plot
                    chartItems={this.chartItems}
                    initialScales={this.initialScales}
                    zoomedScales={this.zoomedScales}
                  />
                </svg>
              </Group>
            </svg>
            <Tooltip {...this.tooltip} />
            <PointsOnMap terria={terria} chartItems={this.chartItems} />
          </div>
        </ZoomX>
      </div>
    );
  }
}

@observer
class Plot extends React.Component {
  static propTypes = {
    chartItems: PropTypes.array.isRequired,
    initialScales: PropTypes.array.isRequired,
    zoomedScales: PropTypes.array.isRequired
  };

  constructor(props) {
    super(props);
    makeObservable(this);
  }

  @computed
  get chartRefs() {
    return this.props.chartItems.map((_) => React.createRef());
  }

  componentDidUpdate() {
    Object.values(this.chartRefs).forEach(({ current: ref }, i) => {
      if (typeof ref.doZoom === "function") {
        ref.doZoom(this.props.zoomedScales[i]);
      }
    });
  }

  render() {
    const { chartItems, initialScales } = this.props;
    return chartItems.map((chartItem, i) => {
      switch (chartItem.type) {
        case "line":
          return (
            <LineChart
              key={chartItem.key}
              ref={this.chartRefs[i]}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
            />
          );
        case "momentPoints": {
          // Find a basis item to stick the points on, if we can't find one, we
          // vertically center the points
          const basisItemIndex = chartItems.findIndex(
            (item) =>
              (item.type === "line" || item.type === "lineAndPoint") &&
              item.xAxis.scale === "time"
          );
          return (
            <MomentPointsChart
              key={chartItem.key}
              ref={this.chartRefs[i]}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
              basisItem={chartItems[basisItemIndex]}
              basisItemScales={initialScales[basisItemIndex]}
              glyph={chartItem.glyphStyle}
            />
          );
        }
        case "momentLines": {
          return (
            <MomentLinesChart
              key={chartItem.key}
              ref={this.chartRefs[i]}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
            />
          );
        }
        case "lineAndPoint": {
          return (
            <LineAndPointChart
              key={chartItem.key}
              ref={this.chartRefs[i]}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
              glyph={chartItem.glyphStyle}
            />
          );
        }
      }
    });
  }
}

class XAxis extends React.PureComponent {
  static propTypes = {
    top: PropTypes.number.isRequired,
    scale: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired
  };

  render() {
    const { scale, ...restProps } = this.props;
    return (
      <AxisBottom
        stroke="#efefef"
        tickStroke="#efefef"
        tickLabelProps={() => ({
          fill: "#efefef",
          textAnchor: "middle",
          fontSize: 12,
          fontFamily: "Arial"
        })}
        labelProps={{
          fill: labelColor,
          fontSize: 12,
          textAnchor: "middle",
          fontFamily: "Arial"
        }}
        // .nice() rounds the scale so that the aprox beginning and
        // aprox end labels are shown
        // See: https://stackoverflow.com/questions/21753126/d3-js-starting-and-ending-tick
        scale={scale.nice()}
        {...restProps}
      />
    );
  }
}

class YAxis extends React.PureComponent {
  static propTypes = {
    scale: PropTypes.func.isRequired,
    color: PropTypes.string.isRequired,
    units: PropTypes.string,
    offset: PropTypes.number.isRequired
  };

  render() {
    const { scale, color, units, offset } = this.props;
    return (
      <AxisLeft
        key={`y-axis-${units}`}
        left={offset}
        scale={scale}
        numTicks={4}
        stroke={color}
        tickStroke={color}
        label={units || ""}
        labelOffset={10}
        labelProps={{
          fill: color,
          textAnchor: "middle",
          fontSize: 12,
          fontFamily: "Arial"
        }}
        tickLabelProps={() => ({
          fill: color,
          textAnchor: "end",
          fontSize: 10,
          fontFamily: "Arial"
        })}
      />
    );
  }
}

class Cursor extends React.PureComponent {
  static propTypes = {
    x: PropTypes.number.isRequired
  };

  render() {
    const { x, ...rest } = this.props;
    return <Line from={{ x, y: 0 }} to={{ x, y: 1000 }} {...rest} />;
  }
}

function PointsOnMap({ chartItems, terria }) {
  return chartItems.map(
    (chartItem) =>
      chartItem.pointOnMap && (
        <PointOnMap
          key={`point-on-map-${chartItem.key}`}
          terria={terria}
          color={chartItem.getColor()}
          point={chartItem.pointOnMap}
        />
      )
  );
}

/**
 * Calculates a combined domain of all chartItems.
 */
function calculateDomain(chartItems) {
  const xmin = Math.min(...chartItems.map((c) => c.domain.x[0]));
  const xmax = Math.max(...chartItems.map((c) => c.domain.x[1]));
  const ymin = Math.min(...chartItems.map((c) => c.domain.y[0]));
  const ymax = Math.max(...chartItems.map((c) => c.domain.y[1]));
  return {
    x: [xmin, xmax],
    y: [ymin, ymax]
  };
}

function getChartDataSignature(chartItems) {
  //return sortChartItemsByType(chartItems)
  return chartItems
    .map((item) => {
      const points = [...item.points].sort((a, b) => a.x - b.x);
      const first = points[0];
      const last = points[points.length - 1];

      return [
        //item.key,
        //points.length,
        item.domain.x[0],
        item.domain.x[1],
        item.domain.y[0],
        item.domain.y[1],
        first ? `${first.x}:${first.y}` : "",
        last ? `${last.x}:${last.y}` : ""
      ].join("|");
    })
    .join(";");
}
/**
 * Sorts chartItems so that `momentPoints` are rendered on top then
 * `momentLines` and then any other types.
 * @param {ChartItem[]} chartItems array of chartItems to sort
 */
function sortChartItemsByType(chartItems) {
  return chartItems.slice().sort((a, b) => {
    if (a.type === "momentPoints") return 1;
    else if (b.type === "momentPoints") return -1;
    else if (a.type === "momentLines") return 1;
    else if (b.type === "momentLines") return -1;
    return 0;
  });
}

function findNearestPoint(points, coords, xScale, maxDistancePx) {
  function distance(coords, point) {
    return point ? coords.x - xScale(point.x) : Infinity;
  }

  let left = 0;
  let right = points.length;
  let mid = 0;
  for (;;) {
    if (left === right) break;
    mid = left + Math.floor((right - left) / 2);
    if (distance(coords, points[mid]) === 0) break;
    else if (distance(coords, points[mid]) < 0) right = mid;
    else left = mid + 1;
  }

  const leftPoint = points[mid - 1];
  const midPoint = points[mid];
  const rightPoint = points[mid + 1];

  const nearestPoint = minBy([leftPoint, midPoint, rightPoint], (p) =>
    p ? Math.abs(distance(coords, p)) : Infinity
  );

  return Math.abs(distance(coords, nearestPoint)) <= maxDistancePx
    ? nearestPoint
    : undefined;
}

function sanitizeIdString(id) {
  // delete all non-alphanum chars
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}
