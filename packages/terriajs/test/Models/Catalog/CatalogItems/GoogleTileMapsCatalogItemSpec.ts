import { http, HttpResponse } from "msw";
import { runInAction } from "mobx";
import UrlTemplateImageryProvider from "terriajs-cesium/Source/Scene/UrlTemplateImageryProvider";
import URI from "urijs";
import { ImageryParts } from "../../../../lib/ModelMixins/MappableMixin";
import CatalogMemberFactory from "../../../../lib/Models/Catalog/CatalogMemberFactory";
import GoogleTileMapsCatalogItem from "../../../../lib/Models/Catalog/CatalogItems/GoogleTileMapsCatalogItem";
import CommonStrata from "../../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../../lib/Models/Terria";
import { worker } from "../../../mocks/browser";

const CREATE_SESSION_URL = "https://tile.googleapis.com/v1/createSession";

function getImageryProvider(
  item: GoogleTileMapsCatalogItem
): UrlTemplateImageryProvider {
  const mapItem = item.mapItems[0];
  if (
    ImageryParts.is(mapItem) &&
    mapItem.imageryProvider instanceof UrlTemplateImageryProvider
  ) {
    return mapItem.imageryProvider;
  }
  throw new Error("Load failed");
}

describe("GoogleTileMapsCatalogItem", function () {
  let terria: Terria;
  let item: GoogleTileMapsCatalogItem;

  beforeEach(function () {
    terria = new Terria({ baseUrl: "./" });
    item = new GoogleTileMapsCatalogItem("test", terria);
    runInAction(() => {
      item.setTrait(CommonStrata.definition, "key", "an-api-key");
    });
  });

  it("has a type", function () {
    expect(GoogleTileMapsCatalogItem.type).toEqual("google-tile-maps");
    expect(item.type).toEqual("google-tile-maps");
  });

  it("is registered with the catalog member factory", function () {
    expect(CatalogMemberFactory.find("google-tile-maps")).toBe(
      GoogleTileMapsCatalogItem
    );
  });

  describe("createSession", function () {
    it("posts the map type, language and region", async function () {
      let sentBody: any;
      worker.use(
        http.post(CREATE_SESSION_URL, async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json({ session: "a-session-token" });
        })
      );

      runInAction(() => {
        item.setTrait(CommonStrata.definition, "mapType", "roadmap");
        item.setTrait(CommonStrata.definition, "language", "it-IT");
        item.setTrait(CommonStrata.definition, "region", "IT");
      });
      await item.createSession();

      expect(sentBody).toEqual({
        mapType: "roadmap",
        language: "it-IT",
        region: "IT"
      });
    });

    it("sends the api key as a query parameter", async function () {
      let sentKey: string | null | undefined;
      worker.use(
        http.post(CREATE_SESSION_URL, ({ request }) => {
          sentKey = new URL(request.url).searchParams.get("key");
          return HttpResponse.json({ session: "a-session-token" });
        })
      );

      await item.createSession();

      expect(sentKey).toEqual("an-api-key");
    });

    it("sends empty strings for an unset language and region", async function () {
      let sentBody: any;
      worker.use(
        http.post(CREATE_SESSION_URL, async ({ request }) => {
          sentBody = await request.json();
          return HttpResponse.json({ session: "a-session-token" });
        })
      );

      await item.createSession();

      expect(sentBody.language).toEqual("");
      expect(sentBody.region).toEqual("");
    });

    it("defaults to satellite tiles", function () {
      expect(item.mapType).toEqual("satellite");
    });
  });

  describe("mapItems", function () {
    beforeEach(function () {
      worker.use(
        http.post(CREATE_SESSION_URL, () =>
          HttpResponse.json({ session: "a-session-token" })
        )
      );
    });

    it("returns a UrlTemplateImageryProvider", async function () {
      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      expect(ImageryParts.is(mapItem)).toBe(true);
      if (ImageryParts.is(mapItem)) {
        expect(
          mapItem.imageryProvider instanceof UrlTemplateImageryProvider
        ).toBe(true);
      }
    });

    it("puts the session token from createSession into the tile url", async function () {
      await item.loadMapItems();
      const uri = new URI(getImageryProvider(item).url);
      expect(uri.search(true).session).toEqual("a-session-token");
    });

    it("requests 2dtiles with the z/x/y template", async function () {
      await item.loadMapItems();
      expect(
        getImageryProvider(item).url.startsWith(
          "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}"
        )
      ).toBe(true);
    });

    it("sends the api key with every tile request", async function () {
      await item.loadMapItems();
      const uri = new URI(getImageryProvider(item).url);
      expect(uri.search(true).key).toEqual("an-api-key");
    });

    it("passes show and opacity through to the map item", async function () {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "opacity", 0.5);
        item.setTrait(CommonStrata.definition, "show", false);
      });
      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      if (!ImageryParts.is(mapItem)) throw new Error("Load failed");
      expect(mapItem.alpha).toEqual(0.5);
      expect(mapItem.show).toBe(false);
    });

    it("does not clip to the rectangle when clipToRectangle is off", async function () {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "clipToRectangle", false);
      });
      await item.loadMapItems();
      const mapItem = item.mapItems[0];
      if (!ImageryParts.is(mapItem)) throw new Error("Load failed");
      expect(mapItem.clippingRectangle).toBeUndefined();
    });
  });

  describe("the constructed imagery provider", function () {
    it("sets the tile levels from traits", function () {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "minimumLevel", 2);
        item.setTrait(CommonStrata.definition, "maximumLevel", 18);
      });
      const imageryProvider = getImageryProvider(item);
      expect(imageryProvider.minimumLevel).toEqual(2);
      expect(imageryProvider.maximumLevel).toEqual(18);
    });

    it("sets the tile size from traits", function () {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "tileWidth", 512);
        item.setTrait(CommonStrata.definition, "tileHeight", 512);
      });
      const imageryProvider = getImageryProvider(item);
      expect(imageryProvider.tileWidth).toEqual(512);
      expect(imageryProvider.tileHeight).toEqual(512);
    });

    it("defaults to 256 pixel tiles", function () {
      const imageryProvider = getImageryProvider(item);
      expect(imageryProvider.tileWidth).toEqual(256);
      expect(imageryProvider.tileHeight).toEqual(256);
    });

    it("disables feature picking when the trait says so", function () {
      runInAction(() => {
        item.setTrait(CommonStrata.definition, "allowFeaturePicking", false);
      });
      expect(getImageryProvider(item).enablePickFeatures).toBe(false);
    });
  });
});
