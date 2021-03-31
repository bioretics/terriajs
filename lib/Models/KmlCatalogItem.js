"use strict";

/*global require,Document*/

var defined = require("terriajs-cesium/Source/Core/defined").default;

var Ellipsoid = require("terriajs-cesium/Source/Core/Ellipsoid").default;
//var KmlDataSource = require('terriajs-cesium/Source/DataSources/KmlDataSource');
var knockout = require("terriajs-cesium/Source/ThirdParty/knockout").default;
var PolygonHierarchy = require("terriajs-cesium/Source/Core/PolygonHierarchy")
  .default;
var sampleTerrain = require("terriajs-cesium/Source/Core/sampleTerrain")
  .default;
var when = require("terriajs-cesium/Source/ThirdParty/when").default;

var DataSourceCatalogItem = require("./DataSourceCatalogItem");
var Metadata = require("./Metadata");
var TerriaError = require("../Core/TerriaError");
var inherit = require("../Core/inherit");
var promiseFunctionToExplicitDeferred = require("../Core/promiseFunctionToExplicitDeferred");
var proxyCatalogItemUrl = require("./proxyCatalogItemUrl");
var readXml = require("../Core/readXml");
var i18next = require("i18next").default;

var Color = require('terriajs-cesium/Source/Core/Color');
var HeightReference = require('terriajs-cesium/Source/Scene/HeightReference');
var ArcType = require("terriajs-cesium/Source/Core/ArcType");

//var Cartesian3 = require("terriajs-cesium/Source/Core/Cartesian3").default;
var Cartographic = require("terriajs-cesium/Source/Core/Cartographic").default;
var EllipsoidGeodesic = require("terriajs-cesium/Source/Core/EllipsoidGeodesic").default;
const sampleTerrainMostDetailed = require('terriajs-cesium/Source/Core/sampleTerrainMostDetailed.js').default;

/**
 * A {@link CatalogItem} representing KML or KMZ feature data.
 *
 * @alias KmlCatalogItem
 * @constructor
 * @extends CatalogItem
 *
 * @param {Terria} terria The Terria instance.
 * @param {String} [url] The URL from which to retrieve the KML or KMZ data.
 */
var KmlCatalogItem = function(terria, url) {
  DataSourceCatalogItem.call(this, terria);

  this._dataSource = undefined;

  this.url = url;

  /**
   * Gets or sets the KML or KMZ data, represented as a binary Blob, DOM Document, or a Promise for one of those things.
   * If this property is set, {@link CatalogItem#url} is ignored.
   * This property is observable.
   * @type {Blob|Document|Promise}
   */
  this.data = undefined;

  /**
   * Gets or sets the URL from which the {@link KmlCatalogItem#data} was obtained.  This will be used
   * to resolve any resources linked in the KML file, if any.  This property is observable.
   * @type {String}
   */
  this.dataSourceUrl = undefined;

  knockout.track(this, ["data", "dataSourceUrl"]);
};

inherit(DataSourceCatalogItem, KmlCatalogItem);

Object.defineProperties(KmlCatalogItem.prototype, {
  /**
   * Gets the type of data member represented by this instance.
   * @memberOf KmlCatalogItem.prototype
   * @type {String}
   */
  type: {
    get: function() {
      return "kml";
    }
  },

  /**
   * Gets a human-readable name for this type of data source, 'KML'.
   * @memberOf KmlCatalogItem.prototype
   * @type {String}
   */
  typeName: {
    get: function() {
      return i18next.t("models.kml.name");
    }
  },

  /**
   * Gets the metadata associated with this data source and the server that provided it, if applicable.
   * @memberOf KmlCatalogItem.prototype
   * @type {Metadata}
   */
  metadata: {
    get: function() {
      var result = new Metadata();
      result.isLoading = false;
      result.dataSourceErrorMessage = i18next.t(
        "models.kml.dataSourceErrorMessage"
      );
      result.serviceErrorMessage = i18next.t("models.kml.serviceErrorMessage");
      return result;
    }
  },
  /**
   * Gets the data source associated with this catalog item.
   * @memberOf KmlCatalogItem.prototype
   * @type {DataSource}
   */
  dataSource: {
    get: function() {
      return this._dataSource;
    }
  }
});

KmlCatalogItem.prototype._getValuesThatInfluenceLoad = function() {
  return [this.url, this.data];
};

var kmzRegex = /\.kmz$/i;

