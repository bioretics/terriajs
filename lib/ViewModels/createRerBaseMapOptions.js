"use strict";

/*global require*/
var WebMapServiceCatalogItem = require("../Models/WebMapServiceCatalogItem");
var ArcGisMapServerCatalogItem = require("../Models/ArcGisMapServerCatalogItem");
var OpenStreetMapCatalogItem = require("../Models/OpenStreetMapCatalogItem");
var CompositeCatalogItem = require("../Models/CompositeCatalogItem");
var BaseMapViewModel = require("./BaseMapViewModel");

var createRerBaseMapOptions = function(terria) {
  var result = [];

  // Background basemap per la parte di globo non coperta dalle mappe della Regione Emilia-Romagna
  var positron = new OpenStreetMapCatalogItem(terria);
  positron.url = "https://global.ssl.fastly.net/light_nolabels/";
  positron.attribution =
    "© OpenStreetMap contributors ODbL, © CartoDB CC-BY 3.0";
  positron.opacity = 0.7;
  positron.subdomains = [
    "cartodb-basemaps-a",
    "cartodb-basemaps-b",
    "cartodb-basemaps-c",
    "cartodb-basemaps-d"
  ];

  var dbtrCtr = new ArcGisMapServerCatalogItem(terria);
  dbtrCtr.url =
    "https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/dbtr_ctrmultiscala_wgs84wm/MapServer";
  dbtrCtr.parameters = {
    tiled: true
  };
  dbtrCtr.opacity = 1.0;
  dbtrCtr.isRequiredForRendering = true;

  var dbtrCtr_Positron = new CompositeCatalogItem(terria);
  dbtrCtr_Positron.name = "DBTR CTR multiscala";
  dbtrCtr_Positron.add(positron);
  dbtrCtr_Positron.add(dbtrCtr);
  dbtrCtr_Positron.opacity = 1.0;
  dbtrCtr_Positron.isRequiredForRendering = true;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/dbtrCtr.png"),
      catalogItem: dbtrCtr_Positron
    })
  );

  var dbtrWeb = new ArcGisMapServerCatalogItem(terria);
  dbtrWeb.url =
    "https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/dbtr_wgs84wm/MapServer";
  dbtrWeb.parameters = {
    tiled: true
  };
  dbtrWeb.opacity = 1.0;
  dbtrWeb.isRequiredForRendering = true;

  var dbtrWeb_Positron = new CompositeCatalogItem(terria);
  dbtrWeb_Positron.name = "DBTR mappa Web";
  dbtrWeb_Positron.add(positron);
  dbtrWeb_Positron.add(dbtrWeb);
  dbtrWeb_Positron.opacity = 1.0;
  dbtrWeb_Positron.isRequiredForRendering = true;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/dbtrWeb.png"),
      catalogItem: dbtrWeb_Positron
    })
  );

  var ortoimmaginiTea = new ArcGisMapServerCatalogItem(terria);
  ortoimmaginiTea.url =
    "https://servizigis.regione.emilia-romagna.it/arcgis/rest/services/cache/cgr2018_rgb_wgs84wm/MapServer";
  ortoimmaginiTea.parameters = {
    tiled: true
  };
  ortoimmaginiTea.opacity = 1.0;
  ortoimmaginiTea.isRequiredForRendering = true;

  var ortoimmaginiTea_Positron = new CompositeCatalogItem(terria);
  ortoimmaginiTea_Positron.name = "Ortofoto CGR2018";
  ortoimmaginiTea_Positron.description = "Ortofoto RGFB 30 cm CGR2018 - TUTTI I DIRITTI RISERVATI";
  ortoimmaginiTea_Positron.add(positron);
  ortoimmaginiTea_Positron.add(ortoimmaginiTea);
  ortoimmaginiTea_Positron.opacity = 1.0;
  ortoimmaginiTea_Positron.isRequiredForRendering = true;

  result.push(
    new BaseMapViewModel({
      image: require("../../wwwroot/images/ortoimmagini2011.png"),
      catalogItem: ortoimmaginiTea_Positron
    })
  );

  return result;
};

module.exports = createRerBaseMapOptions;
