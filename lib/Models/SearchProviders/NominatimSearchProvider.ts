import { observable, runInAction } from "mobx";
import defaultValue from "terriajs-cesium/Source/Core/defaultValue";
//import defined from "terriajs-cesium/Source/Core/defined";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import Rectangle from "terriajs-cesium/Source/Core/Rectangle";
import Resource from "terriajs-cesium/Source/Core/Resource";
import Cartesian2 from "terriajs-cesium/Source/Core/Cartesian2";
import EllipsoidGeodesic from "terriajs-cesium/Source/Core/EllipsoidGeodesic";
import loadJsonp from "../../Core/loadJsonp";
import loadJson from "../../Core/loadJson";
import SearchProvider from "./SearchProvider";
import SearchResult from "./SearchResult";
import Terria from "../Terria";
import SearchProviderResults from "./SearchProviderResults";
import i18next from "i18next";
import {
  Category,
  SearchAction
} from "../../Core/AnalyticEvents/analyticEvents";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";

interface NominatimSearchProviderOptions {
  terria: Terria;
  url?: string;
  key?: string;
  flightDurationSeconds?: number;
  limitBounded?: number;
  limitOthers?: number;
  countryCodes?: string;
}

export default class NominatimSearchProvider extends SearchProvider {
  readonly terria: Terria;
  @observable url: string;
  @observable key: string | undefined;
  @observable flightDurationSeconds: number;
  @observable limitBounded: number;
  @observable limitOthers: number;
  @observable countryCodes: string;

  constructor(options: NominatimSearchProviderOptions) {
    super();

    this.terria = options.terria;
    this.name = "Nominatim";
    this.url = defaultValue(options.url, "//nominatim.openstreetmap.org/");
    if (this.url.length > 0 && this.url[this.url.length - 1] !== "/") {
      this.url += "/";
    }
    this.key = options.key;
    this.flightDurationSeconds = defaultValue(options.flightDurationSeconds, 3);
    this.limitBounded = 2;
    this.limitOthers = 2;
    this.countryCodes = `&countrycodes=${defaultValue(
      options.countryCodes,
      "it"
    )}`;

    if (!this.key) {
      console.warn(
        "The " +
          this.name +
          " geocoder will always return no results because a Bing Maps key has not been provided. Please get a Bing Maps key from Nominatimportal.com and add it to parameters.NominatimKey in config.json."
      );
    }
  }

  protected doSearch(
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

    var bboxStr = "";

    if (!!this.terria.cesium) {
      const scene = this.terria?.cesium?.scene;
      const camera = scene?.camera;
      const canvas = scene?.canvas;
      if (!!!camera || !!!canvas) {
        return Promise.resolve();
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
        bboxStr =
          "&viewbox=" +
          CesiumMath.toDegrees(posUL.longitude) +
          "," +
          CesiumMath.toDegrees(posUL.latitude) +
          "," +
          CesiumMath.toDegrees(posLR.longitude) +
          "," +
          CesiumMath.toDegrees(posLR.latitude);
      } else {
        bboxStr = "";
      }
    } else if (!!this.terria.leaflet) {
      var bbox = this.terria.leaflet.map.getBounds();
      bboxStr =
        "&viewbox=" +
        bbox.getWest() +
        "," +
        bbox.getNorth() +
        "," +
        bbox.getEast() +
        "," +
        bbox.getSouth();
    }
    var promiseBounded = loadJson(
      this.url +
        "search?q=" +
        searchText +
        bboxStr +
        "&bounded=1&format=json" +
        this.countryCodes +
        "&limit=" +
        this.limitBounded
    );
    var promiseOthers = loadJson(
      this.url +
        "search?q=" +
        searchText +
        "&format=json" +
        this.countryCodes +
        "&limit=" +
        this.limitOthers
    );

    return Promise.all([promiseBounded, promiseOthers])
      .then((result) => {
        if (searchResults.isCanceled) {
          // A new search has superseded this one, so ignore the result.
          return;
        }

        if (!!!result || (result[0].length === 0 && result[1].length === 0)) {
          searchResults.message = i18next.t("viewModels.searchNoLocations");
          return;
        }

        const idSet = new Set();
        const locations: any[] = [];

        for (let i = 0; i < result.length; ++i) {
          for (let j = 0; j < result[i].length; ++j) {
            const resource = result[i][j];

            const name = resource.display_name;
            if (!!!name) {
              continue;
            }

            if (!idSet.has(resource.place_id)) {
              locations.push(
                new SearchResult({
                  name: name,
                  isImportant: false,
                  clickAction: createZoomToFunction(this, resource),
                  location: {
                    latitude: parseFloat(resource.lat),
                    longitude: parseFloat(resource.lon)
                  }
                })
              );
              idSet.add(resource.place_id);
            }
          }
        }

        runInAction(() => {
          searchResults.results.push(...locations);
        });

        if (searchResults.results.length === 0) {
          searchResults.message = i18next.t("viewModels.searchNoLocations");
        }
      })
      .catch((err) => {
        if (searchResults.isCanceled) {
          // A new search has superseded this one, so ignore the result.
          return;
        } else {
          console.log(`Error in NominatimSearchProvider: ${err}`);
        }

        searchResults.message = i18next.t("viewModels.searchErrorOccurred");
      });
  }
}

function createZoomToFunction(model: NominatimSearchProvider, resource: any) {
  const [south, north, west, east] = resource.boundingbox;

  const epsilon = 10e-5;

  let westSouth = Cartographic.fromDegrees(parseFloat(west), parseFloat(south));
  let eastNorth = Cartographic.fromDegrees(parseFloat(east), parseFloat(north));

  const distance = new EllipsoidGeodesic(westSouth, eastNorth).surfaceDistance;
  if (distance < 50) {
    westSouth = new Cartographic(
      westSouth.longitude - epsilon,
      westSouth.latitude - epsilon
    );
    eastNorth = new Cartographic(
      eastNorth.longitude + epsilon,
      eastNorth.latitude + epsilon
    );
  }

  const rectangle = Rectangle.fromCartographicArray([westSouth, eastNorth]);

  return function () {
    const terria = model.terria;
    terria.currentViewer.zoomTo(rectangle, model.flightDurationSeconds);
  };
}
