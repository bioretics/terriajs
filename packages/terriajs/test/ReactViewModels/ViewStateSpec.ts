import { runInAction } from "mobx";
import Terria from "../../lib/Models/Terria";
import ViewState, {
  DATA_CATALOG_NAME
} from "../../lib/ReactViewModels/ViewState";
import SimpleCatalogItem from "../Helpers/SimpleCatalogItem";
import TerriaReference from "../../lib/Models/Catalog/CatalogReferences/TerriaReference";
import CommonStrata from "../../lib/Models/Definition/CommonStrata";
import CatalogIndexReference from "../../lib/Models/Catalog/CatalogReferences/CatalogIndexReference";
import CatalogGroup from "../../lib/Models/Catalog/CatalogGroup";
import GroupMixin from "../../lib/ModelMixins/GroupMixin";
import getAncestors from "../../lib/Models/getAncestors";
import { animationDuration } from "../../lib/ReactViews/StandardUserInterface/StandardUserInterface";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import MeasurableGeometryManager, {
  MeasurableGeometry
} from "../../lib/ViewModels/MeasurableGeometry/MeasurableGeometryManager";

describe("ViewState", function () {
  let terria: Terria;
  let viewState: ViewState;

  beforeEach(function () {
    terria = new Terria();
    viewState = new ViewState({
      terria
    });
  });

  describe("viewCatalogMember", function () {
    it("handle nested references", async function () {
      // Test nested reference
      // CatalogIndexReference -> TerriaReference -> CatalogGroup
      terria = new Terria();

      const terriaReference = new TerriaReference("test", terria);
      terriaReference.setTrait(
        CommonStrata.user,
        "url",
        "test/init/wms-v8.json"
      );
      terriaReference.setTrait(CommonStrata.user, "isGroup", true);
      terria.addModel(terriaReference);

      const catalogIndexReference = new CatalogIndexReference("test", terria);

      await viewState.viewCatalogMember(catalogIndexReference);

      expect(viewState.previewedItem).toBeDefined();
      expect(viewState.previewedItem?.type).toBe("group");
    });

    describe("in tabbed mode", function () {
      beforeEach(async function () {
        runInAction(() => {
          terria.configParameters.tabbedCatalog = true;
        });
        await terria.applyInitData({
          initData: {
            catalog: [
              {
                id: "first-tab",
                type: "group",
                name: "First tab",
                members: [
                  {
                    id: "first-tab-group",
                    type: "group",
                    name: "Group in first tab"
                  }
                ]
              },
              {
                id: "second-tab",
                type: "group",
                name: "Second tab",
                members: [
                  {
                    id: "sub-group",
                    type: "group",
                    name: "Sub group",
                    members: [
                      {
                        id: "nested-item",
                        type: "group",
                        name: "Nested item"
                      }
                    ]
                  }
                ]
              },
              {
                // a reference group, so we can test the behaviour for
                // dynamic group tabs that are not loaded statically on app
                // start
                id: "reference-tab",
                type: "terria-reference",
                name: "Reference tab",
                url: "test/init/wms-v8.json",
                isGroup: true
              }
            ]
          }
        });
      });

      it("switches to the top level tab containing the item", async function () {
        const secondTab = terria.getModelById(CatalogGroup, "second-tab")!;
        const subGroup = terria.getModelById(CatalogGroup, "sub-group")!;
        (await secondTab.loadMembers()).throwIfError();
        (await subGroup.loadMembers()).throwIfError();

        const item = terria.getModelById(CatalogGroup, "nested-item")!;
        (await viewState.viewCatalogMember(item)).throwIfError();

        // the tab is the top level group, not the immediate parent group
        expect(viewState.activeTabIdInCategory).toBe("second-tab");
      });

      it("switches to the parent tab of an item in a tab that has not been loaded", async function () {
        const subGroup = terria.getModelById(CatalogGroup, "sub-group")!;

        // Because `second-tab` has not been loaded, the parent -> member links
        // are not established yet, so the item has no known ancestors.
        expect(getAncestors(subGroup).length).toBe(0);

        (await viewState.viewCatalogMember(subGroup)).throwIfError();

        expect(viewState.activeTabIdInCategory).toBe("second-tab");
      });

      it("loads the members of the parent tab", async function () {
        const secondTab = terria.getModelById(CatalogGroup, "second-tab")!;
        const loadMembers = spyOn(secondTab, "loadMembers").and.callThrough();

        const subGroup = terria.getModelById(CatalogGroup, "sub-group")!;
        (await viewState.viewCatalogMember(subGroup)).throwIfError();

        expect(loadMembers).toHaveBeenCalled();
      });

      it("switches to the parent tab of an item in a reference group tab", async function () {
        const referenceTab = terria.getModelById(
          TerriaReference,
          "reference-tab"
        )!;
        (await referenceTab.loadReference()).throwIfError();
        const dereferenced = referenceTab.target;
        expect(GroupMixin.isMixedInto(dereferenced)).toBeTruthy();
        if (!GroupMixin.isMixedInto(dereferenced)) return;
        (await dereferenced.loadMembers()).throwIfError();

        // a group inside the referenced catalog (test/init/wms-v8.json)
        const wmsGroup = terria.getModelById(CatalogGroup, "MLzS8W")!;
        (await viewState.viewCatalogMember(wmsGroup)).throwIfError();

        expect(viewState.activeTabIdInCategory).toBe("reference-tab");
      });

      it("opens the ancestor groups of the item", async function () {
        const secondTab = terria.getModelById(CatalogGroup, "second-tab")!;
        const subGroup = terria.getModelById(CatalogGroup, "sub-group")!;
        (await secondTab.loadMembers()).throwIfError();
        (await subGroup.loadMembers()).throwIfError();

        const item = terria.getModelById(CatalogGroup, "nested-item")!;
        (await viewState.viewCatalogMember(item)).throwIfError();

        expect(secondTab.isOpen).toBe(true);
        expect(subGroup.isOpen).toBe(true);

        // and closes them again when `isOpen` is false
        (await viewState.viewCatalogMember(item, false)).throwIfError();

        expect(secondTab.isOpen).toBe(false);
        expect(subGroup.isOpen).toBe(false);
      });
    });
  });

  describe("measurable geometry panels", function () {
    function carto(longitude: number, latitude: number, height = 0) {
      return new Cartographic(
        CesiumMath.toRadians(longitude),
        CesiumMath.toRadians(latitude),
        height
      );
    }

    function geometryOf(sourceItemId: string): MeasurableGeometry {
      return {
        isClosed: false,
        hasArea: false,
        stopPoints: [carto(11.34, 44.49, 30), carto(11.35, 44.5, 80)],
        stopGeodeticDistances: [0, 1300],
        sourceItemId
      };
    }

    /** Measuring on a workbench item is what opens the measurable panel. */
    function measureOn(sourceItemId: string, index = 0) {
      runInAction(() => {
        terria.measurableGeomList[index] = geometryOf(sourceItemId);
      });
    }

    function putOnWorkbench(...ids: string[]) {
      const items = ids.map((id) => {
        const item = new SimpleCatalogItem(id, terria);
        terria.addModel(item);
        return item;
      });
      runInAction(() => {
        terria.workbench.items = items;
      });
      return items;
    }

    it("opens the measurable panel pinned to the item that was measured", function () {
      measureOn("layer-a");

      expect(viewState.measurablePanelIsVisible).toBe(true);
      expect(viewState.measurablePanelSourceItemId).toEqual("layer-a");
      expect(viewState.mobileMeasureToolsButtonVisible).toBe(true);
    });

    it("snapshots the measured geometry against that item", function () {
      measureOn("layer-a");

      const snapshot = viewState.getMeasurableGeomSnapshot("layer-a");
      expect(snapshot).toBeDefined();
      expect(snapshot?.geometryIndex).toEqual(0);
      expect(snapshot?.geomList.length).toEqual(1);
      expect(snapshot?.geomList[0].sourceItemId).toEqual("layer-a");
    });

    it("keeps a pinned panel on its own geometry when another item is measured", function () {
      measureOn("layer-a");
      measureOn("layer-b");

      expect(viewState.measurablePanelSourceItemId).toEqual("layer-a");
      expect(
        terria.measurableGeomList[terria.measurableGeometryIndex].sourceItemId
      ).toEqual("layer-a");
    });

    it("reads back the geometry pinned to an item", function () {
      measureOn("layer-a");

      const state = viewState.getMeasurableGeomStateForSource("layer-a");
      expect(state.geomList[0].sourceItemId).toEqual("layer-a");
      expect(state.geometryIndex).toEqual(0);
    });

    it("falls back to the geometry being measured for an unknown item", function () {
      measureOn("layer-a");

      expect(
        viewState.getMeasurableGeomStateForSource(undefined).geomList
      ).toBe(terria.measurableGeomList);
      expect(
        viewState.getMeasurableGeomStateForSource("layer-z").geomList
      ).toBe(terria.measurableGeomList);
      expect(viewState.getMeasurableGeomSnapshot(undefined)).toBeUndefined();
    });

    it("restores a snapshot over the geometry currently being measured", function () {
      measureOn("layer-a");
      const snapshot = viewState.getMeasurableGeomSnapshot("layer-a")!;

      runInAction(() => {
        terria.measurableGeomList.splice(
          0,
          terria.measurableGeomList.length,
          geometryOf("layer-b"),
          geometryOf("layer-b")
        );
        terria.measurableGeometryIndex = 1;
      });

      runInAction(() => viewState.applyMeasurableGeomSnapshot(snapshot));

      expect(terria.measurableGeomList.length).toEqual(1);
      expect(terria.measurableGeomList[0].sourceItemId).toEqual("layer-a");
      expect(terria.measurableGeometryIndex).toEqual(0);
    });

    it("forgets the snapshot once the measurable panel closes", function () {
      measureOn("layer-a");

      viewState.closeMeasurablePanel();

      expect(viewState.measurablePanelIsVisible).toBe(false);
      expect(viewState.mobileMeasureToolsButtonVisible).toBe(false);
      expect(viewState.measurablePanelSourceItemId).toBeUndefined();
      expect(viewState.getMeasurableGeomSnapshot("layer-a")).toBeUndefined();
    });

    it("keeps the snapshot while another panel is still showing that item", function () {
      measureOn("layer-a");
      runInAction(() => {
        viewState.playPathPanelIsVisible = true;
        viewState.playPathPanelSourceItemId = "layer-a";
      });

      viewState.closeMeasurablePanel();

      expect(viewState.getMeasurableGeomSnapshot("layer-a")).toBeDefined();

      viewState.closePlayPathPanel();

      expect(viewState.playPathPanelIsVisible).toBe(false);
      expect(viewState.playPathPanelSourceItemId).toBeUndefined();
      expect(viewState.getMeasurableGeomSnapshot("layer-a")).toBeUndefined();
    });

    it("clears the download panel state when it closes", function () {
      measureOn("layer-a");
      runInAction(() => {
        viewState.measurableDownloadPanelIsVisible = true;
        viewState.measurableDownloadPanelSourceItemId = "layer-a";
        viewState.measurableDownloadPanelDefaultName = "my path";
      });

      viewState.closeMeasurableDownloadPanel();

      expect(viewState.measurableDownloadPanelIsVisible).toBe(false);
      expect(viewState.measurableDownloadPanelDefaultName).toEqual("");
      expect(viewState.measurableDownloadPanelSourceItemId).toBeUndefined();
    });

    it("drops the extra measured geometries when the last panel on them closes", function () {
      measureOn("layer-a");
      runInAction(() => {
        terria.measurableGeomList.push(geometryOf("layer-a"));
        viewState.measurableDownloadPanelIsVisible = true;
        viewState.measurableDownloadPanelSourceItemId = "layer-a";
      });
      viewState.closeMeasurablePanel();

      viewState.closeMeasurableDownloadPanel();

      expect(terria.measurableGeomList.length).toEqual(1);
    });

    it("closes the panels of an item taken off the workbench", function () {
      putOnWorkbench("layer-a");
      measureOn("layer-a");
      runInAction(() => {
        viewState.playPathPanelIsVisible = true;
        viewState.playPathPanelSourceItemId = "layer-a";
        viewState.measurableDownloadPanelIsVisible = true;
        viewState.measurableDownloadPanelSourceItemId = "layer-a";
      });

      runInAction(() => {
        terria.workbench.items = [];
      });

      expect(viewState.measurablePanelIsVisible).toBe(false);
      expect(viewState.playPathPanelIsVisible).toBe(false);
      expect(viewState.measurableDownloadPanelIsVisible).toBe(false);
      expect(viewState.getMeasurableGeomSnapshot("layer-a")).toBeUndefined();
    });

    it("leaves the panels of an item still on the workbench alone", function () {
      const [, layerB] = putOnWorkbench("layer-a", "layer-b");
      measureOn("layer-a");

      runInAction(() => {
        terria.workbench.remove(layerB);
      });

      expect(viewState.measurablePanelIsVisible).toBe(true);
      expect(viewState.measurablePanelSourceItemId).toEqual("layer-a");
      expect(viewState.getMeasurableGeomSnapshot("layer-a")).toBeDefined();
    });

    describe("the sampling step", function () {
      let resample: jasmine.Spy;

      beforeEach(function () {
        // The managers on terria are frozen, so the spy goes on the prototype.
        resample = spyOn(MeasurableGeometryManager.prototype, "resample");
      });

      /** Gives the geometry a length, which is what the automatic step needs. */
      function measureLongPathOn(sourceItemId: string) {
        runInAction(() => {
          terria.measurableGeomList[0] = {
            ...geometryOf(sourceItemId),
            geodeticDistance: 100000
          };
        });
      }

      it("goes back to automatic each time the panel opens", function () {
        runInAction(() => {
          terria.measurableGeomSamplingStepIsAuto = false;
        });

        measureOn("layer-a");

        expect(viewState.measurablePanelIsVisible).toBe(true);
        expect(terria.measurableGeomSamplingStepIsAuto).toBe(true);
      });

      it("stays where the user left it while the panel is already open", function () {
        measureOn("layer-a");
        runInAction(() => {
          terria.measurableGeomSamplingStepIsAuto = false;
        });

        measureOn("layer-a");

        expect(terria.measurableGeomSamplingStepIsAuto).toBe(false);
      });

      it("re-samples when the user changes the step by hand", function () {
        measureLongPathOn("layer-a");
        runInAction(() => {
          terria.measurableGeomSamplingStepIsAuto = false;
        });
        resample.calls.reset();

        runInAction(() => {
          terria.measurableGeomSamplingStep = 250;
        });

        expect(resample).toHaveBeenCalled();
      });

      it("re-samples when the map zoom moves the automatic step", function () {
        measureLongPathOn("layer-a");
        resample.calls.reset();

        runInAction(() => {
          terria.mainViewer.scale = 1000;
        });

        expect(resample).toHaveBeenCalled();
      });

      it("leaves the geometry alone while the panel is closed", function () {
        measureLongPathOn("layer-a");
        runInAction(() => {
          viewState.measurablePanelIsVisible = false;
        });
        resample.calls.reset();

        runInAction(() => {
          terria.measurableGeomSamplingStepIsAuto = false;
          terria.measurableGeomSamplingStep = 250;
        });

        expect(resample).not.toHaveBeenCalled();
      });

      it("does not re-sample for the step that is already in use", function () {
        measureLongPathOn("layer-a");
        runInAction(() => {
          terria.measurableGeomSamplingStepIsAuto = false;
          terria.measurableGeomSamplingStep = 250;
          terria.measurableGeomSamplingStepInUse = 250;
        });
        resample.calls.reset();

        runInAction(() => {
          terria.measurableGeomSamplingStep = 500;
        });
        runInAction(() => {
          terria.measurableGeomSamplingStep = 250;
        });

        // Back to the step the geometry already carries: nothing to redo.
        expect(resample.calls.count()).toEqual(1);
      });

      it("copes with a geometry slot that has no manager of its own", function () {
        measureLongPathOn("layer-a");
        // Only the first slot comes with a manager of its own.
        runInAction(() => {
          terria.measurableGeometryIndex = 1;
          terria.measurableGeomList[1] = {
            ...geometryOf("layer-b"),
            geodeticDistance: 100000
          };
        });
        expect(terria.measurableGeometryManager[1]).toBeUndefined();

        expect(() =>
          runInAction(() => {
            terria.measurableGeomSamplingStepIsAuto = false;
            terria.measurableGeomSamplingStep = 250;
          })
        ).not.toThrow();
      });
    });

    describe("the play path sampling step", function () {
      it("goes back to automatic each time the play path panel opens", function () {
        runInAction(() => {
          terria.playPathSamplingStepIsAuto = false;
        });

        runInAction(() => {
          viewState.playPathPanelIsVisible = true;
        });

        expect(terria.playPathSamplingStepIsAuto).toBe(true);
      });

      it("stays where the user left it once the panel is open", function () {
        runInAction(() => {
          viewState.playPathPanelIsVisible = true;
        });

        runInAction(() => {
          terria.playPathSamplingStepIsAuto = false;
        });

        expect(terria.playPathSamplingStepIsAuto).toBe(false);
      });

      it("is left alone when the panel closes", function () {
        runInAction(() => {
          viewState.playPathPanelIsVisible = true;
        });
        // Opening the panel is what turns it back on, so the user's choice is
        // made after that.
        runInAction(() => {
          terria.playPathSamplingStepIsAuto = false;
        });

        runInAction(() => {
          viewState.playPathPanelIsVisible = false;
        });

        expect(terria.playPathSamplingStepIsAuto).toBe(false);
      });
    });
  });

  describe("print overlay options", function () {
    it("starts with neither the scale bar nor the compass", function () {
      expect(viewState.printIncludeScaleBar).toBe(false);
      expect(viewState.printIncludeCompass).toBe(false);
    });

    it("toggles the scale bar on and off", function () {
      viewState.togglePrintIncludeScaleBar();
      expect(viewState.printIncludeScaleBar).toBe(true);
      expect(viewState.printIncludeCompass).toBe(false);

      viewState.togglePrintIncludeScaleBar();
      expect(viewState.printIncludeScaleBar).toBe(false);
    });

    it("toggles the compass on and off", function () {
      viewState.togglePrintIncludeCompass();
      expect(viewState.printIncludeCompass).toBe(true);
      expect(viewState.printIncludeScaleBar).toBe(false);

      viewState.togglePrintIncludeCompass();
      expect(viewState.printIncludeCompass).toBe(false);
    });
  });

  describe("removeModelReferences", function () {
    it("unsets the previewedItem if it matches the model", async function () {
      const item = new SimpleCatalogItem("testId", terria);
      await viewState.viewCatalogMember(item);
      viewState.removeModelReferences(item);
      expect(viewState.previewedItem).toBeUndefined();
    });

    it("unsets the userDataPreviewedItem if it matches the model", function () {
      const item = new SimpleCatalogItem("testId", terria);
      viewState.userDataPreviewedItem = item;
      viewState.removeModelReferences(item);
      expect(viewState.userDataPreviewedItem).toBeUndefined();
    });
  });

  describe("tourPointsWithValidRefs", function () {
    it("returns tourPoints ordered by priority", function () {
      runInAction(() => {
        viewState.setTourIndex(0);
        viewState.setShowTour(true);
        (viewState as any).updateAppRef("TestRef", { current: true });
        (viewState as any).updateAppRef("TestRef2", { current: true });
        (viewState as any).updateAppRef("TestRef3", { current: true });
        viewState.tourPoints = [
          {
            appRefName: "TestRef2",
            priority: 20,
            content: "## Motivated by food\n\nNeko loves food"
          },
          {
            appRefName: "TestRef3",
            priority: 30,
            content: "## Lazy\n\nThey like to lounge around all day"
          },
          {
            appRefName: "TestRef",
            priority: 10,
            content: "## Best friends\n\nMochi and neko are best friends"
          }
        ];
      });
      expect(viewState.tourPointsWithValidRefs).toBeDefined();
      expect(viewState.tourPointsWithValidRefs[0].priority).toEqual(10);
      expect(viewState.tourPointsWithValidRefs[1].priority).toEqual(20);
      expect(viewState.tourPointsWithValidRefs[2].priority).toEqual(30);
      expect(viewState.tourPointsWithValidRefs[0].appRefName).toEqual(
        "TestRef"
      );
    });
  });
  describe("tour and trainer interaction", function () {
    beforeEach(function () {
      jasmine.clock().install();
    });
    afterEach(function () {
      jasmine.clock().uninstall();
    });
    it("disables trainer bar if turning on tour", function () {
      runInAction(() => {
        viewState.setTrainerBarExpanded(true);
        viewState.setTrainerBarShowingAllSteps(true);
      });
      expect(viewState.trainerBarExpanded).toEqual(true);
      expect(viewState.trainerBarShowingAllSteps).toEqual(true);
      expect(viewState.showTour).toEqual(false);

      runInAction(() => {
        viewState.setShowTour(true);
      });

      jasmine.clock().tick(animationDuration); // wait for workbench animation

      expect(viewState.trainerBarExpanded).toEqual(false);
      expect(viewState.trainerBarShowingAllSteps).toEqual(false);
      expect(viewState.showTour).toEqual(true);
    });
  });

  it("opens Add Data when openAddData is set to true in config file", function () {
    terria.configParameters.openAddData = true;
    viewState.afterTerriaStarted();
    expect(viewState.explorerPanelIsVisible).toEqual(true);
    expect(viewState.activeTabCategory).toEqual(DATA_CATALOG_NAME);
  });

  it("does not open Add Data when openAddData is set to false in config file", function () {
    terria.configParameters.openAddData = false;
    viewState.afterTerriaStarted();
    expect(viewState.explorerPanelIsVisible).toEqual(false);
  });
});
