import i18next from "i18next";
import { runInAction } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Entity from "terriajs-cesium/Source/DataSources/Entity";
import supportsWebGL from "../../lib/Core/supportsWebGL";
import PickedFeatures from "../../lib/Map/PickedFeatures/PickedFeatures";
import TerriaFeature from "../../lib/Models/Feature/Feature";
import MapInteractionMode from "../../lib/Models/MapInteractionMode";
import Terria from "../../lib/Models/Terria";
import UserDrawing from "../../lib/Models/UserDrawing";

const describeIfSupported = supportsWebGL() ? describe : xdescribe;

describeIfSupported("UserDrawing that requires WebGL", function () {
  let terria: Terria;
  let container: HTMLElement;

  beforeEach(() => {
    terria = new Terria();
    container = document.createElement("div");
    document.body.appendChild(container);
    terria.mainViewer.attach(container);
  });

  afterEach(() => {
    terria.mainViewer.destroy();
    document.body.removeChild(container);
  });

  it("changes cursor to crosshair when entering drawing mode", async function () {
    await terria.mainViewer.viewerLoadPromise;
    const userDrawing = new UserDrawing({ terria });
    const cesium = terria.cesium;
    expect(cesium).toBeDefined();
    if (cesium) {
      expect(cesium.cesiumWidget.canvas.style.cursor).toEqual("");
      userDrawing.enterDrawMode();
      expect(cesium.cesiumWidget.canvas.style.cursor).toEqual("crosshair");
      (userDrawing as any).cleanUp();
      expect(cesium.cesiumWidget.canvas.style.cursor).toEqual("auto");
    }
  });
});

