import defined from "terriajs-cesium/Source/Core/defined";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import CustomDataSource from "terriajs-cesium/Source/DataSources/CustomDataSource";
import L from "../LeafletPatched";

/**
 * Callback for when a point is moved.
 * @callback PointMovedCallback
 * @param {CustomDataSource} customDataSource Contains all point entities that user has selected so far
 */

/**
 * For letting user drag existing points in Leaflet ViewerMode only.
 *
 * @alias LeafletDragPoints
 * @constructor
 *
 * @param {Terria} terria The Terria instance.
 * @param {PointMovedCallback} pointMovedCallback A function that is called when a point is moved.
 */
const LeafletDragPoints = function (terria, pointMovedCallback) {
  this._terria = terria;
  this._setUp = false;
  this.type = "Leaflet";

  /**
   * Callback that occurs when point is moved. Function takes a CustomDataSource which is a list of PointEntities.
   * @type {PointMovedCallback}
   * @default undefined
   */
  this._pointMovedCallback = pointMovedCallback;

  /**
   * List of entities that can be dragged, which is populated with user-created points only.
   * @type {CustomDataSource}
   */
  this._draggableObjects = new CustomDataSource();

  /**
   * Whether user is currently dragging point.
   * @type {Boolean}
   */
  this._dragInProgress = false;

  /**
   * For determining whether a drag has just occurred, to avoid deleting a point at the end of the drag.
   * @type {Number}
   */
  this.dragCount = 0;
};

/**
 * Set up the drag point helper so that attempting to drag a point will move the point.
 */
LeafletDragPoints.prototype.setUp = function () {
  if (this._setUp) {
    return;
  }
  if (!defined(this._terria.leaflet) || !defined(this._terria.leaflet.map)) {
    // Test context or something has gone *so* badly wrong
    return;
  }
  this._terria.leaflet.scene.featureMousedown.addEventListener(
    this._onMouseDownOnPoint,
    this
  );
  this._setUp = true;
};

/**
 * Function that is called when the user clicks and holds on a point that was previously drawn.
 *
 * @param {Entity} entity The entity that user mouse downs on.
 * @param {Leaflet.MouseEvent} [event] The Leaflet mouse event.
 */
LeafletDragPoints.prototype._onMouseDownOnPoint = function (entity, event) {
  if (
    !defined(this._draggableObjects.entities) ||
    this._draggableObjects.entities.values.length === 0
  ) {
    return;
  }

  var dragEntity = this._draggableObjects.entities.values.filter(
    function (dragObjEntity) {
      // Not necessarily same entity, but will have same id.
      return dragObjEntity.id === entity.id;
    }
  )[0];
  if (defined(dragEntity)) {
    // Billboard points are rendered as <img> markers. Without preventing the
    // default, the browser starts a native image-drag and map mousemove/mouseup
    // never drive the point. Mirror Leaflet.Draggable: stop the event, disable
    // image drag, and track the pointer on document.
    if (defined(event) && defined(event.originalEvent)) {
      L.DomEvent.preventDefault(event.originalEvent);
      L.DomEvent.stopPropagation(event.originalEvent);
    }
    L.DomUtil.disableImageDrag();
    L.DomUtil.disableTextSelection();

    L.DomEvent.on(document, "mousemove", this._onMouseMove, this);
    L.DomEvent.on(document, "touchmove", this._onMouseMove, this);
    L.DomEvent.on(document, "mouseup", this._onMouseUp, this);
    L.DomEvent.on(document, "touchend", this._onMouseUp, this);

    this._dragInProgress = true;
    this._entityDragged = dragEntity;

    this._terria.currentViewer.pauseMapInteraction();
    this._originalPosition = dragEntity.position.getValue(
      this._terria.timelineClock.currentTime
    );
  }
};

/**
 * Function that is called when the mouse moves.
 *
 * @param {MouseEvent|TouchEvent|Leaflet.MouseEvent} move Information about the move.
 */
LeafletDragPoints.prototype._onMouseMove = function (move) {
  if (!this._dragInProgress) {
    return;
  }
  this.dragCount = this.dragCount + 1;
  if (defined(this._entityDragged)) {
    const map = this._terria.leaflet.map;
    const nativeEvent = move.touches
      ? move.touches[0]
      : move.originalEvent || move;
    const latlng = move.latlng || map.mouseEventToLatLng(nativeEvent);
    this._entityDragged.position = Cartesian3.fromDegrees(
      latlng.lng,
      latlng.lat
    );
  }
};

/**
 * Function that is called when the user releases the mousedown click.
 *
 * @param {Leaflet.MouseEvent} e Information about where the event occurred.
 */
LeafletDragPoints.prototype._onMouseUp = function (_e) {
  const currentPosition = defined(this._entityDragged)
    ? this._entityDragged.position.getValue(
        this._terria.timelineClock.currentTime
      )
    : undefined;

  if (
    this._dragInProgress &&
    !Cartesian3.equals(currentPosition, this._originalPosition)
  ) {
    this._pointMovedCallback(this._draggableObjects);
  }
  L.DomEvent.off(document, "mousemove", this._onMouseMove, this);
  L.DomEvent.off(document, "touchmove", this._onMouseMove, this);
  L.DomEvent.off(document, "mouseup", this._onMouseUp, this);
  L.DomEvent.off(document, "touchend", this._onMouseUp, this);
  L.DomUtil.enableImageDrag();
  L.DomUtil.enableTextSelection();
  this._dragInProgress = false;
  this._terria.currentViewer.resumeMapInteraction();
};

/**
 * Update the list of draggable objects with a new list of entities that are able to be dragged. We are only interested
 * in entities that the user has drawn.
 *
 * @param {CustomDataSource} entities Entities that user has drawn on the map.
 */
LeafletDragPoints.prototype.updateDraggableObjects = function (entities) {
  this._draggableObjects = entities;
};

/**
 * A clean up function to call when destroying the object.
 */
LeafletDragPoints.prototype.destroy = function () {
  if (this._dragInProgress) {
    this._onMouseUp();
  }
  if (
    this._setUp &&
    defined(this._terria.leaflet) &&
    defined(this._terria.leaflet.scene)
  ) {
    this._terria.leaflet.scene.featureMousedown.removeEventListener(
      this._onMouseDownOnPoint,
      this
    );
  }
  this._setUp = false;
};

export default LeafletDragPoints;
