"use strict";

/*global require*/
var URI = require("urijs");

var defined = require("terriajs-cesium/Source/Core/defined");
var defineProperties = require("terriajs-cesium/Source/Core/defineProperties");
var loadJson = require("../Core/loadJson");

var CatalogItem = require("./CatalogItem");
var featureDataToGeoJson = require("../Map/featureDataToGeoJson");
var GeoJsonCatalogItem = require("./GeoJsonCatalogItem");
var inherit = require("../Core/inherit");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");

var Cartesian2 = require("terriajs-cesium/Source/Core/Cartesian2");
//const selectionIndicatorUrl = require("../../wwwroot/images/NM-LocationTarget.svg");
var CesiumEvent = require("terriajs-cesium/Source/Core/Event");


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

  this.removeMoveEndEventListener = undefined;
};

inherit(CatalogItem, RerFeatureServerCatalogItem);

defineProperties(RerFeatureServerCatalogItem.prototype, {
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
  if(typeof this._geoJsonItem === "undefined")
    this._geoJsonItem = new GeoJsonCatalogItem(this.terria);

  //this._geoJsonItem.style = {"marker-symbol": selectionIndicatorUrl};

  this._geoJsonItem.data = loadGeoJson(this);

  return that._geoJsonItem.load().then(function() {
    // remove then?
  });
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
        const scene = that.terria.cesium.scene;
        const camera = scene.camera;
        const position = new Cartesian2(camera.positionWC[0], camera.positionWC[1]);

        const pickRay = camera.getPickRay(position);
        
        const globe = scene.globe;
        const pickedTriangle = globe.pickTriangle(pickRay, scene);
        if(typeof pickedTriangle !== "undefined"
        && pickedTriangle.tile.level != that.level
        && pickedTriangle.tile.level >= that.LEVEL_MIN
        && pickedTriangle.tile.level <= that.LEVEL_MAX
        && ((pickedTriangle.tile.level < that.level && pickedTriangle.tile.level < that.level - 1) || pickedTriangle.tile.level > that.level)) {
          that.level = pickedTriangle.tile.level;
          that._load();
          that._changed.raiseEvent(that);
        }
      });
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
    jsonRes.features.forEach(elem => {      
      if(elem.properties["LEVEL_ID"] >= 10) {
        elem.properties["marker-symbol"] = "rocket";
      }
      /*else{
        console.log(elem);
      }*/
    });
    return jsonRes
  });
}

function buildGeoJsonUrl(item) {
  var url = cleanAndProxyUrl(item, item.url);
  var urlComponents = splitLayerIdFromPath(url);

  return new URI(url)
    .segment("query")
    .addQuery(
      "where", "Level_ID<=" + item.level.toString()
    )
    /*.addQuery(
      "geometry", 
    )*/
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
