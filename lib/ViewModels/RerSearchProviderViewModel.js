"use strict";

/*global require*/
var inherit = require("../Core/inherit");
var SearchProviderViewModel = require("./SearchProviderViewModel");
var SearchResultViewModel = require("./SearchResultViewModel");

var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;
var Rectangle = require("terriajs-cesium/Source/Core/Rectangle").default;
import i18next from "i18next";

var CesiumResource = require("terriajs-cesium/Source/Core/Resource").default;

var RerSearchProviderViewModel = function (options) {
  SearchProviderViewModel.call(this);

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  this.terria = options.terria;

  //this._geocodeInProgress = undefined;

  this.name = "DB topografico Emilia-Romagna";

  //this.urlHandle = this.terria.corsProxy.getURLProxyIfNecessary("https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=GetHandle");
  //this.urlAddress = this.terria.corsProxy.getURLProxyIfNecessary("https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico");
  this.urlHandle = this.terria.corsProxy.getURL("https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=GetHandle");
  this.urlAddress = this.terria.corsProxy.getURL("https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico");
  this.bodyHandle = JSON.stringify({"GetHandleInputParams": {"p_Username": "commercio", "p_Userpassword": "MAy64T7cc76ASn3CaJX8"}});
  this.bodyAddressTemplate = JSON.stringify({"Norm_Indirizzo_UnicoInputParams": {"p_Indirizzo": "$1", "p_Tipo_Coord": "WGS84", "p_Rif_Geo_Civ": "ECIV", "p_Handle": "$2"}});
  this.handle = undefined;
  //this.result = undefined;

  this.flightDurationSeconds = defaultValue(options.flightDurationSeconds, 5.0);
  this.limitBounded = 2;
  this.limitOthers = 2;
};

inherit(SearchProviderViewModel, RerSearchProviderViewModel);

RerSearchProviderViewModel.prototype.search = function (searchText) {
  if (!defined(searchText) || /^\s*$/.test(searchText)) {
    this.isSearching = false;
    this.searchResults.removeAll();
    return;
  }

  this.isSearching = true;
  this.searchResults.removeAll();
  this.searchMessage = undefined;

  var that = this;
  
  if(this.handle === undefined){
    CesiumResource.post({
      url: this.urlHandle,
      data: this.bodyHandle,
      headers: {
        "soapAction": this.urlHandle,
        "Content-Type": "application/json"
      }
    }).then(function (results) {
      that.handle = JSON.parse(results).getHandleOutput.getHandleOutputParams.p_Handle;
      return that.searchLocation(searchText);
    }).otherwise(function (error) {
      that.isSearching = false;
      that.searchMessage = i18next.t("viewModels.searchErrorOccurred");
    });
  }
  else {
    return this.searchLocation(searchText);
  }
};

RerSearchProviderViewModel.prototype.searchLocation = function (searchText) {
  var that = this;

  return CesiumResource.post({
    url: this.urlAddress,
    data: this.bodyAddressTemplate.replace("$1", searchText).replace("$2", this.handle),
    headers: {
      "soapAction": this.urlAddress,
      "Content-Type": "application/json"
    },
  }).then(function (results) {
    that.isSearching = false;

    var res = JSON.parse(results);
    
    var locations = [];
    var idSet = new Set();

    res.norm_Indirizzo_UnicoOutput.norm_Indirizzo_UnicoOutputRecordsetArray.forEach(element => {
      if (!idSet.has(element.sTRADARIO_ID)) {
        var isHouseNumber = element.cIVICO_X !== "";
        var centerX = parseFloat(isHouseNumber ? element.cIVICO_X : element.cENTR_X);
        var centerY = parseFloat(isHouseNumber ? element.cIVICO_Y : element.cENTR_Y);
        locations.push(new SearchResultViewModel({
          name: element.dUG + " " + element.dENOMINAZIONE + (isHouseNumber ? " " + element.dESCRIZIONE_CIVICO : "") + ", " + element.cOMUNE + ", " + element.pROVINCIA,
          isImportant: parseFloat(element.gR_AFFIDABILITA),
          location: {
            latitude: centerY,
            longitude: centerX
          },
          clickAction: createZoomToFunction(that, centerX, centerY, isHouseNumber)
        }));
        idSet.add(element.sTRADARIO_ID);
      }
    });

    that.searchResults.push.apply(that.searchResults,
      locations.sort(function (obj1, obj2) {
        return obj1.isImportant - obj2.isImportant;
      }));

    if (that.searchResults.length === 0) {
      that.searchMessage = i18next.t("viewModels.searchNoLocations");
    }
  }).otherwise(function (error) {
    that.isSearching = false;
    that.searchMessage = i18next.t("viewModels.searchErrorOccurred");
  });
};

function createZoomToFunction(viewModel, centerX, centerY, isHouseNumber) {
  // Avoids the bbox is too small and camera too close to the ground
  var delta = isHouseNumber ? 0.0025 : 0.005;
  var rectangle = Rectangle.fromDegrees(centerX - delta, centerY - delta, centerX + delta, centerY + delta);

  return function () {
    var terria = viewModel.terria;
    terria.currentViewer.zoomTo(rectangle, viewModel.flightDurationSeconds);
  };
}

module.exports = RerSearchProviderViewModel;
