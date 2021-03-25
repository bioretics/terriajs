"use strict";

/*global require*/
var toGeoJSON = require("@mapbox/togeojson");

var defined = require("terriajs-cesium/Source/Core/defined").default;

var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var when = require("terriajs-cesium/Source/ThirdParty/when").default;

var Metadata = require("./Metadata");
var TerriaError = require("../Core/TerriaError");
var CatalogItem = require("./CatalogItem");
var inherit = require("../Core/inherit");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");

var GeoJsonCatalogItem = require("./GeoJsonCatalogItem");
var readText = require("../Core/readText");
var loadText = require("../Core/loadText");
var i18next = require("i18next").default;

var Cartographic = require("terriajs-cesium/Source/Core/Cartographic").default;
var EllipsoidGeodesic = require("terriajs-cesium/Source/Core/EllipsoidGeodesic").default;
const sampleTerrainMostDetailed = require('terriajs-cesium/Source/Core/sampleTerrainMostDetailed.js').default;

const PathTypes = {
  noPath: 0,
  featureCollectionLineString: 1,
  featureCollectionMultiLineString: 2,
  lineString: 3,
  multiLineString: 4,
  //geometryCollection: 5
}

/**
 * A {@link CatalogItem} representing GPX data.
 *
 * @alias GpxCatalogItem
 * @constructor
 * @extends GeoJsonCatalogItem
 *
 * @param {Terria} terria The Terria instance.
 * @param {String} [url] The URL from which to retrieve the GPX data.
 */
var GpxCatalogItem = function(terria, url) {
  CatalogItem.call(this, terria);

  this._geoJsonItem = undefined;

  this.url = url;

  /**
   * Gets or sets the Gpx data, represented as a binary Blob, DOM Document, or a Promise for one of those things.
   * If this property is set, {@link CatalogItem#url} is ignored.
   * This property is observable.
   * @type {Blob|Document|Promise}
   */
  this.data = undefined;

  /**
   * Gets or sets the URL from which the {@link GpxCatalogItem#data} was obtained.  This may be used
   * to resolve any resources linked in the Gpx file, if any.
   * @type {String}
   */
  this.dataSourceUrl = undefined;

  knockout.track(this, ["data", "dataSourceUrl"]);
};

inherit(CatalogItem, GpxCatalogItem);

Object.defineProperties(GpxCatalogItem.prototype, {
  /**
   * Gets the type of data member represented by this instance.
   * @memberOf GpxCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "gpx";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'GPX'.
   * @memberOf GpxCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.gpx.name");
    }
  },

  /**
   * Gets the metadata associated with this data source and the server that provided it, if applicable.
   * @memberOf GpxCatalogItem.prototype
   * @type {Metadata}
   */
  metadata: {
    get: function() {
      var result = new Metadata();
      result.isLoading = false;
      result.dataSourceErrorMessage = i18next.t(
        "models.gpx.dataSourceErrorMessage"
      );
      result.serviceErrorMessage = i18next.t("models.gpx.serviceErrorMessage");
      return result;
    }
  },
  /**
   * Gets the data source associated with this catalog item.
   * @memberOf GpxCatalogItem.prototype
   * @type {DataSource}
   */
  dataSource: {
    get: function() {
      return defined(this._geoJsonItem)
        ? this._geoJsonItem.dataSource
        : undefined;
    }
  },


  canZoomTo: {
    get: function() {
      return true;
    }
  }
});

GpxCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.data];
};

GpxCatalogItem.prototype._load = function() {
  this._geoJsonItem = new GeoJsonCatalogItem(this.terria);

  var that = this;

  if (defined(that.data)) {
    return when(that.data, function(data) {
      var promise;
      if (data instanceof Blob) {
        promise = readText(data);
      } else {
        promise = data;
      }

      return when(promise, function(text) {
        return loadGpxText(that, text);
      });
    });
  } else {
    return loadText(proxyCatalogItemUrl(that, that.url, "1d"))
      .then(function(text) {
        return loadGpxText(that, text);
      })
      .otherwise(function() {
        errorLoading(that);
      });
  }
};

GpxCatalogItem.prototype._enable = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._enable();
  }
};

GpxCatalogItem.prototype._disable = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._disable();
  }
};

GpxCatalogItem.prototype._show = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._show();
  }
};

GpxCatalogItem.prototype._hide = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem._hide();
  }
};

