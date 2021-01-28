"use strict";

/*global require*/
var URI = require("urijs");

var defined = require("terriajs-cesium/Source/Core/defined").default;

var Color = require("terriajs-cesium/Source/Core/Color").default;
const HeightReference = require("terriajs-cesium/Source/Scene/HeightReference")
  .default;
const Cartesian2 = require("terriajs-cesium/Source/Core/Cartesian2").default;
const Cartesian3 = require("terriajs-cesium/Source/Core/Cartesian3").default;
const Cartographic = require("terriajs-cesium/Source/Core/Cartographic").default;
const Ellipsoid = require("terriajs-cesium/Source/Core/Ellipsoid").default;
var loadJson = require("../Core/loadJson");

var CatalogItem = require("./CatalogItem");
var featureDataToGeoJson = require("../Map/featureDataToGeoJson");
var RerGeoJsonCatalogItem = require("./RerGeoJsonCatalogItem");
var inherit = require("../Core/inherit");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var i18next = require("i18next").default;

var CesiumEvent = require("terriajs-cesium/Source/Core/Event").default;
var CesiumMath = require("terriajs-cesium/Source/Core/Math").default;
var Rectangle = require("terriajs-cesium/Source/Core/Rectangle").default;
var PinBuilder = require("terriajs-cesium/Source/Core/PinBuilder").default;

const VerticalOrigin = require("terriajs-cesium/Source/Scene/VerticalOrigin")
  .default;

var NearFarScalar = require("terriajs-cesium/Source/Core/NearFarScalar").default;
var DistanceDisplayCondition = require("terriajs-cesium/Source/Core/DistanceDisplayCondition").default;

//const circleToPolygon = require('circle-to-polygon');



/**
 * A {@link CatalogItem} representing a layer from an Esri ArcGIS FeatureServer.
 *
 * @alias RerFeatureServerCatalogItem
 * @constructor
 * @extends CatalogItem
 *
 * @param {Terria} terria The Terria instance.
 */
var RerFeatureServerCatalogItem = function(terria) {
  CatalogItem.call(this, terria);

  /**
   * 
   * @type {Number}
   */
  this.lowPitchThreshold = -CesiumMath.PI_OVER_SIX;

  /**
   * 
   * @type {Number}
   */
  this.verylowPitchThreshold = -CesiumMath.PI_OVER_SIX / 2;

  /**
   * 
   * @type {Number}
   */
  this.lowPitchFirstHeightSplit = 0.33;

  /**
   * 
   * @type {Number}
   */
  this.verylowPitchFirstHeightSplit = 0.50;

  /**
   * 
   * @type {Boolean}
   */
  this.hideFeaturesOnVeryLowPitch = false;

  /**
   * 
   * @type {Number}
   */
  this.showOnlyNearestFeatures = 0;

  /**
   * 
   * @type {Boolean}
   */
  this.filterFeaturesByDistance = true;

  /**
   * 
   * @type {Array}
   */
  this.filterDistances = [];

  /**
   * 
   * @type {Boolean}
   */
  this.cacheFeatures = true;

  /**
   * 
   * @type {String}
   */
  this.labelFont = "16px Helvetica";

  /**
   * 
   * @type {String}
   */
  this.labelFillColor = "white";

  /**
   * 
   * @type {String}
   */
  this.backgroundColor = "transparent";

  
  this._geoJsonItem = undefined;

  this._changed = new CesiumEvent();

  this.PITCH_HIGH = 0;
  this.PITCH_LOW = 1;
  this.PITCH_VERY_LOW = 2;
  this.LEVEL_MIN = 7;
  this.LEVEL_MAX = 16;

  this.heightRay = 20;

  this.level = 0;
  this.oldLevel = 0;
  this.oldHeight = 0;

  this.bbox = new Rectangle();
  this.polygon = undefined;

  this.cameraPitch = this.PITCH_HIGH;

  this.removeMoveEndEventListener = undefined;
  this.removeClusterEventListener = undefined;
};

