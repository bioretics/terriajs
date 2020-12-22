"use strict";

/*global require*/
var URI = require("urijs");

var defined = require("terriajs-cesium/Source/Core/defined").default;

var Color = require("terriajs-cesium/Source/Core/Color").default;
const HeightReference = require("terriajs-cesium/Source/Scene/HeightReference")
  .default;
const Cartesian2 = require("terriajs-cesium/Source/Core/Cartesian2").default;
const Cartesian3 = require("terriajs-cesium/Source/Core/Cartesian3").default;
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

  this._geoJsonItem = undefined;

  this._changed = new CesiumEvent();

  this.LEVEL_MIN = 7;
  this.LEVEL_MAX = 16;
  this.level = this.LEVEL_MIN;
  this.oldLevel = this.LEVEL_MIN;

  this.bbox = new Rectangle();
  //this.pitchIsLow = false;
  this.PITCH_LOW_THRESHOLD = -CesiumMath.PI_OVER_SIX;
  this.PITCH_VERYLOW_THRESHOLD = -CesiumMath.PI_OVER_SIX / 3;
  //this.LOW_BBOX_MODIFIER = 0.10;
  //this.VERYLOW_BBOX_MODIFIER = 0.05;
  this.ENLARGE_RECT = 0.01;
  this.ENLARGE_ALTITUDE_MOD = 5;

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

  this._geoJsonItem.style = {"marker-size": "medium"};

  this._geoJsonItem.data = loadGeoJson(this);

  return that._geoJsonItem.load();
  /*return that._geoJsonItem.load().then(function() {
    // remove then?

    //if(that.terria.cesium) {
    //  const camera = that.terria.cesium.scene.camera;
    //  that._geoJsonItem.filter(camera.positionWC, that.pitchIsLow);
    //}
  });*/
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

    //
    if(this.terria.currentViewer.terria.cesium) {
      var that = this;

      this.removeMoveEndEventListener = this.terria.currentViewer.terria.cesium.viewer.scene.camera.moveEnd.addEventListener(function() {
        let newBBox = undefined;
        let levelCorrection = 0;

        const scene = that.terria.cesium.scene;
        const camera = scene.camera;
        const globe = scene.globe;
        
        const cameraPos = camera.positionWC;
        const pickRay = camera.getPickRay(new Cartesian2(cameraPos[0], cameraPos[1]));
        const pickedTriangle = globe.pickTriangle(pickRay, scene);
        
        if(camera.pitch >= that.PITCH_LOW_THRESHOLD) {
          //that.pitchIsLow = true;
          //levelCorrection = camera.pitch >= that.PITCH_VERYLOW_THRESHOLD ? 3 : 2;
          const altitude = camera.positionCartographic.height;

          const pos1 = new Cartesian3(
            cameraPos.x - altitude * that.ENLARGE_ALTITUDE_MOD,
            cameraPos.y - altitude * that.ENLARGE_ALTITUDE_MOD,
            cameraPos.z
          );
          const pos2 = new Cartesian3(
            cameraPos.x + altitude * that.ENLARGE_ALTITUDE_MOD,
            cameraPos.y + altitude * that.ENLARGE_ALTITUDE_MOD,
            cameraPos.z
          );
          newBBox = Rectangle.fromCartesianArray([pos1, pos2], globe.ellipsoid);
        }
        else {
          //that.pitchIsLow = false;

          const viewRect = camera.computeViewRectangle(globe.ellipsoid);

          newBBox = new Rectangle(
            viewRect.west - viewRect.width * that.ENLARGE_RECT,
            viewRect.south - viewRect.height * that.ENLARGE_RECT,
            viewRect.east + viewRect.width * that.ENLARGE_RECT,
            viewRect.north + viewRect.height * that.ENLARGE_RECT
          );
        }

        if(typeof pickedTriangle !== "undefined") {
          let tmpLevel = pickedTriangle.tile.level;
          if(tmpLevel < that.LEVEL_MIN) {
            tmpLevel = that.LEVEL_MIN;
          }
          else if(tmpLevel > that.LEVEL_MAX) {
            tmpLevel = that.LEVEL_MAX;
          }
          if(tmpLevel != that.level || !newBBox.equals(that.bbox)) {
            that.level = tmpLevel + levelCorrection;
            that.bbox = newBBox;
            that._load();
          }
        }
        else {
          that.bbox = newBBox;
          that._load();
        }
      });

      if(that._geoJsonItem && that._geoJsonItem.dataSource) {
        let pinBuilder = new PinBuilder();
        let pin10 = pinBuilder.fromText("10+", Color.RED, 48).toDataURL();
        let pin20 = pinBuilder.fromText("20+", Color.ORANGE, 48).toDataURL();
        let pin30 = pinBuilder.fromText("30+", Color.YELLOW, 48).toDataURL();
        let pin40 = pinBuilder.fromText("40+", Color.GREEN, 48).toDataURL();
        let pin50 = pinBuilder.fromText("50+", Color.BLUE, 48).toDataURL();

        this.removeClusterEventListener = that._geoJsonItem.dataSource.clustering.clusterEvent.addEventListener(function(entities, cluster) {
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
        that._geoJsonItem.dataSource.clustering.pixelRange = 120;
        that._geoJsonItem.dataSource.clustering.minimumClusterSize = 9;
      }
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

function loadGeoJson(item) {
  return loadJson(buildGeoJsonUrl(item)).then(function(json) {
    var jsonRes = featureDataToGeoJson(json);

    console.log("RerFeatureServerCatalogItem RELOAD: level = " + item.level + "; bbox = " + item.bbox.toString() + "; features = " + jsonRes.features.length);

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
  var url = cleanAndProxyUrl(item, item.url);

  var url = new URI(url)
    .segment("query")
    .addQuery(
      "where", "Level_ID<=" + item.level.toString()
    )
    .addQuery(
      "geometry", CesiumMath.toDegrees(item.bbox.west) + "," + CesiumMath.toDegrees(item.bbox.south) + "," + CesiumMath.toDegrees(item.bbox.east) + "," + CesiumMath.toDegrees(item.bbox.north)
    )
    .addQuery(
      "geometryType", "esriGeometryEnvelope"
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
