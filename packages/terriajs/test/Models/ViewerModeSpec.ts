import { runInAction } from "mobx";
import SceneMode from "terriajs-cesium/Source/Scene/SceneMode";
import Terria from "../../lib/Models/Terria";
import ViewerMode, {
  getViewerType,
  isViewerMode,
  MapViewers,
  setViewerMode
} from "../../lib/Models/ViewerMode";
import TerriaViewer from "../../lib/ViewModels/TerriaViewer";
import english from "../../wwwroot/languages/en/translation.json";

describe("ViewerMode", function () {
  let terria: Terria;
  let viewer: TerriaViewer;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    viewer = terria.mainViewer;
  });

  describe("MapViewers", function () {
    it("offers 3d, smooth 3d, 2d Cesium and Leaflet", function () {
      expect(Object.keys(MapViewers)).toEqual([
        "3d",
        "3dsmooth",
        "2dcesium",
        "2d"
      ]);
    });

    it("maps 2dcesium onto the Cesium2D viewer without terrain", function () {
      expect(MapViewers["2dcesium"].viewerMode).toEqual(ViewerMode.Cesium2D);
      expect(MapViewers["2dcesium"].terrain).toBe(false);
      expect(MapViewers["2dcesium"].available).toBe(true);
    });

    it("only asks for terrain in full 3d", function () {
      expect(MapViewers["3d"].terrain).toBe(true);
      expect(MapViewers["3dsmooth"].terrain).toBe(false);
      expect(MapViewers["2d"].terrain).toBe(false);
    });

    it("labels every viewer with a translation key that exists", function () {
      for (const key of Object.keys(
        MapViewers
      ) as (keyof typeof MapViewers)[]) {
        const label = MapViewers[key].label;
        const path = label.split(".");
        const translation = path.reduce<any>(
          (node, segment) => node?.[segment],
          english
        );
        expect(translation)
          .withContext(`missing translation for ${label}`)
          .toBeDefined();
      }
    });
  });

  describe("isViewerMode", function () {
    it("accepts the configured viewer keys", function () {
      expect(isViewerMode("3d")).toBe(true);
      expect(isViewerMode("2dcesium")).toBe(true);
      expect(isViewerMode("2d")).toBe(true);
    });

    it("rejects anything else", function () {
      expect(isViewerMode("cesium")).toBe(false);
      expect(isViewerMode("")).toBe(false);
    });
  });

  describe("getViewerType", function () {
    it("resolves each key to its viewer", function () {
      expect(getViewerType("3d")).toEqual(ViewerMode.Cesium);
      expect(getViewerType("3dsmooth")).toEqual(ViewerMode.Cesium);
      expect(getViewerType("2dcesium")).toEqual(ViewerMode.Cesium2D);
      expect(getViewerType("2d")).toEqual(ViewerMode.Leaflet);
    });

    it("returns undefined for an unknown key", function () {
      expect(getViewerType("globe")).toBeUndefined();
    });
  });

  describe("setViewerMode", function () {
    it("switches to Cesium with terrain for 3d", function () {
      setViewerMode("3d", viewer);
      expect(viewer.viewerMode).toEqual(ViewerMode.Cesium);
      expect(viewer.viewerOptions.useTerrain).toBe(true);
    });

    it("switches to Cesium without terrain for 3dsmooth", function () {
      setViewerMode("3dsmooth", viewer);
      expect(viewer.viewerMode).toEqual(ViewerMode.Cesium);
      expect(viewer.viewerOptions.useTerrain).toBe(false);
    });

    it("switches to the flat Cesium viewer for 2dcesium", function () {
      setViewerMode("2dcesium", viewer);
      expect(viewer.viewerMode).toEqual(ViewerMode.Cesium2D);
      expect(viewer.viewerOptions.useTerrain).toBe(false);
    });

    it("switches to Leaflet for 2d", function () {
      setViewerMode("2d", viewer);
      expect(viewer.viewerMode).toEqual(ViewerMode.Leaflet);
    });

    it("drops terrain when going from 3d to the flat Cesium viewer", function () {
      setViewerMode("3d", viewer);
      expect(viewer.viewerOptions.useTerrain).toBe(true);

      setViewerMode("2dcesium", viewer);
      expect(viewer.viewerOptions.useTerrain).toBe(false);
    });

    it("puts the Cesium scene into SCENE2D for 2dcesium", function () {
      const scene = { mode: SceneMode.SCENE3D };
      spyOnProperty(terria, "cesium", "get").and.returnValue({ scene } as any);

      setViewerMode("2dcesium", viewer);

      expect(scene.mode).toEqual(SceneMode.SCENE2D);
    });

    it("puts the Cesium scene back into SCENE3D for 3d", function () {
      const scene = { mode: SceneMode.SCENE2D };
      spyOnProperty(terria, "cesium", "get").and.returnValue({ scene } as any);

      setViewerMode("3d", viewer);

      expect(scene.mode).toEqual(SceneMode.SCENE3D);
    });

    it("leaves the viewer alone and complains about an unknown mode", function () {
      runInAction(() => {
        viewer.viewerMode = ViewerMode.Cesium;
      });
      const error = spyOn(console, "error");

      setViewerMode("globe" as any, viewer);

      expect(error).toHaveBeenCalled();
      expect(viewer.viewerMode).toEqual(ViewerMode.Cesium);
    });
  });
});