describe("UserDrawing", function () {
  let terria: Terria;

  beforeEach(function () {
    terria = new Terria();
  });

  // This build drops the generic "click to add a point" hints: the measure
  // tools put their own running measurement in the dialog through
  // onMakeDialogMessage, and the two messages fought over the same line.
  it("will use default options if options are not specified", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);

    expect(userDrawing.getDialogMessage()).toEqual(
      `<div><strong>${i18next.t(
        ($) => $.models.userDrawing.messageHeader
      )}</strong></br></div>`
    );
  });

  it("getDialogMessage contains callback message if callback is specified", function () {
    const options = {
      terria: terria,
      onMakeDialogMessage: function () {
        return "HELLO";
      }
    };
    const userDrawing = new UserDrawing(options);

    expect(userDrawing.getDialogMessage()).toEqual(
      `<div><strong>${i18next.t(
        ($) => $.models.userDrawing.messageHeader
      )}</strong></br>HELLO</br></div>`
    );
  });

  it("prompts the user to redraw once a rectangle has two corners", function () {
    const userDrawing = new UserDrawing({
      terria,
      allowPolygon: false,
      drawRectangle: true
    });
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    [
      [149.121, -35.309],
      [149.124, -35.311]
    ].forEach(([longitude, latitude]) => {
      pickedFeatures.pickPosition = Ellipsoid.WGS84.cartographicToCartesian(
        new Cartographic(
          CesiumMath.toRadians(longitude),
          CesiumMath.toRadians(latitude),
          0
        )
      );
      runInAction(() => {
        userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
          pickedFeatures;
      });
    });

    expect(userDrawing.getDialogMessage()).toContain(
      i18next.t(($) => $.models.userDrawing.clickToRedrawRectangle)
    );
  });

  it("listens for user picks on map after entering drawing mode", function () {
    const userDrawing = new UserDrawing({ terria });
    expect(userDrawing.terria.mapInteractionModeStack.length).toEqual(0);
    userDrawing.enterDrawMode();
    expect(userDrawing.terria.mapInteractionModeStack.length).toEqual(1);
  });

  it("disables feature info requests when in drawing mode", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);
    expect(userDrawing.terria.allowFeatureInfoRequests).toEqual(true);
    userDrawing.enterDrawMode();
    expect(userDrawing.terria.allowFeatureInfoRequests).toEqual(false);
  });

  it("re-enables feature info requests on cleanup", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);
    userDrawing.enterDrawMode();
    expect(userDrawing.terria.allowFeatureInfoRequests).toEqual(false);
    userDrawing.cleanUp();
    expect(userDrawing.terria.allowFeatureInfoRequests).toEqual(true);
  });

  describe("map interaction mode lifecycle", function () {
    // Auckland, in case you're wondering
    const aucklandPosition = new Cartesian3(
      -5088454.576893678,
      465233.10329933715,
      -3804299.6786334896
    );

    function pickPoint(mode: MapInteractionMode) {
      const pickedFeatures = new PickedFeatures();
      pickedFeatures.pickPosition = aucklandPosition;
      runInAction(() => {
        mode.pickedFeatures = pickedFeatures;
      });
    }

    it("removes only its own picking mode when the drawing ends", function () {
      const userDrawing = new UserDrawing({ terria });
      userDrawing.enterDrawMode();
      const otherMode = new MapInteractionMode({ message: "another tool" });
      runInAction(() => {
        terria.mapInteractionModeStack.push(otherMode);
      });

      userDrawing.endDrawing();

      expect(terria.mapInteractionModeStack.slice()).toEqual([otherMode]);
    });

    it("removes its picking mode when cleaning up", function () {
      const userDrawing = new UserDrawing({ terria });
      userDrawing.enterDrawMode();
      expect(terria.mapInteractionModeStack.length).toEqual(1);

      userDrawing.cleanUp();

      expect(terria.mapInteractionModeStack.length).toEqual(0);
    });

    it("keeps another tool's mode while it swaps its own between points", function () {
      const userDrawing = new UserDrawing({ terria });
      userDrawing.enterDrawMode();
      const drawMode = terria.mapInteractionModeStack[0];
      const otherMode = new MapInteractionMode({ message: "another tool" });
      runInAction(() => {
        terria.mapInteractionModeStack.push(otherMode);
      });

      pickPoint(drawMode);

      expect(terria.mapInteractionModeStack.length).toEqual(2);
      expect(terria.mapInteractionModeStack).toContain(otherMode);
      expect(terria.mapInteractionModeStack).not.toContain(drawMode);
    });

    it("leaves nothing behind across repeated drawings", function () {
      const first = new UserDrawing({ terria });
      first.enterDrawMode();
      first.endDrawing();

      const second = new UserDrawing({ terria });
      second.enterDrawMode();
      second.endDrawing();

      expect(terria.mapInteractionModeStack.length).toEqual(0);
      expect(terria.allowFeatureInfoRequests).toBe(true);
    });

    it("does not remove a mode a second time when it is ended twice", function () {
      const userDrawing = new UserDrawing({ terria });
      userDrawing.enterDrawMode();
      userDrawing.endDrawing();

      const otherMode = new MapInteractionMode({ message: "another tool" });
      runInAction(() => {
        terria.mapInteractionModeStack.push(otherMode);
      });
      userDrawing.endDrawing();

      expect(terria.mapInteractionModeStack.slice()).toEqual([otherMode]);
    });
  });

  it("ensures onPointClicked callback is called when point is picked by user", function () {
    const onPointClicked = jasmine.createSpy();
    const userDrawing = new UserDrawing({ terria, onPointClicked });
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();
    // Auckland, in case you're wondering
    pickedFeatures.pickPosition = new Cartesian3(
      -5088454.576893678,
      465233.10329933715,
      -3804299.6786334896
    );
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });
    const pointEntities = onPointClicked.calls.mostRecent().args[0];
    expect(pointEntities.entities.values.length).toEqual(1);
  });

  it("ensures graphics are added when point is picked by user", function () {
    const userDrawing = new UserDrawing({ terria });
    expect(userDrawing.pointEntities.entities.values.length).toEqual(0);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(0);
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();
    // Auckland, in case you're wondering
    pickedFeatures.pickPosition = new Cartesian3(
      -5088454.576893678,
      465233.10329933715,
      -3804299.6786334896
    );
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });
    expect(userDrawing.pointEntities.entities.values.length).toEqual(1);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(1);
  });

  it("ensures graphics are updated when points change", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);
    expect(userDrawing.pointEntities.entities.values.length).toEqual(0);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(0);

    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();
    // Auckland, in case you're wondering
    const x = -5088454.576893678;
    const y = 465233.10329933715;
    const z = -3804299.6786334896;

    pickedFeatures.pickPosition = new Cartesian3(x, y, z);
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Check point
    const currentPoint = userDrawing.pointEntities.entities.values[0];
    expect(currentPoint.position).toBeDefined();

    if (currentPoint.position !== undefined) {
      const currentPointPos = currentPoint.position.getValue(
        terria.timelineClock.currentTime
      );
      expect(currentPointPos?.x).toEqual(x);
      expect(currentPointPos?.y).toEqual(y);
      expect(currentPointPos?.z).toEqual(z);
    }

    // Check line as well
    let lineEntity = userDrawing.otherEntities.entities.values[0];
    expect(lineEntity.polyline).toBeDefined();

    if (lineEntity.polyline !== undefined) {
      expect(lineEntity.polyline.positions).toBeDefined();
      if (lineEntity.polyline.positions !== undefined) {
        const currentPointPos = lineEntity.polyline.positions.getValue(
          terria.timelineClock.currentTime
        )[0];
        expect(currentPointPos.x).toEqual(x);
        expect(currentPointPos.y).toEqual(y);
        expect(currentPointPos.z).toEqual(z);
      }
    }

    // Okay, now change points. LA.
    const newPickedFeatures = new PickedFeatures();
    const newX = -2503231.890682526;
    const newY = -4660863.528418564;
    const newZ = 3551306.84427321;
    newPickedFeatures.pickPosition = new Cartesian3(newX, newY, newZ);
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        newPickedFeatures;
    });

    // Check point
    const newPoint = userDrawing.pointEntities.entities.values[1];
    expect(newPoint.position).toBeDefined();

    if (newPoint.position !== undefined) {
      const newPointPos = newPoint.position.getValue(
        terria.timelineClock.currentTime
      );
      expect(newPointPos?.x).toEqual(newX);
      expect(newPointPos?.y).toEqual(newY);
      expect(newPointPos?.z).toEqual(newZ);
    }

    // Check line as well
    lineEntity = userDrawing.otherEntities.entities.values[0];
    expect(lineEntity.polyline).toBeDefined();

    if (lineEntity.polyline !== undefined) {
      expect(lineEntity.polyline.positions).toBeDefined();
      if (lineEntity.polyline.positions !== undefined) {
        const newPointPos = lineEntity.polyline.positions.getValue(
          terria.timelineClock.currentTime
        )[1];
        expect(newPointPos.x).toEqual(newX);
        expect(newPointPos.y).toEqual(newY);
        expect(newPointPos.z).toEqual(newZ);
      }
    }
  });

  it("returns correct button text for any given number of points on map", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);

    expect(userDrawing.getButtonText()).toEqual(
      i18next.t(($) => $.models.userDrawing.btnCancel)
    );
    userDrawing.pointEntities.entities.values.push(new Entity());
    expect(userDrawing.getButtonText()).toEqual(
      i18next.t(($) => $.models.userDrawing.btnCancel)
    );
    userDrawing.pointEntities.entities.values.push(new Entity());
    expect(userDrawing.getButtonText()).toEqual(
      i18next.t(($) => $.models.userDrawing.btnDone)
    );
  });

  it("cleans up when cleanup is called", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);
    expect(userDrawing.pointEntities.entities.values.length).toEqual(0);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(0);
    userDrawing.enterDrawMode();

    const pickedFeatures = new PickedFeatures();
    // Auckland, in case you're wondering
    pickedFeatures.pickPosition = new Cartesian3(
      -5088454.576893678,
      465233.10329933715,
      -3804299.6786334896
    );
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect(userDrawing.pointEntities.entities.values.length).toEqual(1);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(1);

    (userDrawing as any).cleanUp();
    expect(userDrawing.pointEntities.entities.values.length).toEqual(0);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(0);
    expect((userDrawing as any).inDrawMode).toBeFalsy();
    expect((userDrawing as any).closeLoop).toBeFalsy();
  });

  it("ensures onCleanUp callback is called when clean up occurs", function () {
    const onCleanUp = jasmine.createSpy();
    const userDrawing = new UserDrawing({ terria, onCleanUp });
    userDrawing.enterDrawMode();
    expect(onCleanUp).not.toHaveBeenCalled();
    (userDrawing as any).cleanUp();
    expect(onCleanUp).toHaveBeenCalled();
  });

  it("function clickedExistingPoint detects and handles if existing point is clicked", function () {
    const userDrawing = new UserDrawing({ terria });
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    // First point
    // Points around Parliament house
    const pt1Position = new Cartographic(
      CesiumMath.toRadians(149.121),
      CesiumMath.toRadians(-35.309),
      CesiumMath.toRadians(0)
    );
    const pt1CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt1Position);
    pickedFeatures.pickPosition = pt1CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Second point
    const pt2Position = new Cartographic(
      CesiumMath.toRadians(149.124),
      CesiumMath.toRadians(-35.311),
      CesiumMath.toRadians(0)
    );
    const pt2CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt2Position);
    pickedFeatures.pickPosition = pt2CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Third point
    const pt3Position = new Cartographic(
      CesiumMath.toRadians(149.127),
      CesiumMath.toRadians(-35.308),
      CesiumMath.toRadians(0)
    );
    const pt3CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt3Position);
    pickedFeatures.pickPosition = pt3CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });
    expect((userDrawing as any).closeLoop).toBeFalsy();

    // Now pick the first point
    pickedFeatures.pickPosition = pt1CartesianPosition;
    // If in the UI the user clicks on a point, it returns that entity, so we're pulling it out of userDrawing and
    // pretending the user actually clicked on it.
    const pt1Entity = userDrawing.pointEntities.entities.values[0];
    pickedFeatures.features = [pt1Entity as TerriaFeature];
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect((userDrawing as any).closeLoop).toBeTruthy();
    expect(userDrawing.pointEntities.entities.values.length).toEqual(3);
  });

  it("loop does not close if polygon is not allowed", function () {
    const options = { terria: terria, allowPolygon: false };
    const userDrawing = new UserDrawing(options);
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    // First point
    // Points around Parliament house
    const pt1Position = new Cartographic(
      CesiumMath.toRadians(149.121),
      CesiumMath.toRadians(-35.309),
      CesiumMath.toRadians(0)
    );
    const pt1CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt1Position);
    pickedFeatures.pickPosition = pt1CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Second point
    const pt2Position = new Cartographic(
      CesiumMath.toRadians(149.124),
      CesiumMath.toRadians(-35.311),
      CesiumMath.toRadians(0)
    );
    const pt2CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt2Position);
    pickedFeatures.pickPosition = pt2CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Third point
    const pt3Position = new Cartographic(
      CesiumMath.toRadians(149.127),
      CesiumMath.toRadians(-35.308),
      CesiumMath.toRadians(0)
    );
    const pt3CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt3Position);
    pickedFeatures.pickPosition = pt3CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });
    expect((userDrawing as any).closeLoop).toBeFalsy();

    // Now pick the first point
    pickedFeatures.pickPosition = pt1CartesianPosition;
    // If in the UI the user clicks on a point, it returns that entity, so we're pulling it out of userDrawing and
    // pretending the user actually clicked on it.
    const pt1Entity = userDrawing.pointEntities.entities.values[0];
    pickedFeatures.features = [pt1Entity as TerriaFeature];
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect((userDrawing as any).closeLoop).toBeFalsy();
    expect(userDrawing.pointEntities.entities.values.length).toEqual(2);
  });

  // The polygon entity UserDrawing adds when the shape is closed.
  const USER_POLYGON = "User polygon";

  /** Drives the drawing the way a click on the map would. */
  function drawingHarness(userDrawing: UserDrawing, terria: Terria) {
    const pickedFeatures = new PickedFeatures();

    const send = () =>
      runInAction(() => {
        userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
          pickedFeatures;
      });

    return {
      clickAt(longitude: number, latitude: number) {
        pickedFeatures.features = [];
        pickedFeatures.pickPosition = Ellipsoid.WGS84.cartographicToCartesian(
          new Cartographic(
            CesiumMath.toRadians(longitude),
            CesiumMath.toRadians(latitude),
            0
          )
        );
        send();
      },
      /** In the UI, clicking a drawn point hands that entity back to us. */
      clickOnFirstPoint() {
        const firstPoint = userDrawing.pointEntities.entities.values[0];
        pickedFeatures.features = [firstPoint as TerriaFeature];
        pickedFeatures.pickPosition = firstPoint.position?.getValue(
          terria.timelineClock.currentTime
        );
        send();
      },
      polygons() {
        return userDrawing.otherEntities.entities.values.filter(
          (entity) => entity.name === USER_POLYGON
        );
      }
    };
  }

  it("polygon is only drawn once", function () {
    const userDrawing = new UserDrawing({ terria });
    userDrawing.enterDrawMode();
    const draw = drawingHarness(userDrawing, terria);

    // Three points around Parliament house
    draw.clickAt(149.121, -35.309);
    draw.clickAt(149.124, -35.311);
    draw.clickAt(149.127, -35.308);

    expect((userDrawing as any).closeLoop).toBeFalsy();
    expect(draw.polygons().length).toEqual(0);

    // Clicking the first point closes the shape.
    draw.clickOnFirstPoint();

    expect((userDrawing as any).closeLoop).toBeTruthy();
    expect(draw.polygons().length).toEqual(1);

    // Another point somewhere else. The shape stays closed and the polygon is
    // not drawn a second time.
    draw.clickAt(149.0, -35.0);

    expect((userDrawing as any).closeLoop).toBeTruthy();
    expect(draw.polygons().length).toEqual(1);
  });

  it("re-opens the shape when the first point is clicked again", function () {
    // Closing is a toggle in this build, so a mis-click can be undone.
    const userDrawing = new UserDrawing({ terria });
    userDrawing.enterDrawMode();
    const draw = drawingHarness(userDrawing, terria);

    draw.clickAt(149.121, -35.309);
    draw.clickAt(149.124, -35.311);
    draw.clickAt(149.127, -35.308);
    draw.clickOnFirstPoint();
    expect((userDrawing as any).closeLoop).toBeTruthy();

    draw.clickOnFirstPoint();

    expect((userDrawing as any).closeLoop).toBeFalsy();
    expect(draw.polygons().length).toEqual(0);
  });

  it("point is removed if it is clicked on and it is not the first point", function () {
    const options = { terria: terria };
    const userDrawing = new UserDrawing(options);
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    // First point
    // Points around Parliament house
    const pt1Position = new Cartographic(
      CesiumMath.toRadians(149.121),
      CesiumMath.toRadians(-35.309),
      CesiumMath.toRadians(0)
    );
    const pt1CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt1Position);
    pickedFeatures.pickPosition = pt1CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Second point
    const pt2Position = new Cartographic(
      CesiumMath.toRadians(149.124),
      CesiumMath.toRadians(-35.311),
      CesiumMath.toRadians(0)
    );
    const pt2CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt2Position);
    pickedFeatures.pickPosition = pt2CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Third point
    const pt3Position = new Cartographic(
      CesiumMath.toRadians(149.127),
      CesiumMath.toRadians(-35.308),
      CesiumMath.toRadians(0)
    );
    const pt3CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt3Position);
    pickedFeatures.pickPosition = pt3CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });
    expect((userDrawing as any).closeLoop).toBeFalsy();

    // Now pick the second point
    pickedFeatures.pickPosition = pt2CartesianPosition;
    // If in the UI the user clicks on a point, it returns that entity, so we're pulling it out of userDrawing and
    // pretending the user actually clicked on it.
    const pt2Entity = userDrawing.pointEntities.entities.values[1];
    pickedFeatures.features = [pt2Entity as TerriaFeature];
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect(userDrawing.pointEntities.entities.values.length).toEqual(2);
    expect(userDrawing.mapItems.length).toBe(2);
  });

  it("draws rectangle", function () {
    const userDrawing = new UserDrawing({
      terria,
      allowPolygon: false,
      drawRectangle: true
    });
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    // First point
    // Points around Parliament house
    const pt1Position = new Cartographic(
      CesiumMath.toRadians(149.121),
      CesiumMath.toRadians(-35.309),
      CesiumMath.toRadians(0)
    );
    const pt1CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt1Position);
    pickedFeatures.pickPosition = pt1CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect(userDrawing.pointEntities.entities.values.length).toEqual(1);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(1);

    let rectangle: Rectangle = userDrawing.otherEntities.entities
      .getById("rectangle")
      ?.rectangle?.coordinates?.getValue(terria.timelineClock.currentTime);

    expect(rectangle).toBeUndefined();

    // Second point
    const pt2Position = new Cartographic(
      CesiumMath.toRadians(149.124),
      CesiumMath.toRadians(-35.311),
      CesiumMath.toRadians(0)
    );
    const pt2CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt2Position);
    pickedFeatures.pickPosition = pt2CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    expect(userDrawing.pointEntities.entities.values.length).toEqual(2);
    expect(userDrawing.otherEntities.entities.values.length).toEqual(1);

    rectangle = userDrawing.otherEntities.entities
      .getById("rectangle")
      ?.rectangle?.coordinates?.getValue(terria.timelineClock.currentTime);

    expect(rectangle.east).toBeCloseTo(CesiumMath.toRadians(149.124));
    expect(rectangle.west).toBeCloseTo(CesiumMath.toRadians(149.121));
    expect(rectangle.north).toBeCloseTo(CesiumMath.toRadians(-35.309));
    expect(rectangle.south).toBeCloseTo(CesiumMath.toRadians(-35.311));

    expect(userDrawing.mapItems.length).toBe(1);
  });

  it("calls onDrawingComplete with the drawn points or rectangle", function () {
    let completedPoints: Cartesian3[] | undefined;
    let completedRectangle: Rectangle | undefined;
    const userDrawing = new UserDrawing({
      terria,
      allowPolygon: false,
      drawRectangle: true,
      onDrawingComplete: ({ points, rectangle }) => {
        completedPoints = points;
        completedRectangle = rectangle;
      }
    });
    userDrawing.enterDrawMode();
    const pickedFeatures = new PickedFeatures();

    // First point
    // Points around Parliament house
    const pt1Position = new Cartographic(
      CesiumMath.toRadians(149.121),
      CesiumMath.toRadians(-35.309),
      CesiumMath.toRadians(0)
    );
    const pt1CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt1Position);
    pickedFeatures.pickPosition = pt1CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Second point
    const pt2Position = new Cartographic(
      CesiumMath.toRadians(149.124),
      CesiumMath.toRadians(-35.311),
      CesiumMath.toRadians(0)
    );
    const pt2CartesianPosition =
      Ellipsoid.WGS84.cartographicToCartesian(pt2Position);
    pickedFeatures.pickPosition = pt2CartesianPosition;
    runInAction(() => {
      userDrawing.terria.mapInteractionModeStack[0].pickedFeatures =
        pickedFeatures;
    });

    // Check onDrawingComplete was called when we end the drawing.
    userDrawing.terria.mapInteractionModeStack[0].onCancel?.();
    expect(completedPoints).toBeDefined();
    if (completedPoints) {
      expect(completedPoints.length).toEqual(2);
    }
    expect(completedRectangle).toBeDefined();
  });
});