KmlCatalogItem.prototype._load = function() {
  var codeSplittingDeferred = when.defer();

  var that = this;
  require.ensure(
    "terriajs-cesium/Source/DataSources/KmlDataSource",
    function() {
      var KmlDataSource = require("terriajs-cesium/Source/DataSources/KmlDataSource")
        .default;

      promiseFunctionToExplicitDeferred(codeSplittingDeferred, function() {
        // If there is an existing data source, remove it first.
        var reAdd = false;
        if (defined(that._dataSource)) {
          reAdd = that.terria.dataSources.remove(that._dataSource, true);
        }

        var dataSource = new KmlDataSource({
          // Currently we don't pass camera and canvas, which are technically required as of Cesium v1.23.
          // We get away with it because A) the code to check that they're supplied is removed
          // in release builds of Cesium, and B) the code that actually uses them (building network
          // link URLs) has guards so it won't totally fail if they're not supplied.  But for
          // proper network link support, we'll need to figure out how to get those things in here,
          // even though a single KmlCatalogItem can be shown on multiple maps.  Some refactoring of
          // Cesium will be required.
          proxy: {
            // Don't cache resources referenced by the KML.
            getURL: url =>
              that.terria.corsProxy.getURLProxyIfNecessary(url, "0d")
          }
        });
        that._dataSource = dataSource;

        if (reAdd) {
          that.terria.dataSources.add(that._dataSource);
        }

        if (defined(that.data)) {
          return when(that.data, function(data) {
            if (data instanceof Document) {
              return dataSource
                .load(data, proxyCatalogItemUrl(that, that.dataSourceUrl, "1d"))
                .then(function() {
                  doneLoading(that);
                })
                .otherwise(function() {
                  errorLoading(that);
                });
            } else if (typeof Blob !== "undefined" && data instanceof Blob) {
              if (that.dataSourceUrl && that.dataSourceUrl.match(kmzRegex)) {
                return dataSource
                  .load(
                    data,
                    proxyCatalogItemUrl(that, that.dataSourceUrl, "1d")
                  )
                  .then(function() {
                    doneLoading(that);
                  })
                  .otherwise(function() {
                    errorLoading(that);
                  });
              } else {
                return readXml(data)
                  .then(function(xml) {
                    return dataSource
                      .load(
                        xml,
                        proxyCatalogItemUrl(that, that.dataSourceUrl, "1d")
                      )
                      .then(function() {
                        doneLoading(that);
                      });
                  })
                  .otherwise(function() {
                    errorLoading(that);
                  });
              }
            } else if (data instanceof String || typeof data === "string") {
              var parser = new DOMParser();
              var xml;
              try {
                xml = parser.parseFromString(data, "text/xml");
              } catch (e) {}

              if (
                !xml ||
                !xml.documentElement ||
                xml.getElementsByTagName("parsererror").length > 0
              ) {
                errorLoading(that);
              }
              return dataSource
                .load(xml, proxyCatalogItemUrl(that, that.dataSourceUrl, "1d"))
                .then(function() {
                  doneLoading(that);
                })
                .otherwise(function() {
                  errorLoading(that);
                });
            } else {
              throw new TerriaError({
                sender: that,
                title: i18next.t("models.kml.unexpectedTypeTitle"),
                message: i18next.t("models.kml.unexpectedTypeTitle", {
                  appName: that.terria.appName,
                  email:
                    '<a href="mailto:' +
                    that.terria.supportEmail +
                    '">' +
                    that.terria.supportEmail +
                    "</a>."
                })
              });
            }
          });
        } else {
          return dataSource
            .load(proxyCatalogItemUrl(that, that.url, "1d"))
            .then(function() {
              doneLoading(that);
            })
            .otherwise(function() {
              errorLoading(that);
            });
        }
      });
    },
    "Cesium-DataSources"
  );

  return codeSplittingDeferred.promise;
};

KmlCatalogItem.prototype.canUseAsPath = function() {

  console.log(this.dataSource);

  if(this.dataSource && this.dataSource.entities && this.dataSource.entities.values && this.dataSource.entities.values.length > 0) {
    const items = this.dataSource.entities.values.filter(elem => elem && typeof elem.polyline !== 'undefined');
    if(items.length == 1 && items[0].polyline.positions.getValue().length > 1) {
      return true;
    }
  }
  return false;
};

