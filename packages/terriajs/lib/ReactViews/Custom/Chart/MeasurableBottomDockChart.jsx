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
import Dropdown from "../../Generic/Dropdown";
import MeasurablePanelManager from "../MeasurablePanelManager";
import { terriaTheme } from "../../StandardUserInterface";
import html2canvas from "html2canvas";
import downloadChartPoints from "./downloadChartPoints";

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
    selectedStopPointIdx: PropTypes.number,
    selectedSampledPointIdx: PropTypes.number
  };

  static defaultProps = {
    margin: { left: 20, right: 30, top: 10, bottom: 50 }
  };

  @observable.ref chartItemsProp;
  @observable.ref xAxisProp;
  @observable.ref marginProp;
  @observable.ref terriaProp;
  @observable.ref chartItemKeyForPointMouseNearProp;
  @observable.ref onPointMouseNearProp;
  @observable widthProp;
  @observable heightProp;
  @observable selectedStopPointIdxProp;
  @observable selectedSampledPointIdxProp;

  @observable.ref zoomedXScale;
  @observable mouseCoords;
  @observable.ref forcedPoint = undefined;
  @observable isDownloading;

  zoomXRef = React.createRef();
  hoverAutorunDisposer = undefined;
  chartRef = React.createRef();

  constructor(props) {
    super(props);
    makeObservable(this);

    this.chartItemsProp = props.chartItems;
    this.xAxisProp = props.xAxis;
    this.marginProp = props.margin;
    this.terriaProp = props.terria;
    this.chartItemKeyForPointMouseNearProp =
      props.chartItemKeyForPointMouseNear;
    this.onPointMouseNearProp = props.onPointMouseNear;
    this.widthProp = props.width;
    this.heightProp = props.height;
    this.selectedStopPointIdxProp = props.selectedStopPointIdx;
    this.selectedSampledPointIdxProp = props.selectedSampledPointIdx;
  }

  @computed
  get chartItems() {
    return sortChartItemsByType(this.chartItemsProp)
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
    const { height, margin } = this;
    return height - margin.top - margin.bottom - Legends.maxHeightPx;
  }

  @computed
  get plotWidth() {
    const { width, margin } = this;
    return width - margin.left - margin.right - this.estimatedYAxesWidth;
  }

  @computed
  get adjustedMargin() {
    const margin = this.margin;
    return {
      ...margin,
      left: margin.left + this.estimatedYAxesWidth
    };
  }

  @computed
  get initialXScale() {
    const xAxis = this.xAxis;
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
    if (this.forcedPoint) {
      return this.xScale(this.forcedPoint.x);
    }

    if (this.pointsNearMouse.length > 0) {
      return this.xScale(this.pointsNearMouse[0].point.x);
    }

    return this.mouseCoords?.x;
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
      tooltip.right = this.width - (this.plotWidth + margin.right);
    } else {
      tooltip.left = margin.left;
    }

    tooltip.bottom = this.height - (margin.top + this.plotHeight);
    return tooltip;
  }

  @computed
  get estimatedYAxesWidth() {
    const numTicks = 4;
    const tickLabelFontSize = 10;
    const leftmostYAxis = this.yAxes[0];
    const maxLabelDigits = Math.max(
      0,
      ...leftmostYAxis.scale.ticks(numTicks).map((n) => n.toString().length)
    );
    return maxLabelDigits * tickLabelFontSize;
  }

  get width() {
    return this.widthProp;
  }

  get height() {
    return this.heightProp;
  }

  get margin() {
    return this.marginProp;
  }

  get xAxis() {
    return this.xAxisProp;
  }

  get terria() {
    return this.terriaProp;
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
  setForcedPoint(point) {
    this.forcedPoint = point;
  }

  @action
  setIsDownloading(isDownloading) {
    this.isDownloading = isDownloading;
  }

  setMouseCoordsFromEvent(event) {
    const coords = localPoint(
      event.target.ownerSVGElement || event.target,
      event
    );
    if (!coords) return;

    this.setForcedPoint(undefined);
    this.setMouseCoords({
      x: coords.x - this.adjustedMargin.left,
      y: coords.y - this.adjustedMargin.top
    });
  }

  @action
  syncPropsToObservables(
    chartItems,
    xAxis,
    margin,
    terria,
    chartItemKeyForPointMouseNear,
    onPointMouseNear,
    width,
    height,
    selectedStopPointIdx,
    selectedSampledPointIdx
  ) {
    this.chartItemsProp = chartItems;
    this.xAxisProp = xAxis;
    this.marginProp = margin;
    this.terriaProp = terria;
    this.chartItemKeyForPointMouseNearProp = chartItemKeyForPointMouseNear;
    this.onPointMouseNearProp = onPointMouseNear;
    this.widthProp = width;
    this.heightProp = height;
    this.selectedStopPointIdxProp = selectedStopPointIdx;
    this.selectedSampledPointIdxProp = selectedSampledPointIdx;
  }

  componentDidMount() {
    // Sync props once on mount (not in a reactive context, so safe to read this.props)
    this.syncPropsToObservables(
      this.props.chartItems,
      this.props.xAxis,
      this.props.margin,
      this.props.terria,
      this.props.chartItemKeyForPointMouseNear,
      this.props.onPointMouseNear,
      this.props.width,
      this.props.height,
      this.props.selectedStopPointIdx,
      this.props.selectedSampledPointIdx
    );

    this.disposeReaction = reaction(
      () =>
        `${this.selectedSampledPointIdxProp}:${this.selectedStopPointIdxProp}`,
      () => {
        if (MeasurablePanelManager.isPointerOverChart()) return;

        const selectedSampledPointIdx = this.selectedSampledPointIdxProp;
        const selectedStopPointIdx = this.selectedStopPointIdxProp;
        const { chartItems, terria } = this;

        const isStopPointSelected =
          (selectedSampledPointIdx === null ||
            selectedSampledPointIdx === undefined) &&
          selectedStopPointIdx !== null &&
          selectedStopPointIdx !== undefined;

        const idx = isStopPointSelected
          ? selectedStopPointIdx
          : selectedSampledPointIdx;

        if (typeof idx !== "number" || !chartItems) {
          this.setForcedPoint(undefined);
          this.setMouseCoords(undefined);
          return;
        }

        const geom = terria.measurableGeomList[terria.measurableGeometryIndex];

        if (isStopPointSelected) {
          const stopPoint = geom?.stopPoints?.[idx];
          if (!stopPoint) {
            this.setForcedPoint(undefined);
            this.setMouseCoords(undefined);
            return;
          }

          const x = geom.stopGroundDistances
            .slice(0, idx + 1)
            .reduce((acc, distance) => acc + (distance ?? 0), 0);

          const selectedPoint = {
            x,
            y: stopPoint.height
          };

          this.setForcedPoint(selectedPoint);
          this.setMouseCoords({
            x: this.xScale(selectedPoint.x),
            y: this.yAxes[0].scale(selectedPoint.y)
          });
          return;
        }

        const sampledPoint = geom?.sampledPoints?.[idx];
        if (!sampledPoint) {
          this.setForcedPoint(undefined);
          this.setMouseCoords(undefined);
          return;
        }

        const sumDistances = (geom.sampledDistances ?? [])
          .slice(0, idx + 1)
          .reduce((acc, distance) => acc + (distance ?? 0), 0);

        const selectedPoint = {
          x: sumDistances,
          y: sampledPoint.height
        };

        this.setForcedPoint(undefined);
        this.setMouseCoords({
          x: this.xScale(selectedPoint.x),
          y: this.yAxes[0].scale(selectedPoint.y)
        });
      }
    );
  }

  componentWillUnmount() {
    MeasurablePanelManager.setPointerOverChart(false);

    if (this.disposeReaction) {
      this.disposeReaction();
    }

    if (this.hoverAutorunDisposer) {
      this.hoverAutorunDisposer();
    }
  }

  componentDidUpdate(prevProps) {
    // Sync props to observables when they change (safe outside reactive context)
    if (
      prevProps.chartItems !== this.props.chartItems ||
      prevProps.xAxis !== this.props.xAxis ||
      prevProps.margin !== this.props.margin ||
      prevProps.terria !== this.props.terria ||
      prevProps.chartItemKeyForPointMouseNear !==
        this.props.chartItemKeyForPointMouseNear ||
      prevProps.onPointMouseNear !== this.props.onPointMouseNear ||
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      prevProps.selectedStopPointIdx !== this.props.selectedStopPointIdx ||
      prevProps.selectedSampledPointIdx !== this.props.selectedSampledPointIdx
    ) {
      this.syncPropsToObservables(
        this.props.chartItems,
        this.props.xAxis,
        this.props.margin,
        this.props.terria,
        this.props.chartItemKeyForPointMouseNear,
        this.props.onPointMouseNear,
        this.props.width,
        this.props.height,
        this.props.selectedStopPointIdx,
        this.props.selectedSampledPointIdx
      );
    }

    if (prevProps.chartItems !== this.props.chartItems) {
      this.setZoomedXScale(undefined);
      this.setMouseCoords(undefined);
      this.setForcedPoint(undefined);
      this.zoomXRef.current?.resetZoom();
      this.chartPoint = { current: undefined };
    }

    if (this.hoverAutorunDisposer) {
      this.hoverAutorunDisposer();
      this.hoverAutorunDisposer = undefined;
    }

    this.hoverAutorunDisposer = autorun(() => {
      if (this.forcedPoint) {
        this.onPointMouseNearProp?.(this.forcedPoint);
        return;
      }

      if (!this.mouseCoords) {
        return;
      }

      const pointNearMouse = this.pointsNearMouse.find(
        (elem) =>
          elem.chartItem.key ===
            this.chartItemKeyForPointMouseNearProp?.AirChart ||
          elem.chartItem.key ===
            this.chartItemKeyForPointMouseNearProp?.GroundChart
      );

      this.onPointMouseNearProp?.(pointNearMouse?.point);
    });
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

  downloadPoints = (format) => {
    downloadChartPoints(format, this.terria, this.chartItems, this.xAxis);
  };

  render() {
    const { height, xAxis, terria } = this;
    if (this.chartItems.length === 0)
      return <div className={Styles.empty}>No data available</div>;
    return (
      <div
        className={Styles.chart}
        onMouseEnter={() => MeasurablePanelManager.setPointerOverChart(true)}
        onMouseLeave={() => MeasurablePanelManager.setPointerOverChart(false)}
        ref={this.chartRef}
        style={{ background: terriaTheme.charcoalGrey }}
      >
        <ZoomX
          ref={this.zoomXRef}
          surface="#zoomSurface"
          initialScale={this.initialXScale}
          scaleExtent={[1, Infinity]}
          translateExtent={[
            [0, 0],
            [Infinity, Infinity]
          ]}
          onZoom={(zoomedScale) => this.setZoomedXScale(zoomedScale)}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8
            }}
          >
            <div
              style={{
                display: this.isDownloading ? "none" : "contents"
              }}
            >
              <button
                type="button"
                className={Styles.downloadButton}
                onClick={this.downloadChart}
                disabled={this.isDownloading}
              >
                Download image
              </button>
              <Dropdown
                theme={{ button: Styles.downloadButton }}
                options={[
                  { name: "GeoJSON" },
                  { name: "KML" },
                  { name: "CSV" },
                  { name: "DXF" }
                ]}
                selectOption={(option) => {
                  this.downloadPoints(option.name.toLowerCase());
                }}
              >
                Download points ▾
              </Dropdown>
            </div>
            <Legends width={this.plotWidth} chartItems={this.chartItems} />
          </div>
          <div style={{ position: "relative" }}>
            <svg
              width="100%"
              height={height}
              onMouseMove={(e) => {
                this.setMouseCoordsFromEvent(e);
              }}
              onMouseLeave={() => {
                this.setMouseCoords(undefined);
                this.setForcedPoint(undefined);
                this.onPointMouseNearProp?.(undefined);
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
                {this.yAxes.map((y, _i) => (
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

  chartRefs = [];

  getChartRef(i) {
    if (!this.chartRefs[i]) {
      this.chartRefs[i] = React.createRef();
    }
    return this.chartRefs[i];
  }

  componentDidUpdate() {
    this.props.chartItems.forEach((_, i) => {
      const ref = this.getChartRef(i).current;
      if (typeof ref?.doZoom === "function") {
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
              ref={this.getChartRef(i)}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
            />
          );
        case "momentPoints": {
          const basisItemIndex = chartItems.findIndex(
            (item) =>
              (item.type === "line" || item.type === "lineAndPoint") &&
              item.xAxis.scale === "time"
          );
          return (
            <MomentPointsChart
              key={chartItem.key}
              ref={this.getChartRef(i)}
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
              ref={this.getChartRef(i)}
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
              ref={this.getChartRef(i)}
              id={sanitizeIdString(chartItem.key)}
              chartItem={chartItem}
              scales={initialScales[i]}
              glyph={chartItem.glyphStyle}
            />
          );
        }
        default:
          return null;
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
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}