inherit(CatalogItem, RerFeatureServerCatalogItem);

Object.defineProperties(RerFeatureServerCatalogItem.prototype, {
  /**
   * Gets the type of data item represented by this instance.
   * @memberOf RerFeatureServerCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "rer-featureServer";
    }
  },

  /**
   * Gets a human-readable name for this type of data source.
   * @memberOf RerFeatureServerCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return "RER Feature Server";
    }
  },

  /**
   * Gets the set of functions used to update individual properties in {@link CatalogMember#updateFromJson}.
   * When a property name in the returned object literal matches the name of a property on this instance, the value
   * will be called as a function and passed a reference to this instance, a reference to the source JSON object
   * literal, and the name of the property.
   * @memberOf RerFeatureServerCatalogItem.prototype
   * @type {Object}
   */
  updaters: {
    get: function() {
      return RerFeatureServerCatalogItem.defaultUpdaters;
    }
  },

  /**
   * Gets the set of functions used to serialize individual properties in {@link CatalogMember#serializeToJson}.
   * When a property name on the model matches the name of a property in the serializers object lieral,
   * the value will be called as a function and passed a reference to the model, a reference to the destination
   * JSON object literal, and the name of the property.
   * @memberOf RerFeatureServerCatalogItem.prototype
   * @type {Object}
   */
  serializers: {
    get: function() {
      return RerFeatureServerCatalogItem.defaultSerializers;
    }
  },
  /**
   * Gets the data source associated with this catalog item.
   * @memberOf RerFeatureServerCatalogItem.prototype
   * @type {DataSource}
   */
  dataSource: {
    get: function() {
      return defined(this._geoJsonItem)
        ? this._geoJsonItem.dataSource
        : undefined;
    }
  },

  changedEvent: {
    get: function() {
      return this._changed;
    }
  }
});

RerFeatureServerCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.layerDef];
};

RerFeatureServerCatalogItem.prototype._load = function() {
  var that = this;
  if(typeof this._geoJsonItem === "undefined") {
    this._geoJsonItem = new RerGeoJsonCatalogItem(this.terria);
  }

  this._geoJsonItem.level = this.level;
  this._geoJsonItem.cameraPitch = this.cameraPitch;
  
  this._geoJsonItem.filterDistances = this.filterDistances;
  this._geoJsonItem.filterFeaturesByDistance = this.filterFeaturesByDistance;
  this._geoJsonItem.showOnlyNearestFeatures = this.showOnlyNearestFeatures;
  this._geoJsonItem.hideFeaturesOnVeryLowPitch = this.hideFeaturesOnVeryLowPitch;
  this._geoJsonItem.cacheFeatures = this.cacheFeatures;
  this._geoJsonItem.labelFont = this.labelFont;
  this._geoJsonItem.labelFillColor = this.labelFillColor;
  this._geoJsonItem.backgroundColor = this.backgroundColor;

  this._geoJsonItem.style = {"marker-size": "medium"};

  this._geoJsonItem.data = loadGeoJson(this);

  return that._geoJsonItem.load();
};

RerFeatureServerCatalogItem.prototype._enable = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._enable();
  }
};

RerFeatureServerCatalogItem.prototype._disable = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._disable();
  }
};

