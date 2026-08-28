import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import Ray from "terriajs-cesium/Source/Core/Ray";
import Scene from "terriajs-cesium/Source/Scene/Scene";
import Terria from "../../../../../lib/Models/Terria";
import {
  getDistanceLegendMetrics,
  getDistanceLegendMetricsFromCesium
} from "../../../../../lib/ReactViews/Map/Panels/SharePanel/Print/getDistanceLegendMetrics";

/**
 * A scene just rich enough for the scale bar: it picks two points on the globe
 * one pixel apart, which is all the metrics are derived from.
 */
function sceneWithPixelWidth(
  degreesPerPixel: number | undefined,
  canPickRay = true
): Scene {
  let pick = 0;
  return {
    canvas: { clientWidth: 500, clientHeight: 400 },
    camera: {
      getPickRay: () => (canPickRay ? new Ray() : undefined)
    },
    globe: {
      ellipsoid: Ellipsoid.WGS84,
      pick: () => {
        if (degreesPerPixel === undefined) return undefined;
        const longitude = 11.34 + (pick++ === 0 ? 0 : degreesPerPixel);
        return Cartesian3.fromDegrees(longitude, 44.49);
      }
    }
  } as unknown as Scene;
}

describe("getDistanceLegendMetrics", function () {
  let terria: Terria;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
  });

  describe("from a Cesium scene", function () {
    it("labels the bar with the roundest distance that fits", function () {
      const metrics = getDistanceLegendMetricsFromCesium(
        sceneWithPixelWidth(0.00009),
        terria
      );

      // ~7 m per pixel, so 500 m is the longest round bar under 100 pixels.
      expect(metrics?.label).toEqual("500 m");
    });

    it("switches to kilometres for long distances", function () {
      const metrics = getDistanceLegendMetricsFromCesium(
        sceneWithPixelWidth(0.9),
        terria
      );

      expect(metrics?.label).toMatch(/ km$/);
    });

    it("sizes the bar from the metres each pixel covers", function () {
      const metrics = getDistanceLegendMetricsFromCesium(
        sceneWithPixelWidth(0.00009),
        terria
      );

      expect(metrics?.barWidth).toEqual(
        Math.floor(500 / terria.mainViewer.scale)
      );
      expect(metrics?.barWidth).toBeGreaterThan(0);
      expect(metrics?.barWidth).toBeLessThan(100);
    });

    it("records the map scale it measured on terria", function () {
      getDistanceLegendMetricsFromCesium(sceneWithPixelWidth(0.00009), terria);

      expect(terria.mainViewer.scale).toBeGreaterThan(0);
    });

    it("scales the bar up for a larger screenshot", function () {
      const single = getDistanceLegendMetricsFromCesium(
        sceneWithPixelWidth(0.00009),
        terria
      );
      const double = getDistanceLegendMetricsFromCesium(
        sceneWithPixelWidth(0.00009),
        terria,
        2
      );

      expect(double?.label).toEqual(single!.label);
      expect(double?.barWidth).toEqual(
        Math.floor((500 / terria.mainViewer.scale) * 2)
      );
      expect(double!.barWidth).toBeGreaterThan(single!.barWidth);
    });

    it("gives up when the camera cannot cast a ray", function () {
      expect(
        getDistanceLegendMetricsFromCesium(
          sceneWithPixelWidth(0.00009, false),
          terria
        )
      ).toBeNull();
    });

    it("gives up when the ray misses the globe", function () {
      expect(
        getDistanceLegendMetricsFromCesium(
          sceneWithPixelWidth(undefined),
          terria
        )
      ).toBeNull();
    });
  });

  it("has nothing to measure without a viewer", function () {
    expect(getDistanceLegendMetrics(terria)).toBeNull();
  });
});
