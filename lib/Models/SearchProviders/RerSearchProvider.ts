import { observable, runInAction } from "mobx";
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
import defined from "terriajs-cesium/Source/Core/defined";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Resource from "terriajs-cesium/Source/Core/Resource";
import loadJsonp from "../../Core/loadJsonp";
import SearchProvider from "./SearchProvider";
import SearchResult from "./SearchResult";
import Terria from "../Terria";
import SearchProviderResults from "./SearchProviderResults";
import i18next from "i18next";
import {
  Category,
  SearchAction
} from "../../Core/AnalyticEvents/analyticEvents";

interface RerSearchProviderOptions {
  terria: Terria;
  flightDurationSeconds?: number;
}

export default class RerSearchProvider extends SearchProvider {
  readonly terria: Terria;
  @observable flightDurationSeconds: number;
  @observable urlHandle: string;
  @observable urlAddress: string;
  @observable bodyHandle: string;
  @observable bodyAddressTemplate: string;
  @observable handle: string;

  constructor(options: RerSearchProviderOptions) {
    super();

    this.terria = options.terria;
    this.name = "RER";

    /*if (this.url.length > 0 && this.url[this.url.length - 1] !== "/") {
      this.url += "/";
    }*/
    this.flightDurationSeconds = defaultValue(options.flightDurationSeconds, 3);

    this.urlHandle = this.terria.corsProxy.getURL(
      "https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=GetHandle"
    );
    this.urlAddress = this.terria.corsProxy.getURL(
      "https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico"
    );
    this.bodyHandle = JSON.stringify({
      GetHandleInputParams: {
        p_Username: "commercio",
        p_Userpassword: "MAy64T7cc76ASn3CaJX8"
      }
    });
    this.bodyAddressTemplate = JSON.stringify({
      Norm_Indirizzo_UnicoInputParams: {
        p_Indirizzo: "$1",
        p_Tipo_Coord: "WGS84",
        p_Rif_Geo_Civ: "ECIV",
        p_Handle: "$2"
      }
    });
    this.handle = "";
  }

  getHandle(searchResults: SearchProviderResults): Promise<any> | undefined {
    var that = this;

    return Resource.post({
      url: this.urlHandle,
      data: this.bodyHandle,
      headers: {
        soapAction: this.urlHandle,
        "Content-Type": "application/json"
      }
    })
      ?.then(results => {
        that.handle = JSON.parse(
          results
        ).getHandleOutput.getHandleOutputParams.p_Handle;
      })
      .catch(() => {
        searchResults.message = i18next.t("viewModels.searchErrorOccurred");
      });
  }

  protected async doSearch(
    searchText: string,
    searchResults: SearchProviderResults
  ): Promise<void> {
    searchResults.results.length = 0;
    searchResults.message = undefined;

    if (searchText === undefined || /^\s*$/.test(searchText)) {
      return Promise.resolve();
    }

    this.terria.analytics?.logEvent(
      Category.search,
      SearchAction.bing,
      searchText
    );

    //let promise: Promise<any> | undefined = Promise.resolve();
    let promise: Promise<any>;

    if (!!!this.handle) {
      //promise = promise.then(() => this.getHandle(searchResults));
      await this.getHandle(searchResults);
    }

    await Resource.post({
      url: this.urlAddress,
      data: this.bodyAddressTemplate
        .replace("$1", searchText)
        .replace("$2", this.handle),
      headers: {
        soapAction: this.urlAddress,
        "Content-Type": "application/json"
      }
    })
      ?.then(result => {
        const resObj = JSON.parse(result);

        if (searchResults.isCanceled) {
          // A new search has superseded this one, so ignore the result.
          return;
        }

        if (
          resObj.norm_Indirizzo_UnicoOutput
            .norm_Indirizzo_UnicoOutputRecordsetArray.length === 0
        ) {
          searchResults.message = i18next.t("viewModels.searchNoLocations");
          return;
        }

        const idSet = new Set();
        const locations: any[] = [];

        resObj.norm_Indirizzo_UnicoOutput.norm_Indirizzo_UnicoOutputRecordsetArray.forEach(
          (element: {
            sTRADARIO_ID: string;
            cIVICO_X: string;
            cENTR_X: string;
            cIVICO_Y: string;
            cENTR_Y: string;
            dUG: string;
            dENOMINAZIONE: string;
            dESCRIZIONE_CIVICO: string;
            cOMUNE: string;
            pROVINCIA: string;
            gR_AFFIDABILITA: string;
          }) => {
            if (!idSet.has(element.sTRADARIO_ID)) {
              const isHouseNumber = element.cIVICO_X !== "";
              const centerX = parseFloat(
                isHouseNumber ? element.cIVICO_X : element.cENTR_X
              );
              const centerY = parseFloat(
                isHouseNumber ? element.cIVICO_Y : element.cENTR_Y
              );
              locations.push(
                new SearchResult({
                  name:
                    element.dUG +
                    " " +
                    element.dENOMINAZIONE +
                    (isHouseNumber ? " " + element.dESCRIZIONE_CIVICO : "") +
                    ", " +
                    element.cOMUNE +
                    ", " +
                    element.pROVINCIA,
                  isImportant: parseFloat(element.gR_AFFIDABILITA) < 1,
                  location: {
                    latitude: centerY,
                    longitude: centerX
                  },
                  clickAction: createZoomToFunction(
                    this,
                    centerX,
                    centerY,
                    isHouseNumber
                  )
                })
              );
              idSet.add(element.sTRADARIO_ID);
            }
          }
        );

        runInAction(() => {
          searchResults.results.push(...locations);
        });

        if (searchResults.results.length === 0) {
          searchResults.message = i18next.t("viewModels.searchNoLocations");
        }
      })
      .catch(err => {
        console.log("ERRORERRR");
        console.log(typeof err);
        console.log(err);

        if (searchResults.isCanceled) {
          // A new search has superseded this one, so ignore the result.
          return;
        }
        searchResults.message = i18next.t("viewModels.searchErrorOccurred");
      });
  }
}

function createZoomToFunction(
  model: RerSearchProvider,
  centerX: number,
  centerY: number,
  isHouseNumber: boolean
) {
  // Avoids the bbox is too small and camera too close to the ground
  const delta = isHouseNumber ? 0.0025 : 0.005;
  const rectangle = Rectangle.fromDegrees(
    centerX - delta,
    centerY - delta,
    centerX + delta,
    centerY + delta
  );

  return function() {
    const terria = model.terria;
    terria.currentViewer.zoomTo(rectangle, model.flightDurationSeconds);
  };
}