RerFeatureServerCatalogItem.prototype._show = function() {  
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._show();

    if(this.terria.cesium) {
      var that = this;

      this.removeMoveEndEventListener = this.terria.cesium.viewer.scene.camera.moveEnd.addEventListener(function() {
        checkReload(that);
      });

      checkReload(this);

      /*if(that._geoJsonItem && that._geoJsonItem.dataSource) {
        let pinBuilder = new PinBuilder();
        let pin10 = pinBuilder.fromText("10+", Color.RED, 48).toDataURL();
        let pin20 = pinBuilder.fromText("20+", Color.ORANGE, 48).toDataURL();
        let pin30 = pinBuilder.fromText("30+", Color.YELLOW, 48).toDataURL();
        let pin40 = pinBuilder.fromText("40+", Color.GREEN, 48).toDataURL();
        let pin50 = pinBuilder.fromText("50+", Color.BLUE, 48).toDataURL();*/

        /*this.removeClusterEventListener = that._geoJsonItem.dataSource.clustering.clusterEvent.addEventListener(function(entities, cluster) {
          //cluster.label.show = true;
          //cluster.label.text = entities.length.toLocaleString();

          cluster.label.show = false;
          cluster.billboard.show = true;
          //cluster.billboard.id = cluster.label.id;
          cluster.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
          if(entities.length < 20)
            cluster.billboard.image = pin10;
          else if(entities.length < 30)
            cluster.billboard.image = pin20;
          else if(entities.length < 40)
            cluster.billboard.image = pin30;
          else if(entities.length < 50)
            cluster.billboard.image = pin40;
          else
            cluster.billboard.image = pin50;
        });
        that._geoJsonItem.dataSource.clustering.enabled = true;
        that._geoJsonItem.dataSource.clustering.pixelRange = 90;
        that._geoJsonItem.dataSource.clustering.minimumClusterSize = 5;
      }*/
    }
  }
};

RerFeatureServerCatalogItem.prototype._hide = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._hide();

    //
    if(this.terria.currentViewer.terria.cesium && typeof this.removeMoveEndEventListener !== 'undefined') {
      this.removeMoveEndEventListener();
    }
  }
};

RerFeatureServerCatalogItem.prototype.showOnSeparateMap = function(
  globeOrMap
) {
  if (defined(this._geoJsonItem)) {
    return this._geoJsonItem.showOnSeparateMap(globeOrMap);
  }
};

function getRayPosition(x, y, scene) {
  const ray = scene.camera.getPickRay(new Cartesian2(x, y));
  return scene.globe.pick(ray, scene);
}

