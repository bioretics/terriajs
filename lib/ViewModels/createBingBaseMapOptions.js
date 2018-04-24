'use strict';

/*global require*/
var BaseMapViewModel = require('./BaseMapViewModel');
var BingMapsCatalogItem = require('../Models/BingMapsCatalogItem');

var BingMapsStyle = require('terriajs-cesium/Source/Scene/BingMapsStyle');

var createBingBaseMapOptions = function(terria, bingMapsKey) {
    var result = [];

    var bingMapsAerialWithLabels = new BingMapsCatalogItem(terria);
    bingMapsAerialWithLabels.name = 'Bing Maps Aerial with Labels';
    bingMapsAerialWithLabels.mapStyle = BingMapsStyle.AERIAL_WITH_LABELS;
    bingMapsAerialWithLabels.opacity = 1.0;
    bingMapsAerialWithLabels.key = bingMapsKey;
    bingMapsAerialWithLabels.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/rer_bing-aerial-labels.png'),
        catalogItem: bingMapsAerialWithLabels
    }));

    return result;
};

module.exports = createBingBaseMapOptions;
