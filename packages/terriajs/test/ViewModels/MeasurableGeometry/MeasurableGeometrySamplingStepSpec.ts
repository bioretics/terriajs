import {
  SAMPLING_STEP_DISABLED,
  SAMPLING_STEP_SERIES,
  flightSamplingStep,
  profileSamplingStep,
  samplingStepRange
} from "../../../lib/ViewModels/MeasurableGeometry/MeasurableGeometrySamplingStep";

describe("MeasurableGeometrySamplingStep", function () {
  describe("SAMPLING_STEP_SERIES", function () {
    it("offers the round 1-2-5 steps a user would pick by hand", function () {
      expect(SAMPLING_STEP_SERIES).toEqual([
        1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000
      ]);
    });

    it("names zero as the value that switches resampling off", function () {
      expect(SAMPLING_STEP_DISABLED).toEqual(0);
    });
  });

  describe("samplingStepRange", function () {
    it("has no range to offer without a path", function () {
      expect(samplingStepRange(undefined)).toEqual([0, 0]);
      expect(samplingStepRange(0)).toEqual([0, 0]);
      expect(samplingStepRange(-100)).toEqual([0, 0]);
    });

    it("keeps a 100 km path between a thousand and ten samples", function () {
      expect(samplingStepRange(100000)).toEqual([100, 2000]);
    });

    it("scales the range down with the path", function () {
      expect(samplingStepRange(1000)).toEqual([1, 100]);
    });

    it("still offers a few steps to choose from on a very short path", function () {
      expect(samplingStepRange(20)).toEqual([1, 5]);
    });

    it("never asks for a step outside the series", function () {
      expect(samplingStepRange(10000000)).toEqual([2000, 2000]);
      expect(samplingStepRange(0.5)).toEqual([1, 5]);
    });

    it("only ever returns steps from the series", function () {
      [10, 250, 1234, 55000, 300000].forEach((pathLength) => {
        const [min, max] = samplingStepRange(pathLength);
        expect(SAMPLING_STEP_SERIES).toContain(min);
        expect(SAMPLING_STEP_SERIES).toContain(max);
        expect(min).toBeLessThanOrEqual(max);
      });
    });
  });

  describe("profileSamplingStep", function () {
    it("has no step to suggest without a path", function () {
      expect(profileSamplingStep(undefined)).toEqual(0);
      expect(profileSamplingStep(0)).toEqual(0);
    });

    it("sits in the middle of the range when the zoom is unknown", function () {
      expect(profileSamplingStep(100000)).toEqual(500);
      expect(profileSamplingStep(1000)).toEqual(10);
    });

    it("ignores a zoom that says nothing useful", function () {
      const withoutZoom = profileSamplingStep(100000);

      expect(profileSamplingStep(100000, 0)).toEqual(withoutZoom);
      expect(profileSamplingStep(100000, -5)).toEqual(withoutZoom);
      expect(profileSamplingStep(100000, NaN)).toEqual(withoutZoom);
      expect(profileSamplingStep(100000, Infinity)).toEqual(withoutZoom);
    });

    it("samples more finely as the map is zoomed in", function () {
      const zoomedOut = profileSamplingStep(100000, 1000);
      const middle = profileSamplingStep(100000, 50);
      const zoomedIn = profileSamplingStep(100000, 1);

      expect(zoomedIn).toBeLessThan(middle);
      expect(middle).toBeLessThanOrEqual(zoomedOut);
    });

    it("only blends the zoom in halfway, so the path length still counts", function () {
      expect(profileSamplingStep(100000, 1)).toEqual(100);
    });

    it("stays inside the range the path length allows", function () {
      [1, 5, 50, 500, 5000].forEach((groundResolution) => {
        const [min, max] = samplingStepRange(100000);
        const step = profileSamplingStep(100000, groundResolution);
        expect(step).toBeGreaterThanOrEqual(min);
        expect(step).toBeLessThanOrEqual(max);
        expect(SAMPLING_STEP_SERIES).toContain(step);
      });
    });
  });

  describe("flightSamplingStep", function () {
    it("has no step to suggest without a path", function () {
      expect(flightSamplingStep(undefined)).toEqual(0);
      expect(flightSamplingStep(0)).toEqual(0);
    });

    it("falls back on the path length when the zoom is unknown", function () {
      expect(flightSamplingStep(100000)).toEqual(profileSamplingStep(100000));
    });

    it("follows the zoom rather than the path length", function () {
      expect(flightSamplingStep(100000, 30)).toEqual(200);
      expect(flightSamplingStep(200000, 30)).toEqual(200);
    });

    it("tracks the zoom more closely than the profile step does", function () {
      const flightClose = flightSamplingStep(100000, 1);
      const flightFar = flightSamplingStep(100000, 5000);

      expect(flightClose).toBeLessThan(flightSamplingStep(100000));
      expect(flightFar).toBeGreaterThan(flightSamplingStep(100000));
    });

    it("is still clamped by what the path length allows", function () {
      const [min, max] = samplingStepRange(100000);

      expect(flightSamplingStep(100000, 0.01)).toEqual(min);
      expect(flightSamplingStep(100000, 100000)).toEqual(max);
    });
  });
});
