import TableMixin from "../../../lib/ModelMixins/TableMixin";
import CreateModel from "../../../lib/Models/Definition/CreateModel";
import Terria from "../../../lib/Models/Terria";
import TableTraits from "../../../lib/Traits/TraitsClasses/Table/TableTraits";
import {
  canOpenAttributeTable,
  getAttributeTableCapabilities,
  snapshotAttributeTable
} from "../../../lib/ReactViews/AttributeTable/canOpenAttributeTable";
import AttributeTableController from "../../../lib/ReactViews/AttributeTable/AttributeTableController";
import ViewState from "../../../lib/ReactViewModels/ViewState";

class SimpleTableCatalogItem extends TableMixin(CreateModel(TableTraits)) {
  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }
  protected forceLoadTableData(): Promise<string[][] | undefined> {
    return Promise.resolve(undefined);
  }
  get mapItems() {
    return [];
  }
}

describe("AttributeTable eligibility and controller", function () {
  let terria: Terria;
  let item: SimpleTableCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new SimpleTableCatalogItem("attr-table-test", terria);
    item.dataColumnMajor = [
      ["name", "Alpha", "Beta"],
      ["value", "1", "2"]
    ];
  });

  it("canOpenAttributeTable requires loaded table rows", function () {
    expect(canOpenAttributeTable(item)).toBe(true);
    item.dataColumnMajor = [["name"]];
    expect(canOpenAttributeTable(item)).toBe(false);
    item.dataColumnMajor = undefined;
    expect(canOpenAttributeTable(item)).toBe(false);
  });

  it("snapshots rows and columns", function () {
    const snap = snapshotAttributeTable(item);
    expect(snap?.rows.length).toBe(2);
    expect(snap?.columns.map((c) => c.key)).toContain("name");
    expect(snap?.capabilities.canOpen).toBe(true);
    expect(snap?.capabilities.canEdit).toBe(true);
  });

  it("always exposes attribute-table viewing control for TableMixin items", function () {
    const control = item.viewingControls.find(
      (c) => c.id === "attribute-table"
    );
    expect(control).toBeDefined();
    expect(control!.name).toEqual(jasmine.any(String));

    // Still present before rows are loaded.
    item.dataColumnMajor = undefined;
    expect(
      item.viewingControls.find((c) => c.id === "attribute-table")
    ).toBeDefined();
  });

  it("opens and closes via ViewState", function () {
    const viewState = new ViewState({ terria });
    viewState.openAttributeTable(item);
    expect(viewState.attributeTablePanelIsVisible).toBe(true);
    expect(viewState.attributeTableController.isOpen).toBe(true);
    expect(viewState.attributeTableController.workingRows.length).toBe(2);
    viewState.closeAttributeTable();
    expect(viewState.attributeTablePanelIsVisible).toBe(false);
    expect(viewState.attributeTableController.isOpen).toBe(false);
  });

  it("filters and selects rows in the controller", function () {
    const controller = new AttributeTableController(terria);
    controller.open(item);
    controller.setSearch("Beta");
    expect(controller.displayRows.map((r) => r.featureId)).toEqual(["1"]);
    controller.setSearch("");
    controller.handleRowClick("0", { additive: false, range: false });
    expect(controller.selectedIds).toEqual(["0"]);
    controller.handleRowClick("1", { additive: true, range: false });
    expect(controller.selectedIds).toEqual(["0", "1"]);
  });

  it("allows edit for table items with loaded rows", function () {
    const caps = getAttributeTableCapabilities(item);
    expect(caps.canEdit).toBe(true);
    expect(caps.canExport).toBe(true);
    expect(caps.canManageColumns).toBe(true);
  });

  it("enters edit mode and applies cell drafts", function () {
    const controller = new AttributeTableController(terria);
    controller.open(item);
    controller.startEditing();
    expect(controller.isEditing).toBe(true);
    controller.setCellDraft("0", "name", "Edited");
    expect(controller.baseRows[0].properties.name).toBe("Edited");
    controller.cancelEditing();
    expect(controller.isEditing).toBe(false);
    expect(controller.baseRows[0].properties.name).toBe("Alpha");
  });
});