KmlCatalogItem.prototype.useAsPath = function() {
  const items = this.dataSource.entities.values.filter(elem => elem && typeof elem.polyline !== 'undefined');
  const coordinates = items[0].polyline.positions.getValue();

  let positions = [];
  const stepDistanceMeters = [0.0];
  let dist = 0.0;
  const ellipsoid = this.terria.cesium.scene.globe.ellipsoid;
  const terrainProvider = this.terria.cesium.scene.terrainProvider;

  coordinates.forEach((elem, index) => {
    positions.push(Cartographic.fromCartesian(elem, ellipsoid));
  });

  var that = this;

  let prom = Promise.resolve(positions);
  
  if(positions.every(element => element.height < 1 )) {
    prom = prom.then((pos) => sampleTerrainMostDetailed(terrainProvider, pos));
  }

  prom.then((newPositions) => {    
    newPositions.forEach((elem, index) => {
      elem.height = Math.round(elem.height);
      if(index > 0) {
        const geodesic = new EllipsoidGeodesic(positions[index - 1], positions[index]);
        dist += geodesic.surfaceDistance;
        stepDistanceMeters.push(dist);
      }
    });
    if(newPositions.length > 1) {
      that.terria.elevationPoints = [[...newPositions], [...stepDistanceMeters]];
    }
  });
};

function doneLoading(kmlItem) {
  var dataSource = kmlItem._dataSource;
  kmlItem.clock = dataSource.clock;

  // Clamp features to terrain.
  if (defined(kmlItem.terria.cesium)) {
    var positionsToSample = [];
    var correspondingCartesians = [];

    var entities = dataSource.entities.values;
    for (var i = 0; i < entities.length; ++i) {
      var entity = entities[i];

      var polygon = entity.polygon;
      if (defined(polygon)) {
        polygon.material = Color.BLUE;

        polygon.perPositionHeight = true;
        var polygonHierarchy = polygon.hierarchy.getValue(); // assuming hierarchy is not time-varying
        samplePolygonHierarchyPositions(polygonHierarchy, positionsToSample, correspondingCartesians);
      }

      if (defined(entity.polygon) || defined(entity.corridor) || defined(entity.rectangle)) {
        entity.polygon.height = undefined;
        entity.polygon.extrudedHeight = undefined;
        //entity.polygon.material = Color.BLUE.withAlpha(0.5);
      }
      else if (defined(entity.polyline)) {
        entity.polyline.clampToGround = true;
        entity.polyline.arcType = ArcType.GEODESIC;
      }
      else if (defined(entity.billboard) || defined(entity.model)) {
        entity.billboard.heightReference = HeightReference.CLAMP_TO_GROUND;
      }
    }

    var terrainProvider = kmlItem.terria.cesium.scene.globe.terrainProvider;
    sampleTerrain(terrainProvider, 11, positionsToSample).then(function() {
      var i;
      for (i = 0; i < positionsToSample.length; ++i) {
        var position = positionsToSample[i];
        if (!defined(position.height)) {
          continue;
        }

        Ellipsoid.WGS84.cartographicToCartesian(
          position,
          correspondingCartesians[i]
        );
      }

      // Force the polygons to be rebuilt.
      for (i = 0; i < entities.length; ++i) {
        var polygon = entities[i].polygon;
        if (!defined(polygon)) {
          continue;
        }

        var existingHierarchy = polygon.hierarchy.getValue();
        polygon.hierarchy = new PolygonHierarchy(
          existingHierarchy.positions,
          existingHierarchy.holes
        );
      }
    });
  }
}

function samplePolygonHierarchyPositions(
  polygonHierarchy,
  positionsToSample,
  correspondingCartesians
) {
  var positions = polygonHierarchy.positions;

  var i;
  for (i = 0; i < positions.length; ++i) {
    var position = positions[i];
    correspondingCartesians.push(position);
    positionsToSample.push(Ellipsoid.WGS84.cartesianToCartographic(position));
  }

  var holes = polygonHierarchy.holes;
  for (i = 0; i < holes.length; ++i) {
    samplePolygonHierarchyPositions(
      holes[i],
      positionsToSample,
      correspondingCartesians
    );
  }
}

function errorLoading(kmlItem) {
  var terria = kmlItem.terria;
  throw new TerriaError({
    sender: kmlItem,
    title: i18next.t("models.kml.errorLoadingTitle"),
    message: i18next.t("models.kml.unexpectedTypeTitle", {
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

module.exports = KmlCatalogItem;