function checkReload(item) {
  const scene = item.terria.cesium.scene;
  const camera = scene.camera;
  const globe = scene.globe;
  const canvas = scene.canvas;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  let changed = false;

  if(camera.positionCartographic.height !== item.oldHeight) {
    // compute map scale
    const pixelDimension = camera.frustum.getPixelDimensions(scene.drawingBufferWidth, scene.drawingBufferHeight, 1.0, scene.pixelRatio, new Cartesian2());
    const pxHalfCm = 0.05 / parseFloat(pixelDimension.x);
    const aPos = getRayPosition(width * 0.5 - pxHalfCm, height - item.heightRay, scene);
    if(typeof aPos === 'undefined')
      return;
    const bPos = getRayPosition(width * 0.5 + pxHalfCm, height - item.heightRay, scene);
    if(typeof bPos === 'undefined')
      return;
    let scaleDivider = Cartesian2.distance(Cartesian2.fromCartesian3(aPos), Cartesian2.fromCartesian3(bPos));
    let scale = 22.56994;
    let level;
    for(level = 19; level > item.LEVEL_MIN && scaleDivider > scale; --level) {
      scale *= 2;
    }
    item.oldHeight = camera.positionCartographic.height;
    if(level > item.LEVEL_MAX)
      level = item.LEVEL_MAX;
      if(item.level !== level /*&& level >= item.LEVEL_MIN*/) {
        item.level = level;
        changed = true;
    }
  }

  /*const cameraPos = camera.positionWC;
  const pickRay = camera.getPickRay(new Cartesian2(cameraPos[0], cameraPos[1]));
  const pickedTriangle = globe.pickTriangle(pickRay, scene);*/
  
  /*if(!changed || Math.abs(item.level - item.oldLevel) > 1)*/ {
    if(camera.pitch >= item.lowPitchThreshold) {
      item.cameraPitch = item.PITCH_LOW;
      //let polygonHeight = item.lowPitchFirstHeightSplit;

      if(camera.pitch >= item.verylowPitchThreshold) {
        if(item.hideFeaturesOnVeryLowPitch) {
          return;
        }
        item.cameraPitch = item.PITCH_VERY_LOW;
        //polygonHeight = item.verylowPitchFirstHeightSplit;
      }

      let polygonHeightPerc = 0.05;
      let pos1 = getRayPosition(1, height * polygonHeightPerc, scene);
      while(typeof pos1 === 'undefined' && polygonHeightPerc < 0.6) {
        polygonHeightPerc += 0.1;
        pos1 = getRayPosition(1, height * polygonHeightPerc, scene);
      }
      if(typeof pos1 === 'undefined') {
        return;
      }

      let pos2 = getRayPosition(width - 1, height * polygonHeightPerc, scene);
      while(typeof pos2 === 'undefined' && polygonHeightPerc < 0.6) {
        polygonHeightPerc += 0.1;
        pos2 = getRayPosition(width - 1, height * polygonHeightPerc, scene);
      }
      if(typeof pos2 === 'undefined') {
        return;
      }

      let pos3 = getRayPosition(width - 1, height - 1, scene);
      let pos4 = getRayPosition(1, height - 1, scene);
      //
      /*item.secondPol = undefined;
      const ray5 = camera.getPickRay(new Cartesian2(width - 1, 1));
      const pos5 = globe.pick(ray5, scene);
      if(typeof pos5 !== 'undefined') {
        const ray6 = camera.getPickRay(new Cartesian2(1, 1));
        const pos6 = globe.pick(ray6, scene);
        if(typeof pos6 !== 'undefined') {
          item.secondPol = Ellipsoid.WGS84.cartesianArrayToCartographicArray([pos1, pos2, pos5, pos6]);
        }
      }*/

      const newPolygon = Ellipsoid.WGS84.cartesianArrayToCartographicArray([pos1, pos2, pos3, pos4]);

      if(JSON.stringify(item.polygon) !== JSON.stringify(newPolygon)) {
        item.polygon = newPolygon;
        changed = true;
      }
    }
    else {
      item.cameraPitch = item.PITCH_HIGH;
      const newRect = camera.computeViewRectangle(globe.ellipsoid);
      if(!item.bbox.equalsEpsilon(newRect, newRect.width * 0.03)) {
        item.bbox = newRect;
        changed = true;
      }
    }
  }

  if(changed) {
    item._load();
  }
}

