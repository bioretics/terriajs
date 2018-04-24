'use strict';

/*global require*/
var createBingBaseMapOptions = require('./createBingBaseMapOptions');
var BaseMapViewModel = require('./BaseMapViewModel');
var WebMapServiceCatalogItem = require('../Models/WebMapServiceCatalogItem');
var OpenStreetMapCatalogItem = require('../Models/OpenStreetMapCatalogItem');

var createGlobalBaseMapOptions = function(terria, bingMapsKey) {
    var result = createBingBaseMapOptions(terria, bingMapsKey);

    /*var naturalEarthII = new WebMapServiceCatalogItem(terria);
    naturalEarthII.name = 'Natural Earth II';
    naturalEarthII.url = 'http://geoserver.nationalmap.nicta.com.au/imagery/natural-earth-ii/wms';
    naturalEarthII.layers = 'natural-earth-ii:NE2_HR_LC_SR_W_DR';
    naturalEarthII.parameters = {
        tiled: true
    };
    naturalEarthII.opacity = 1.0;
    naturalEarthII.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/natural-earth.png'),
        catalogItem: naturalEarthII
    }));*/

    var osm = new OpenStreetMapCatalogItem(terria);
    osm.name = 'OpenStreetMap';
    osm.url = 'http://openstreetmap.org';
    osm.opacity = 1.0;
    osm.subdomains=['a.tile','b.tile','c.tile'];
    osm.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/osm.png'),
        catalogItem: osm
    }));


    var cycle = new OpenStreetMapCatalogItem(terria);
    cycle.name = 'OpenStreetMap Cycle';
    cycle.url = 'https://thunderforest.com/cycle';
    cycle.key = '7e83030c32994214a3b8a85467d5b5a6';
    cycle.opacity = 1.0;
    cycle.subdomains=['a.tile','b.tile'];
    cycle.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/osm_cycle.png'),
        catalogItem: cycle
    }));


    /*var blackMarble = new WebMapServiceCatalogItem(terria);
    blackMarble.name = 'NASA Black Marble';
    blackMarble.url = 'http://geoserver.nationalmap.nicta.com.au/imagery/nasa-black-marble/wms';
    blackMarble.layers = 'nasa-black-marble:dnb_land_ocean_ice.2012.54000x27000_geo';
    blackMarble.parameters = {
        tiled: true
    };
    blackMarble.opacity = 1.0;
    blackMarble.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/black-marble.png'),
        catalogItem: blackMarble
    }));*/


    var positron = new OpenStreetMapCatalogItem(terria);
    positron.name = 'Positron (Light)';
    positron.url = 'http://global.ssl.fastly.net/light_all/';
    // https://cartodb.com/basemaps/ gives two different attribution strings. In any case HTML gets swallowed, so we have to adapt.
    // 1 '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy;
    //   <a href="http://cartodb.com/attributions">CartoDB</a>'
    // 2 Map tiles by <a href="http://cartodb.com/attributions#basemaps">CartoDB</a>, under <a href="https://creativecommons.org/licenses/by/3.0/">
    //   CC BY 3.0</a>. Data by <a href="http://www.openstreetmap.org/">OpenStreetMap</a>, under ODbL.
    positron.attribution = '© OpenStreetMap contributors ODbL, © CartoDB CC-BY 3.0';

    positron.opacity = 1.0;
    positron.subdomains=['cartodb-basemaps-a','cartodb-basemaps-b','cartodb-basemaps-c','cartodb-basemaps-d'];
    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/rer_positron.png'),
        catalogItem: positron,
        contrastColor: '#000000'
    }));

    var darkMatter = new OpenStreetMapCatalogItem(terria);
    darkMatter.name = 'Dark Matter';
    darkMatter.url = 'http://global.ssl.fastly.net/dark_all/';

    darkMatter.attribution = '© OpenStreetMap contributors ODbL, © CartoDB CC-BY 3.0';

    darkMatter.opacity = 1.0;
    darkMatter.subdomains=['cartodb-basemaps-a','cartodb-basemaps-b','cartodb-basemaps-c','cartodb-basemaps-d'];
    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/dark-matter_it.png'),
        catalogItem: darkMatter
    }));


    var white = new WebMapServiceCatalogItem(terria);
    white.name = 'All White';
    white.opacity = 0.0;
    white.isRequiredForRendering = false;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/white.png'),
        catalogItem: white
    }));

    return result;
};

module.exports = createGlobalBaseMapOptions;
