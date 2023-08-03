import { observer } from "mobx-react";
import React from "react";
import { Complete } from "../../../Core/TypeModifiers";
import DiscretelyTimeVaryingMixin from "../../../ModelMixins/DiscretelyTimeVaryingMixin";
import hasTraits from "../../../Models/Definition/hasTraits";
import { BaseModel } from "../../../Models/Definition/Model";
import { DEFAULT_PLACEMENT } from "../../../Models/SelectableDimensions/SelectableDimensions";
import ViewState from "../../../ReactViewModels/ViewState";
import WebMapServiceCatalogItemTraits from "../../../Traits/TraitsClasses/WebMapServiceCatalogItemTraits";
import ChartItemSelector from "./ChartItemSelector";
import ColorScaleRangeSection from "./ColorScaleRangeSection";
import DateTimeSelectorSection from "./DateTimeSelectorSection";
import FilterSection from "./FilterSection";
import LeftRightSection from "./LeftRightSection";
import Legend from "./Legend";
import OpacitySection from "./OpacitySection";
import SatelliteImageryTimeFilterSection from "./SatelliteImageryTimeFilterSection";
import { ScaleWorkbenchInfo } from "./ScaleWorkbenchInfo";
import DimensionSelectorSection from "./SelectableDimensionSection";
import ShortReport from "./ShortReport";
import TimerSection from "./TimerSection";
import FilterFeaturesSection from "./FilterFeaturesSection";
import ViewingControls from "./ViewingControls";

type WorkbenchControls = {
  viewingControls?: boolean;
  opacity?: boolean;
  scaleWorkbench?: boolean;
  splitter?: boolean;
  timer?: boolean;
  chartItems?: boolean;
  filter?: boolean;
  dateTime?: boolean;
  timeFilter?: boolean;
  selectableDimensions?: boolean;
  colorScaleRange?: boolean;
  shortReport?: boolean;
  legend?: boolean;
  filterFeatures?: boolean;
};

type WorkbenchItemControlsProps = {
  item: BaseModel;
  viewState: ViewState;
  /** Flag to show each control - defaults to all true */
  controls?: WorkbenchControls;
};

export const defaultControls: Complete<WorkbenchControls> = {
  viewingControls: true,
  opacity: true,
  scaleWorkbench: true,
  splitter: true,
  timer: true,
  chartItems: true,
  filter: true,
  dateTime: true,
  timeFilter: true,
  selectableDimensions: true,
  colorScaleRange: true,
  shortReport: true,
  legend: true,
  filterFeatures: true
};

export const hideAllControls: Complete<WorkbenchControls> = {
  viewingControls: false,
  opacity: false,
  scaleWorkbench: false,
  splitter: false,
  timer: false,
  chartItems: false,
  filter: false,
  dateTime: false,
  timeFilter: false,
  selectableDimensions: false,
  colorScaleRange: false,
  shortReport: false,
  legend: false,
  filterFeatures: false
};

const WorkbenchItemControls: React.FC<WorkbenchItemControlsProps> = observer(
  ({ item, viewState, controls: controlsWithoutDefaults }) => {
    // Apply controls from props on top of defaultControls
    const controls = { ...defaultControls, ...controlsWithoutDefaults };

    return (
      <>
        {controls?.viewingControls ? (
          <ViewingControls item={item} viewState={viewState} />
        ) : null}
        {controls?.opacity ? <OpacitySection item={item} /> : null}
        {controls?.scaleWorkbench ? <ScaleWorkbenchInfo item={item} /> : null}
        {controls?.timer ? <TimerSection item={item} /> : null}
        {controls?.splitter ? <LeftRightSection item={item as any} /> : null}
        {controls?.chartItems ? <ChartItemSelector item={item} /> : null}
        {controls?.filter ? <FilterSection item={item} /> : null}
        {controls?.filterFeatures ? (
          <FilterFeaturesSection item={item} viewState={viewState} />
        ) : null}
        {controls?.dateTime && DiscretelyTimeVaryingMixin.isMixedInto(item) ? (
          <DateTimeSelectorSection item={item} />
        ) : null}
        {controls?.timeFilter ? (
          <SatelliteImageryTimeFilterSection item={item} />
        ) : null}
        {controls?.selectableDimensions ? (
          <DimensionSelectorSection item={item} placement={DEFAULT_PLACEMENT} />
        ) : null}
        {/* TODO: remove min max props and move the checks to
      ColorScaleRangeSection to keep this component simple. */}
        {controls?.colorScaleRange &&
          hasTraits(
            item,
            WebMapServiceCatalogItemTraits,
            "colorScaleMinimum"
          ) &&
          hasTraits(
            item,
            WebMapServiceCatalogItemTraits,
            "colorScaleMaximum"
          ) && (
            <ColorScaleRangeSection
              item={item}
              minValue={item.colorScaleMinimum}
              maxValue={item.colorScaleMaximum}
            />
          )}
        {controls?.shortReport ? <ShortReport item={item} /> : null}
        {controls?.legend ? <Legend item={item} /> : null}
        {controls?.selectableDimensions ? (
          <DimensionSelectorSection item={item} placement={"belowLegend"} />
        ) : null}
      </>
    );
  }
);

export default WorkbenchItemControls;