function loadGeoJson(item) {
  return loadJson(buildGeoJsonUrl(item)).then(function(json) {
    var jsonRes = featureDataToGeoJson(json);

    jsonRes.features.forEach(elem => {
      switch(elem.properties["ID_DOMINIO"]) {
        case 1:
          // centro abitato
          elem.properties["marker-symbol"] = "village";
          break;
        case 2:
          // nucleo abitato
          elem.properties["marker-symbol"] = "village";
          break;
        case 3:
          // località produttiva
          elem.properties["marker-symbol"] = "industrial";
          break;
        case 4:
          // frazione
          elem.properties["marker-symbol"] = "village";
          elem.properties["marker-color"] = "#ff0";
          break;
        case 5:
          // case sparse
          elem.properties["marker-symbol"] = "village";
          elem.properties["marker-color"] = "#333";
          break;
        case 6:
          // località minori
          elem.properties["marker-symbol"] = "village";
          elem.properties["marker-color"] = "#fff";
          break;
        case 7:
          // capoluogo
          elem.properties["marker-symbol"] = "square";
          break;
        case 8:
          // croce
          elem.properties["marker-symbol"] = "cross";
          break;
        case 9:
          // monte
          elem.properties["marker-symbol"] = "mountain";
          break;
        case 10:
          // passo o valico
          elem.properties["marker-symbol"] = "triangle";
          break;
        case 11:
          // poggio
          elem.properties["marker-symbol"] = "triangle-stroked";
          break;
        case 12:
          // groppo
          elem.properties["marker-symbol"] = "marker";
          break;
        case 13:
          // sorgente
          elem.properties["marker-symbol"] = "water";
          break;
        case 14:
          // lago
          elem.properties["marker-symbol"] = "water";
          break;
        case 15:
          // grotta
          elem.properties["marker-symbol"] = "marker";
          break;
        case 16:
          // fonte
          elem.properties["marker-symbol"] = "water";
          break;
        case 17:
          // fontana
          elem.properties["marker-symbol"] = "water";
          break;
        case 18:
          // cascata
          elem.properties["marker-symbol"] = "water";
          break;
        case 19:
          // foce
          elem.properties["marker-symbol"] = "marker";
          break;
        case 20:
          // bacino
          elem.properties["marker-symbol"] = "marker";
          break;
        case 21:
          //torbiera
          elem.properties["marker-symbol"] = "marker";
          break;
        case 22:
          // vasca
          elem.properties["marker-symbol"] = "marker";
          break;
        case 23:
          // laghetto
          elem.properties["marker-symbol"] = "water";
          break;
        case 24:
          // spiazzo
          elem.properties["marker-symbol"] = "marker";
          break;
        case 601:
          // capoluogo comunale
          elem.properties["marker-symbol"] = "town";
          break;
        case 602:
          // capoluogo provinciale
          elem.properties["marker-symbol"] = "city";
          break;
        case 603:
          // capoluogo regionale
          elem.properties["marker-symbol"] = "city";
          break;
      }
    });
    return jsonRes
  });
}

function buildGeoJsonUrl(item) {
  //var url = cleanAndProxyUrl(item, item.url);
  var url = new URI(cleanAndProxyUrl(item, item.url))
    .segment("query")
    .addQuery(
      "where", "Level_ID<=" + item.level.toString()
    )
    .addQuery(
      "geometry", item.cameraPitch > 0 && typeof item.polygon !== 'undefined' && item.polygon.length > 0 ?
        JSON.stringify({rings: [[
          [CesiumMath.toDegrees(item.polygon[0].longitude), CesiumMath.toDegrees(item.polygon[0].latitude)],
          [CesiumMath.toDegrees(item.polygon[1].longitude), CesiumMath.toDegrees(item.polygon[1].latitude)],
          [CesiumMath.toDegrees(item.polygon[2].longitude), CesiumMath.toDegrees(item.polygon[2].latitude)],
          [CesiumMath.toDegrees(item.polygon[3].longitude), CesiumMath.toDegrees(item.polygon[3].latitude)]
        ]]}) :
        CesiumMath.toDegrees(item.bbox.west) + "," + CesiumMath.toDegrees(item.bbox.south) + "," + CesiumMath.toDegrees(item.bbox.east) + "," + CesiumMath.toDegrees(item.bbox.north)
    )
    .addQuery(
      "geometryType", item.cameraPitch > 0 ? "esriGeometryPolygon" : "esriGeometryEnvelope"
    )
    .addQuery(
      "spatialRel", "esriSpatialRelIndexIntersects"
    )
    .addQuery(
      "outFields", "*"
    )
    .addQuery(
      "returnGeometry", "true"
    )
    .addQuery("f", "geojson")
    .toString();

    return url;
}

function splitLayerIdFromPath(url) {
  var regex = /^(.*)\/(\d+)$/;
  var matches = url.match(regex);
  if (defined(matches) && matches.length > 2) {
    return {
      layerId: matches[2],
      urlWithoutLayerId: matches[1]
    };
  }
  return {
    urlWithoutLayerId: url
  };
}

function cleanAndProxyUrl(catalogItem, url) {
  return proxyCatalogItemUrl(catalogItem, cleanUrl(url));
}

function cleanUrl(url) {
  // Strip off the search portion of the URL
  var uri = new URI(url);
  uri.search("");
  return uri.toString();
}

module.exports = RerFeatureServerCatalogItem;