GpxCatalogItem.prototype.showOnSeparateMap = function(globeOrMap) {
  if (defined(this._geoJsonItem)) {
    return this._geoJsonItem.showOnSeparateMap(globeOrMap);
  }
};

GpxCatalogItem.prototype.canUseAsPath = function() {
  let pathType = undefined;

  const featuresData = this._geoJsonItem.data;

  if(featuresData && featuresData.crs.type === "EPSG" && featuresData.crs.properties.code === "4326") {
    if(featuresData.type === "FeatureCollection" && featuresData.features && featuresData.features.length == 1 && featuresData.features) {
      const geometry = featuresData.features[0].geometry;
      if(geometry.type === "MultiLineString" && geometry.coordinates.length == 1 && geometry.coordinates[0].length > 1) {
        pathType = PathTypes.featureCollectionMultiLineString;
      }
      else if(geometry.type === "LineString" && geometry.coordinates.length > 1) {
        pathType = PathTypes.featureCollectionLineString;
      }
    }
    else if(featuresData.type === "LineString" && featuresData.coordinates.length > 1) {
      pathType = PathTypes.lineString;
    }
    else if(featuresData.type === "MultiLineString" && featuresData.coordinates.length == 1) {
      pathType = PathTypes.multiLineString;
    }
    /*else if(featuresData.type === "GeometryCollection") {
      pathType = PathTypes.geometryCollection;
    }*/
  }
  if(typeof pathType === "undefined") {
    this.pathType = PathTypes.noPath;
    return false;
  }
  this.pathType = pathType;
  return true;
};

GpxCatalogItem.prototype.useAsPath = function() {
  let coordinates;

  switch(this.pathType) {
    case PathTypes.featureCollectionMultiLineString:
      coordinates = this._geoJsonItem.data.features[0].geometry.coordinates[0];
      break;
    case PathTypes.featureCollectionLineString:
      coordinates = this._geoJsonItem.data.features[0].geometry.coordinates;
      break;
    case PathTypes.multiLineString:
      coordinates = this._geoJsonItem.data.coordinates[0];
      break;
    case PathTypes.lineString:
      coordinates = this._geoJsonItem.data.coordinates;
      break;
  }

  if(coordinates.length > 0) {
    //this.terria.elevationPoints = [[...positions], [...stepDistanceMeters]];
    const results = preparePath(coordinates, this.terria.cesium.scene.globe.ellipsoid, this.terria.cesium.scene.terrainProvider);
    if(results[0].length > 1) {
      this.terria.elevationPoints = results;
    }
  }
};

GpxCatalogItem.prototype.zoomTo = function() {
  if (defined(this._geoJsonItem)) {
    this._geoJsonItem.zoomTo();
  }
};

function preparePath(coordinates, ellipsoid, terrainProvider) {
  const positions = [];
  const stepDistanceMeters = [0.0];
  let dist = 0.0;

  coordinates.forEach((elem, index) => {
    positions.push(Cartographic.fromDegrees(elem[0], elem[1], Math.round(elem[2])));
    if(index > 0) {
      const geodesic = new EllipsoidGeodesic(positions[index - 1], positions[index]);
      dist += geodesic.surfaceDistance;
      stepDistanceMeters.push(dist);
    }
  });

  if(positions.every(element => element.height == 0 )) {
    sampleTerrainMostDetailed(terrainProvider, positions)
        .then(function(newPositions) {
          positions = newPositions;
        });
  }
  return [[...positions], [...stepDistanceMeters]];
}

function loadGpxText(gpxItem, text) {
  var dom = new DOMParser().parseFromString(text, "text/xml");
  var geojson = toGeoJSON.gpx(dom);

  gpxItem._geoJsonItem.data = geojson;

  return gpxItem._geoJsonItem.load().then(function() {
    gpxItem.rectangle = gpxItem._geoJsonItem.rectangle;
    gpxItem.clock = gpxItem._geoJsonItem.clock;
  });
}

function errorLoading(gpxItem) {
  var terria = gpxItem.terria;
  throw new TerriaError({
    sender: gpxItem,
    title: i18next.t("models.gpx.errorLoadingTitle"),
    message: i18next.t("models.gpx.errorLoadingMessage", {
      appName: terria.appName,
      email:
        '<a href="mailto:' +
        terria.supportEmail +
        '">' +
        terria.supportEmail +
        "</a>."
    })
  });
}

module.exports = GpxCatalogItem;
