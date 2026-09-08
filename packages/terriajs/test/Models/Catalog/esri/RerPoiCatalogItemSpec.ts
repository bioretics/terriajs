import { runInAction } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import BillboardGraphics from "terriajs-cesium/Source/DataSources/BillboardGraphics";
import ConstantProperty from "terriajs-cesium/Source/DataSources/ConstantProperty";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import GeoJsonDataSource from "terriajs-cesium/Source/DataSources/GeoJsonDataSource";
import { RER_POI_CATALOG_ITEM_TYPE } from "../../../../lib/ModelMixins/RerPoiHelpers";
import { defaultRerPoiCatalogItemTraits } from "../../../../lib/Traits/TraitsClasses/RerPoiCatalogItemTraits";
import CatalogMemberFactory from "../../../../lib/Models/Catalog/CatalogMemberFactory";
import RerPoiCatalogItem from "../../../../lib/Models/Catalog/Esri/RerPoiCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../../lib/Models/Terria";

const POI_URL =
  "https://servizigis.regione.emilia-romagna.it/geoags/rest/services/portale/rer3d_poi/MapServer/0";

interface EntityCache {
  dataSource: GeoJsonDataSource;
  liveEntityByObjectId: Map<string, Entity>;
}

describe("RerPoiCatalogItem", function () {
  let terria: Terria;
  let item: RerPoiCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new RerPoiCatalogItem("poi", terria);
    item.setTrait(CommonStrata.definition, "url", POI_URL);
    terria.addModel(item);
  });

  afterEach(function () {
    item.dispose();
  });

  it("is registered under its own catalog type", function () {
    expect(RerPoiCatalogItem.type).toEqual(RER_POI_CATALOG_ITEM_TYPE);
    expect(item.type).toEqual(RER_POI_CATALOG_ITEM_TYPE);
    expect(CatalogMemberFactory.find(RER_POI_CATALOG_ITEM_TYPE)).toBe(
      RerPoiCatalogItem
    );
  });

  it("draws its markers with Cesium primitives", function () {
    expect(item.forceCesiumPrimitives).toBe(true);
  });

  it("clusters its markers out of the box", function () {
    expect(item.clustering.enabled).toBe(true);
    expect(item.clustering.pixelRange).toEqual(35);
    expect(item.clustering.minimumClusterSize).toEqual(5);
    expect(item.clustering.pinSize).toEqual(60);
    expect(item.clustering.pinBackgroundColor).toEqual("gray");
  });

  it("reads the POI service fields it expects", function () {
    expect(defaultRerPoiCatalogItemTraits.nameField).toEqual("NOME");
    expect(defaultRerPoiCatalogItemTraits.levelIdField).toEqual("LEVEL_ID");
    expect(defaultRerPoiCatalogItemTraits.domainIdField).toEqual("ID_DOMINIO");
    expect(item.objectIdField).toEqual("OBJECTID");
  });

  it("starts from the documented viewport defaults", function () {
    expect(defaultRerPoiCatalogItemTraits.queryBboxPaddingRatio).toEqual(0.2);
    expect(defaultRerPoiCatalogItemTraits.dynamicRequestDebounceMs).toEqual(
      350
    );
    expect(defaultRerPoiCatalogItemTraits.cameraTiltLimitDegrees).toEqual(60);
    expect(defaultRerPoiCatalogItemTraits.showDebugBBox).toBe(false);
    expect(defaultRerPoiCatalogItemTraits.showLabels).toBe(false);
    expect(defaultRerPoiCatalogItemTraits.labelVisibilityThreshold).toEqual(
      100
    );
  });

  describe("its own traits", function () {
    /** The item reads its traits through an imperative snapshot. */
    function traitOf(name: string) {
      return (item as any).getRerPoiTrait(name);
    }

    it("falls back to the trait defaults", function () {
      expect(traitOf("nameField")).toEqual("NOME");
      expect(traitOf("levelIdField")).toEqual("LEVEL_ID");
      expect(traitOf("domainIdField")).toEqual("ID_DOMINIO");
      expect(traitOf("cameraTiltLimitDegrees")).toEqual(60);
      expect(traitOf("showLabels")).toBe(false);
    });

    it("picks up a trait the catalogue overrides", function () {
      runInAction(() => {
        (item as any).setTrait(
          CommonStrata.definition,
          "nameField",
          "ETICHETTA"
        );
        (item as any).setTrait(CommonStrata.definition, "showLabels", true);
      });

      expect(traitOf("nameField")).toEqual("ETICHETTA");
      expect(traitOf("showLabels")).toBe(true);
    });
  });

  it("has nothing to show before anything is loaded", function () {
    expect(item.mapItems).toEqual([]);
  });

  describe("hiding the POIs when the layer is switched off", function () {
    let reload: jasmine.Spy;
    let debugDataSource: CustomDataSource;

    function makeCache(name: string): EntityCache {
      const dataSource = new GeoJsonDataSource(name);
      const entity = new Entity({
        id: `${name}-1`,
        position: Cartesian3.fromDegrees(11.34, 44.49)
      });
      entity.billboard = new BillboardGraphics({
        show: new ConstantProperty(true)
      });
      entity.show = true;
      dataSource.entities.add(entity);
      dataSource.show = true;
      return {
        dataSource,
        liveEntityByObjectId: new Map([[`${name}-1`, entity]])
      };
    }

    function caches(): EntityCache[] {
      return [
        (item as any).unlabeledEntityCache,
        (item as any).labeledEntityCache
      ];
    }

    function everyEntityIsHidden() {
      return caches().every((cache) =>
        [...cache.liveEntityByObjectId.values()].every(
          (entity) =>
            entity.show === false &&
            entity.billboard?.show?.getValue(JulianDate.now()) === false
        )
      );
    }

    /**
     * Puts the layer on the map with viewport requests running, then fills the
     * caches the dynamic loader would normally have built.
     */
    function showWithCachedEntities() {
      runInAction(() => {
        terria.workbench.items = [item];
      });
      (item as any).startDynamicViewportRequests();
      debugDataSource = new CustomDataSource("debug");
      debugDataSource.show = true;
      runInAction(() => {
        (item as any).unlabeledEntityCache = makeCache("unlabeled");
        (item as any).labeledEntityCache = makeCache("labeled");
        (item as any).debugDataSource = debugDataSource;
      });
    }

    beforeEach(function () {
      // The dynamic loader talks to the POI service; the visibility rules are
      // what this suite is about.
      reload = spyOn(item as any, "reloadDynamicViewportData").and.returnValue(
        Promise.resolve()
      );
      showWithCachedEntities();
    });

    it("shows the cached entities while the layer is on the map", function () {
      expect(caches().every((cache) => cache.dataSource.show)).toBe(true);
      expect(everyEntityIsHidden()).toBe(false);
    });

    it("hides every cached entity when the layer is toggled off", function () {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "show", false);
      });

      expect(caches().every((cache) => cache.dataSource.show === false)).toBe(
        true
      );
      expect(everyEntityIsHidden()).toBe(true);
      expect(debugDataSource.show).toBe(false);
    });

    it("hides them when the layer leaves the workbench too", function () {
      runInAction(() => {
        terria.workbench.items = [];
      });

      expect(caches().every((cache) => cache.dataSource.show === false)).toBe(
        true
      );
      expect(everyEntityIsHidden()).toBe(true);
    });

    it("does not ask the service for data while the layer is off", async function () {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "show", false);
      });
      reload.calls.reset();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(reload).not.toHaveBeenCalled();
    });

    it("reloads the viewport once the layer is switched back on", async function () {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "show", false);
      });
      reload.calls.reset();

      runInAction(() => {
        item.setTrait(CommonStrata.user, "show", true);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(reload).toHaveBeenCalled();
    });

    it("ignores camera movement while the layer is off", function () {
      runInAction(() => {
        item.setTrait(CommonStrata.user, "show", false);
      });
      reload.calls.reset();

      (item as any).onDynamicViewportChanged();

      expect((item as any).dynamicReloadTimer).toBeUndefined();
    });
  });
});
