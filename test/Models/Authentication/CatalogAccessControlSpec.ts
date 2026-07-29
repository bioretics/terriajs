import { runInAction } from "mobx";
import Result from "../../../lib/Core/Result";
import {
  CatalogPermissionLevel,
  canAccessCatalogMember,
  isCatalogMemberVisible
} from "../../../lib/Models/Authentication/CatalogAccessControl";
import WebMapServiceCatalogItem from "../../../lib/Models/Catalog/Ows/WebMapServiceCatalogItem";
import CommonStrata from "../../../lib/Models/Definition/CommonStrata";
import Terria from "../../../lib/Models/Terria";
import ViewState from "../../../lib/ReactViewModels/ViewState";

describe("Catalogue access control", () => {
  let terria: Terria;
  let viewState: ViewState;
  let item: WebMapServiceCatalogItem;

  beforeEach(() => {
    terria = new Terria({ baseUrl: "./" });
    viewState = new ViewState({
      terria,
      catalogSearchProvider: undefined
    });
    item = new WebMapServiceCatalogItem("protected-item", terria);
    item.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      CatalogPermissionLevel.Authenticated
    );
  });

  it("defaults catalogue items to unauthenticated access", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    expect(canAccessCatalogMember(publicItem)).toBe(true);
  });

  it("does not preview or load a protected item for an unauthenticated user", async () => {
    const loadMapItems = spyOn(item, "loadMapItems").and.callThrough();

    const result = await viewState.viewCatalogMember(item);

    expect(result.error).toBeUndefined();
    expect(loadMapItems).not.toHaveBeenCalled();
    expect(viewState.previewedItem).toBeUndefined();
    expect(terria.messageModal?.isVisible).toBe(true);
  });

  it("does not add or load a protected item for an unauthenticated user", async () => {
    const loadMapItems = spyOn(item, "loadMapItems").and.callThrough();

    await terria.workbench.add(item);

    expect(terria.workbench.contains(item)).toBe(false);
    expect(loadMapItems).not.toHaveBeenCalled();
    expect(terria.messageModal?.isVisible).toBe(true);
  });

  it("allows an authenticated user to add a protected item", async () => {
    runInAction(() => {
      terria.userAuthToken = "test-token";
    });
    const loadMetadata = spyOn(item, "loadMetadata").and.returnValue(
      Promise.resolve(Result.none())
    );
    const loadMapItems = spyOn(item, "loadMapItems").and.returnValue(
      Promise.resolve(Result.none())
    );

    await terria.workbench.add(item);

    expect(terria.isAuthenticated).toBe(true);
    expect(canAccessCatalogMember(item)).toBe(true);
    expect(loadMetadata).toHaveBeenCalled();
    expect(loadMapItems).toHaveBeenCalled();
    expect(terria.workbench.contains(item)).toBe(true);
  });

  it("hides private items until the user has the private permission", () => {
    item.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      CatalogPermissionLevel.Private
    );

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    runInAction(() => {
      terria.userProfile = "limited";
    });
    terria.configParameters.userProfilesDefinition = {
      limited: { allowed: [], isAdmin: false }
    };

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    terria.configParameters.userProfilesDefinition.limited.allowed.push(
      CatalogPermissionLevel.Private
    );

    expect(canAccessCatalogMember(item)).toBe(true);
    expect(isCatalogMemberVisible(item)).toBe(true);
  });

  it("removes private items from the visible workbench when permission is lost", () => {
    item.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      CatalogPermissionLevel.Private
    );
    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.workbench.items = [item];
    });

    expect(terria.workbench.items).toEqual([item]);

    runInAction(() => {
      terria.userAuthToken = undefined;
    });

    expect(terria.workbench.items).toEqual([]);
    expect(terria.workbench.itemIds).toEqual([]);
  });
});
