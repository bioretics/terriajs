import { observable, runInAction } from "mobx";
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Resource from "terriajs-cesium/Source/Core/Resource";
import SearchProvider from "./SearchProvider";
import SearchResult from "./SearchResult";
import Terria from "../Terria";
import SearchProviderResults from "./SearchProviderResults";
import i18next from "i18next";
import {
  Category,
  SearchAction
} from "../../Core/AnalyticEvents/analyticEvents";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";

interface RerSearchProviderOptions {
  terria: Terria;
  flightDurationSeconds?: number;
}

const GET_HANDLE_URL =
  "https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=GetHandle";
const NORM_ADDRESS_URL =
  "https://servizigis.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico";
const NORM_ADDRESS_AREA_URL =
  "https://servizigistest.regione.emilia-romagna.it/normalizzatore/eGeoCoding?serviceType=DBServices&serviceName=Normalizzatore&message=Norm_Indirizzo_Unico_Area";

export default class RerSearchProvider extends SearchProvider {
  readonly terria: Terria;
  @observable flightDurationSeconds: number;
  @observable handle: string;

  constructor(options: RerSearchProviderOptions) {
    super();

    this.terria = options.terria;
    this.name = "Servizi RER";

    this.flightDurationSeconds = defaultValue(options.flightDurationSeconds, 3);
    this.handle = "";
  }

  getHandle(searchResults: SearchProviderResults): Promise<any> | undefined {
    var that = this;

    return Resource.post({
      url: GET_HANDLE_URL,
      data: JSON.stringify({
        GetHandleInputParams: {
          p_Username: "commercio",
          p_Userpassword: "MAy64T7cc76ASn3CaJX8"
        }
      }),
      headers: {
        soapAction: GET_HANDLE_URL,
        "Content-Type": "application/json"
      }
    })
      ?.then((results) => {
        that.handle =
          JSON.parse(results).getHandleOutput.getHandleOutputParams.p_Handle;
      })
      .catch(() => {
        searchResults.message = i18next.t("viewModels.searchErrorOccurred");
      });
  }

  parseResults(results: any): any[] {
    const idSet = new Set();
    const locations: any[] = [];

    results
      .sort((a: any, b: any) => {
        return +a.gR_AFFIDABILITA - +b.gR_AFFIDABILITA;
      })
      .forEach(
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

    return locations;
  }

  computeSearchAreaRectangle(): Rectangle | undefined {
    let minX: number = 0,
      minY: number = 0,
      maxX: number = 0,
      maxY: number = 0;

    if (!!this.terria.cesium) {
      const scene = this.terria?.cesium?.scene;
      const camera = scene?.camera;
      const canvas = scene?.canvas;
      if (!!!camera || !!!canvas) {
        return;
      }

      const posUL2d = camera.pickEllipsoid(
        new Cartesian2(0, 0),
        Ellipsoid.WGS84
      );
      const posLR2d = camera.pickEllipsoid(
        new Cartesian2(canvas.width, canvas.height),
        Ellipsoid.WGS84
      );
      if (!!posUL2d && !!posLR2d) {
        const posUL = Ellipsoid.WGS84.cartesianToCartographic(posUL2d);
        const posLR = Ellipsoid.WGS84.cartesianToCartographic(posLR2d);

        return Rectangle.fromRadians(
          posUL.longitude,
          posLR.latitude,
          posLR.longitude,
          posUL.latitude
        );
      } else {
        return;
      }
    } else if (!!this.terria.leaflet) {
      const bbox = this.terria.leaflet.map.getBounds();
      minX = bbox.getWest();
      minY = bbox.getSouth();
      maxX = bbox.getEast();
      maxY = bbox.getNorth();

      return Rectangle.fromDegrees(minX, minY, maxX, maxY);
    } else return;
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

    if (!!!this.handle) {
      await this.getHandle(searchResults);
    }

    const searchPromises = [
      Resource.post({
        url: NORM_ADDRESS_URL,
        data: JSON.stringify({
          Norm_Indirizzo_UnicoInputParams: {
            p_Indirizzo: searchText,
            p_Tipo_Coord: "WGS84",
            p_Rif_Geo_Civ: "ECIV",
            p_Handle: this.handle
          }
        }),
        headers: {
          soapAction: NORM_ADDRESS_URL,
          "Content-Type": "application/json"
        }
      })
    ];


    const rect = this.computeSearchAreaRectangle();


    if (
      rect &&
      (rect.width < 2 * CesiumMath.RADIANS_PER_DEGREE ||
        rect.height < 2 * CesiumMath.RADIANS_PER_DEGREE)
    ) {
      searchPromises.unshift(
        Resource.post({
          url: NORM_ADDRESS_AREA_URL,
          data: JSON.stringify({
            Norm_Indirizzo_Unico_AreaInputParams: {
              p_Indirizzo: searchText,
              p_Tipo_Coord: "WGS84",
              p_Rif_Geo_Civ: "ECIV",
              p_Handle: this.handle,
              p_minx: `${CesiumMath.toDegrees(rect.west)}`,
              p_miny: `${CesiumMath.toDegrees(rect.south)}`,
              p_maxx: `${CesiumMath.toDegrees(rect.east)}`,
              p_maxy: `${CesiumMath.toDegrees(rect.north)}`
            }
          }),
          headers: {
            soapAction: NORM_ADDRESS_AREA_URL,
            "Content-Type": "application/json"
          }
        })
      );
    }
    

    try {
      const results = await Promise.all(searchPromises);

      if (searchResults.isCanceled) {
        // A new search has superseded this one, so ignore the result.
        return;
      }

      let resultsArray: any[] = [];
      for (let i in results) {
        const obj = JSON.parse(results[i]);
        if (
          obj?.norm_Indirizzo_Unico_AreaOutput
            ?.norm_Indirizzo_Unico_AreaOutputRecordsetArray
        ) {
          resultsArray = [
            ...resultsArray,
            ...obj.norm_Indirizzo_Unico_AreaOutput
              .norm_Indirizzo_Unico_AreaOutputRecordsetArray
          ];
        } else if (
          obj?.norm_Indirizzo_UnicoOutput
            ?.norm_Indirizzo_UnicoOutputRecordsetArray
        ) {
          resultsArray = [
            ...resultsArray,
            ...obj.norm_Indirizzo_UnicoOutput
              .norm_Indirizzo_UnicoOutputRecordsetArray
          ];
        }
      }

      if (resultsArray.length === 0) {
        searchResults.message = i18next.t("viewModels.searchNoLocations");
        return;
      }

      const locations = this.parseResults(resultsArray);

      runInAction(() => {
        searchResults.results.push(...locations);
      });

      if (searchResults.results.length === 0) {
        searchResults.message = i18next.t("viewModels.searchNoLocations");
      }
    } catch (err) {
      console.log("ERROR");
      console.log(err);
      if (searchResults.isCanceled) {
        // A new search has superseded this one, so ignore the result.
        return;
      }
      searchResults.message = i18next.t("viewModels.searchErrorOccurred");
    }
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

  return function () {
    const terria = model.terria;
    terria.currentViewer.zoomTo(rectangle, model.flightDurationSeconds);
  };
}
