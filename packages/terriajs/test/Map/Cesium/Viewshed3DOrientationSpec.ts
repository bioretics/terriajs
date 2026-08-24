import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import {
  directionFromHeadingPitch,
  headingPitchFromObserverAndTarget
} from "../../../lib/Map/Cesium/Viewshed3D";

describe("Viewshed3D orientation", () => {
  const fakeScene = {
    globe: { ellipsoid: Ellipsoid.WGS84 }
  } as never;

  it("derives near-zero pitch for a level east look", () => {
    const observer = Cartesian3.fromDegrees(0, 0, 100);
    const target = Cartesian3.fromDegrees(0.01, 0, 100);

    const orientation = headingPitchFromObserverAndTarget(
      observer,
      target,
      fakeScene
    );

    expect(orientation.distance).toBeGreaterThan(100);
    expect(CesiumMath.toDegrees(orientation.heading)).toBeCloseTo(90, 0);
    expect(CesiumMath.toDegrees(orientation.pitch)).toBeCloseTo(0, 0);
  });

  it("derives a clear downward pitch toward lower terrain", () => {
    const observer = Cartesian3.fromDegrees(0, 0, 200);
    const target = Cartesian3.fromDegrees(0.01, 0, 0);

    const orientation = headingPitchFromObserverAndTarget(
      observer,
      target,
      fakeScene
    );

    expect(orientation.pitch).toBeLessThan(-0.05);
    expect(orientation.pitch).toBeGreaterThan(-Math.PI / 2 + 0.1);
  });

  it("round-trips heading and pitch into a direction that reaches the target", () => {
    const observer = Cartesian3.fromDegrees(11, 46, 50);
    const target = Cartesian3.fromDegrees(11.02, 46.01, 40);
    const orientation = headingPitchFromObserverAndTarget(
      observer,
      target,
      fakeScene
    );
    const direction = directionFromHeadingPitch(
      observer,
      orientation.heading,
      orientation.pitch,
      fakeScene
    );
    const expected = Cartesian3.normalize(
      Cartesian3.subtract(target, observer, new Cartesian3()),
      new Cartesian3()
    );

    expect(Cartesian3.dot(direction, expected)).toBeGreaterThan(0.999);
  });
});
