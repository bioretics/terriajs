import { computed } from "mobx";
import Cesium from "../../lib/Models/Cesium";
import Terria from "../../lib/Models/Terria";
import TerriaViewer from "../../lib/ViewModels/TerriaViewer";
import BoxDrawing from "../../lib/Models/BoxDrawing";
import { isSideEntity } from "../../lib/Models/BoxDrawing";
import RepositionableBoxDrawing from "../../lib/Models/RepositionableBoxDrawing";
import createRepositionableBoxDrawing from "../../lib/Models/createRepositionableBoxDrawing";
import Matrix4 from "terriajs-cesium/Source/Core/Matrix4";
import TranslationRotationScale from "terriajs-cesium/Source/Core/TranslationRotationScale";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Quaternion from "terriajs-cesium/Source/Core/Quaternion";
import JulianDate from "terriajs-cesium/Source/Core/JulianDate";
import ColorMaterialProperty from "terriajs-cesium/Source/DataSources/ColorMaterialProperty";

describe("BoxDrawing", function () {
  let terria: Terria;
  let terriaViewer: TerriaViewer;
  let cesium: Cesium;
  let container: HTMLElement;

  beforeEach(function () {
    terria = new Terria({
      baseUrl: "./"
    });
    terriaViewer = new TerriaViewer(
      terria,
      computed(() => [])
    );
    container = document.createElement("div");
    container.id = "container";
    document.body.appendChild(container);

    cesium = new Cesium(terriaViewer, container);
  });

  afterEach(function () {
    terriaViewer.destroy();
    document.body.removeChild(container);
  });

  describe("BoxDrawing creation", function () {
    it("can be created from a transformation matrix", function () {
      const boxDrawing = BoxDrawing.fromTransform(cesium, Matrix4.IDENTITY);
      expect(boxDrawing).toBeDefined();
    });

    it("can be created from translation, rotation, scale object", function () {
      const boxDrawing = BoxDrawing.fromTranslationRotationScale(
        cesium,
        new TranslationRotationScale(
          Cartesian3.ZERO,
          Quaternion.IDENTITY,
          Cartesian3.ONE
        )
      );
      expect(boxDrawing).toBeDefined();
    });

    it("can be constrained to map-plane translation and heading", function () {
      const boxDrawing = RepositionableBoxDrawing.fromTransform(
        cesium,
        Matrix4.IDENTITY,
        {
          disableVerticalMovement: true,
          allowedTranslationAxes: ["x", "y"],
          allowedRotationAxes: ["map-normal"],
          drawNonUniformScaleGrips: false
        }
      );

      expect(boxDrawing.disableVerticalMovement).toBeTrue();
      expect(boxDrawing.allowedTranslationAxes).toEqual(["x", "y"]);
      expect(boxDrawing.allowedRotationAxes).toEqual(["map-normal"]);
      boxDrawing.enableScaling = false;
      expect(boxDrawing.enableScaling).toBeFalse();
    });

    it("creates a reposition box with per-tool 2D interaction constraints", function () {
      const boxDrawing = createRepositionableBoxDrawing(
        cesium,
        Matrix4.IDENTITY,
        true
      );

      expect(boxDrawing.disableVerticalMovement).toBeTrue();
      expect(boxDrawing.allowedTranslationAxes).toEqual(["x", "y"]);
      expect(boxDrawing.allowedRotationAxes).toEqual(["map-normal"]);
      expect(boxDrawing.enableScaling).toBeFalse();
    });

    it("keeps all translation and rotation axes available in 3D", function () {
      const boxDrawing = createRepositionableBoxDrawing(
        cesium,
        Matrix4.IDENTITY,
        false
      );

      expect(boxDrawing.disableVerticalMovement).toBeFalse();
      expect(boxDrawing.allowedTranslationAxes).toEqual(["x", "y", "z"]);
      expect(boxDrawing.allowedRotationAxes).toEqual([
        "heading",
        "pitch",
        "roll"
      ]);
      expect(boxDrawing.enableScaling).toBeFalse();
    });

    it("keeps clip-box styling independent from reposition styling", function () {
      const clipBoxDrawing = BoxDrawing.fromTransform(cesium, Matrix4.IDENTITY);
      const repositionBoxDrawing = createRepositionableBoxDrawing(
        cesium,
        Matrix4.IDENTITY,
        false
      );
      const clipSide =
        clipBoxDrawing.dataSource.entities.values.find(isSideEntity);
      const repositionSide =
        repositionBoxDrawing.dataSource.entities.values.find(isSideEntity);
      if (!clipSide || !repositionSide) {
        throw new Error("Expected both box drawings to contain a side");
      }
      const getFirstEdgeColor = (
        boxDrawing: BoxDrawing | RepositionableBoxDrawing
      ) => {
        const edge = boxDrawing.dataSource.entities.values.find(
          (entity) => entity.polyline?.material instanceof ColorMaterialProperty
        );
        const material = edge?.polyline?.material;
        return material instanceof ColorMaterialProperty
          ? material.color?.getValue(JulianDate.now())
          : undefined;
      };

      expect(clipSide?.plane.outlineWidth?.getValue(JulianDate.now())).toBe(1);
      expect(
        repositionSide?.plane.outlineWidth?.getValue(JulianDate.now())
      ).toBe(3);
      expect(clipBoxDrawing.enableScaling).toBeTrue();
      expect(repositionBoxDrawing.enableScaling).toBeFalse();

      const clipMaterial = clipSide.plane.material;
      const repositionMaterial = repositionSide.plane.material;
      if (
        !(clipMaterial instanceof ColorMaterialProperty) ||
        !clipMaterial.color ||
        !(repositionMaterial instanceof ColorMaterialProperty) ||
        !repositionMaterial.color
      ) {
        throw new Error("Expected box sides to use color materials");
      }
      const clipFill = clipMaterial.color.getValue(JulianDate.now());
      const repositionFill = repositionMaterial.color.getValue(
        JulianDate.now()
      );
      expect(clipFill?.alpha).toBeCloseTo(0.1);
      expect(repositionFill?.alpha).toBeCloseTo(0.18);

      expect(getFirstEdgeColor(clipBoxDrawing)?.alpha).toBeCloseTo(0.1);
      expect(getFirstEdgeColor(repositionBoxDrawing)?.alpha).toBeCloseTo(0.85);
    });
  });

  describe("the dataSource", function () {
    it("has 6 sides", function () {
      // const box = new BoxDrawing(cesium, Matrix4.IDENTITY, () => {});
      // const sides = box.dataSource.entities.values.filter(isSideEntity);
      // expect(sides.length).toEqual(6);
    });

    it("has 14 scaling points");
    it("has 4 rotation edges");
  });

  describe("setTransform", function () {
    it("updates the box position, orientation and dimensions");
  });

  describe("interaction", function () {
    it("stops interactions when show is set to false on the datasource");
    it("starts interactions when show is set to true on the datasource");
    it("stops interactions when datasource becomes unobserved");
    it("starts interactions when datasource becomes observed");
  });

  describe("move interaction", function () {
    it("can move the box up and down by dragging the top side");
    it("can move the box sideways by dragging any other side");
    it(
      "when clamping is enabled, move should not allow the box to go below the ground"
    );
  });

  describe("scale interaction", function () {
    it("can scale the box along a side axis by dragging a face point");
    it("can scale the box proportionately by dragging a corner point");
    it(
      "when clamping is enabled, scaling should not make the box go underground"
    );
  });

  describe("rotate interaction", function () {
    it("can rotate the box by dragging an edge");
  });
});
