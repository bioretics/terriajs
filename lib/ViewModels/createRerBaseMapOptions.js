'use strict';

/*global require*/
var WebMapServiceCatalogItem = require('../Models/WebMapServiceCatalogItem');
var ArcGisMapServerCatalogItem = require('../Models/ArcGisMapServerCatalogItem');
var OpenStreetMapCatalogItem = require('../Models/OpenStreetMapCatalogItem');
var CompositeCatalogItem = require('../Models/CompositeCatalogItem');
var BaseMapViewModel = require('./BaseMapViewModel');

var createRerBaseMapOptions = function(terria) {
    var result = [];

    // Background basemap per la parte di globo non coperta dalle mappe della Regione Emilia-Romagna
    var positron = new OpenStreetMapCatalogItem(terria);
    positron.url = 'http://global.ssl.fastly.net/light_nolabels/';
    positron.attribution = '© OpenStreetMap contributors ODbL, © CartoDB CC-BY 3.0';
    positron.opacity = 0.7;
    positron.subdomains=['cartodb-basemaps-a','cartodb-basemaps-b','cartodb-basemaps-c','cartodb-basemaps-d'];
    

    var dbtrCtr = new ArcGisMapServerCatalogItem(terria);
    dbtrCtr.url = 'https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/dbtr_ctrmultiscala_wgs84wm/MapServer';
    dbtrCtr.parameters = {
        tiled: true
    };
    dbtrCtr.opacity = 1.0;
    dbtrCtr.isRequiredForRendering = true;

    var dbtrCtr_Positron = new CompositeCatalogItem(terria);
    dbtrCtr_Positron.name = 'DBTR CTR multiscala';
    dbtrCtr_Positron.add(positron);
    dbtrCtr_Positron.add(dbtrCtr);
    dbtrCtr_Positron.opacity = 1.0;
    dbtrCtr_Positron.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/dbtrCtr.png'),
        catalogItem: dbtrCtr_Positron
    }));


    var dbtrWeb = new ArcGisMapServerCatalogItem(terria);
    dbtrWeb.url = 'https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/dbtr_wgs84wm/MapServer';
    dbtrWeb.parameters = {
        tiled: true
    };
    dbtrWeb.opacity = 1.0;
    dbtrWeb.isRequiredForRendering = true;

    var dbtrWeb_Positron = new CompositeCatalogItem(terria);
    dbtrWeb_Positron.name = 'DBTR mappa Web';
    dbtrWeb_Positron.add(positron);
    dbtrWeb_Positron.add(dbtrWeb);
    dbtrWeb_Positron.opacity = 1.0;
    dbtrWeb_Positron.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/dbtrWeb.png'),
        catalogItem: dbtrWeb_Positron
    }));

    /*result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/dbtrWeb.png'),
        catalogItem: dbtrWeb, osm
    }));*/

    /*
    var ctr250k = new WebMapServiceCatalogItem(terria);
    ctr250k.name = 'CTR 250K';
    ctr250k.url = 'https://servizigis.regione.emilia-romagna.it/wms/ctr250c_ed2016';
    ctr250k.layers = 'public/Ctr250c_ed2016';
    ctr250k.parameters = {
        tiled: true
    };
    ctr250k.opacity = 1.0;
    ctr250k.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/ctr250k.png'),
        catalogItem: ctr250k
    }));
    */

    /*
    var ortoimmagini2014 = new WebMapServiceCatalogItem(terria);
    ortoimmagini2014.name = 'Ortoimmagini TeA 2014';
    ortoimmagini2014.url = 'http://gis.ente.regione.emr.it/wms/agea2014_rgb';
    ortoimmagini2014.layers = 'public/Agea2014_RGB';
    ortoimmagini2014.parameters = {
        tiled: true
    };
    ortoimmagini2014.opacity = 1.0;
    ortoimmagini2014.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/ortoimmagini2014.png'),
        catalogItem: ortoimmagini2014
    }));
    */

    /*var ortoimmagini2011 = new ArcGisMapServerCatalogItem(terria);
    ortoimmagini2011.url = 'https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/agea2011_wgs84wm/MapServer';
    ortoimmagini2011.parameters = {
        tiled: true
    };
    ortoimmagini2011.opacity = 1.0;
    ortoimmagini2011.isRequiredForRendering = true;

    var ortoimmagini2011_Positron = new CompositeCatalogItem(terria);
    ortoimmagini2011_Positron.name = 'Ortoimmagini AGEA2011';
    ortoimmagini2011_Positron.add(positron);
    ortoimmagini2011_Positron.add(ortoimmagini2011);
    ortoimmagini2011_Positron.opacity = 1.0;
    ortoimmagini2011_Positron.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/ortoimmagini2011.png'),
        catalogItem: ortoimmagini2011_Positron
    }));*/


    var ortoimmagini2017 = new ArcGisMapServerCatalogItem(terria);
    ortoimmagini2017.url = 'http://gis.ente.regione.emr.it/arcgis/rest/services/private_moka/agea2017_wgs84wm/MapServer';
    ortoimmagini2017.parameters = {
        tiled: true
    };
    ortoimmagini2017.opacity = 1.0;
    ortoimmagini2017.isRequiredForRendering = true;

    var ortoimmagini2017_Positron = new CompositeCatalogItem(terria);
    ortoimmagini2017_Positron.name = 'Ortoimmagini Tea2017';
    ortoimmagini2017_Positron.add(positron);
    ortoimmagini2017_Positron.add(ortoimmagini2017);
    ortoimmagini2017_Positron.opacity = 1.0;
    ortoimmagini2017_Positron.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/ortoimmagini2011.png'),
        catalogItem: ortoimmagini2017_Positron
    }));

    

    /*
    var cartaStorica1853 = new WebMapServiceCatalogItem(terria);
    cartaStorica1853.name = 'Carta Storica Regionale 1853';
    cartaStorica1853.url = 'https://servizigis.regione.emilia-romagna.it/wms/carta_storica_regionale_1853';
    cartaStorica1853.layers = 'public/carta_storica_regionale_1853';
    cartaStorica1853.parameters = {
        tiled: true
    };
    cartaStorica1853.opacity = 1.0;
    cartaStorica1853.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/cartaStorica1853.png'),
        catalogItem: cartaStorica1853
    }));

    var ortoimmagini1954 = new WebMapServiceCatalogItem(terria);
    ortoimmagini1954.name = 'Ortoimmagini Volo GAI 1954';
    ortoimmagini1954.url = 'https://servizigis.regione.emilia-romagna.it/wms/VoloGAI1954';
    ortoimmagini1954.layers = 'public/VoloGAI1954';
    ortoimmagini1954.parameters = {
        tiled: true
    };
    ortoimmagini1954.opacity = 1.0;
    ortoimmagini1954.isRequiredForRendering = true;

    result.push(new BaseMapViewModel({
        image: require('../../wwwroot/images/ortoimmagini1954.png'),
        catalogItem: ortoimmagini1954
    }));
    */

    return result;
};

module.exports = createRerBaseMapOptions;
