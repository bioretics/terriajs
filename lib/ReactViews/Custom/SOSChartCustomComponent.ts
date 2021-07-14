import CommonStrata from "../../Models/Definition/CommonStrata";
import SensorObservationServiceCatalogItem from "../../Models/Catalog/CatalogItems/SensorObservationServiceCatalogItem";
import { ProcessNodeContext } from "./CustomComponent";
import ChartCustomComponent, {
  ChartCustomComponentAttributes
} from "./ChartCustomComponent";
import { BaseModel } from "../../Models/Definition/Model";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import SplitItemReference from "../../Models/Catalog/SplitItemReference";
interface SOSChartCustomComponentAttributes
  extends ChartCustomComponentAttributes {
  name?: string;
}
export default class SOSChartCustomComponent extends ChartCustomComponent<
  SensorObservationServiceCatalogItem
> {
  get name(): string {
    return "sos-chart";
  }

  get attributes() {
    let attributes = super.attributes;
    attributes.push("name");
    return attributes;
  }

  protected constructCatalogItem(
    id: string | undefined,
    context: ProcessNodeContext,
    sourceReference: BaseModel | undefined
  ): SensorObservationServiceCatalogItem {
    return context.catalogItem.duplicateModel(
      createGuid()
    ) as SensorObservationServiceCatalogItem;
  }

  constructShareableCatalogItem = async (
    id: string | undefined,
    context: ProcessNodeContext,
    sourceReference: BaseModel | undefined
  ) =>
    this.createItemReference(
      context.catalogItem as SensorObservationServiceCatalogItem
    );

  protected setTraitsFromAttrs(
    item: SensorObservationServiceCatalogItem,
    attrs: SOSChartCustomComponentAttributes,
    sourceIndex: number
  ): void {
    const featureOfInterestId = attrs.identifier;
    const featureName = attrs.name;
    const units = item.selectedObservable?.units;

    item.setTrait(CommonStrata.user, "showAsChart", true);
    item.setTrait(CommonStrata.user, "name", featureName || item.name);
    item.setTrait(
      CommonStrata.user,
      "chartFeatureOfInterestIdentifier",
      featureOfInterestId
    );
    item
      .addObject(CommonStrata.user, "columns", "values")
      ?.setTrait(CommonStrata.user, "units", units);
  }

  protected parseNodeAttrs(nodeAttrs: {
    [name: string]: string | undefined;
  }): SOSChartCustomComponentAttributes {
    const parsed: SOSChartCustomComponentAttributes = super.parseNodeAttrs(
      nodeAttrs
    );
    parsed.name = nodeAttrs["name"];
    return parsed;
  }
}
