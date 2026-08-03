import { runInAction } from "mobx";
import Result from "../../../lib/Core/Result";
import {
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
    item.setTrait(CommonStrata.definition, "permissionLevel", "authenticated");
  });

  it("defaults catalogue items to public access when permissionLevel is omitted", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    expect(canAccessCatalogMember(publicItem)).toBe(true);
  });

  it("does not hide public or unauthenticated items", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);
    publicItem.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);

    const unauthenticatedItem = new WebMapServiceCatalogItem(
      "unauthenticated-item",
      terria
    );
    unauthenticatedItem.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      "unauthenticated"
    );
    unauthenticatedItem.setTrait(
      CommonStrata.definition,
      "hideWhenUnauthorized",
      true
    );

    expect(isCatalogMemberVisible(publicItem)).toBe(true);
    expect(isCatalogMemberVisible(unauthenticatedItem)).toBe(true);
  });

  it("does not preview or load a protected item for an unauthenticated user", async () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        }
      };
    });
    const loadMapItems = spyOn(item, "loadMapItems").and.callThrough();

    const result = await viewState.viewCatalogMember(item);

    expect(result.error).toBeUndefined();
    expect(loadMapItems).not.toHaveBeenCalled();
    expect(viewState.previewedItem).toBeUndefined();
    expect(terria.messageModal?.isVisible).toBe(true);
  });

  it("does not add or load a protected item for an unauthenticated user", async () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        }
      };
    });
    const loadMapItems = spyOn(item, "loadMapItems").and.callThrough();

    await terria.workbench.add(item);

    expect(terria.workbench.contains(item)).toBe(false);
    expect(loadMapItems).not.toHaveBeenCalled();
    expect(terria.messageModal?.isVisible).toBe(true);
  });

  it("allows an authenticated user to add a protected item", async () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        }
      };
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
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        private: {
          requiresAuth: true,
          requiredPermission: "private"
        }
      };
    });
    item.setTrait(CommonStrata.definition, "permissionLevel", "private");
    item.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    runInAction(() => {
      terria.userProfile = "limited";
      terria.configParameters.userProfilesDefinition = {
        limited: { allowed: [], isAdmin: false }
      };
    });

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    terria.configParameters.userProfilesDefinition!.limited.allowed.push(
      "private"
    );

    expect(canAccessCatalogMember(item)).toBe(true);
    expect(isCatalogMemberVisible(item)).toBe(true);
  });

  it("removes authenticated and private items from the workbench when access is lost", () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        },
        private: {
          requiresAuth: true,
          requiredPermission: "private"
        }
      };
    });

    const privateItem = new WebMapServiceCatalogItem("private-item", terria);
    privateItem.setTrait(CommonStrata.definition, "permissionLevel", "private");
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.workbench.items = [item, privateItem, publicItem];
    });

    expect(terria.workbench.contains(item)).toBe(true);
    expect(terria.workbench.contains(privateItem)).toBe(true);
    expect(terria.workbench.contains(publicItem)).toBe(true);

    runInAction(() => {
      terria.userAuthToken = undefined;
    });

    expect(terria.workbench.contains(item)).toBe(false);
    expect(terria.workbench.contains(privateItem)).toBe(false);
    expect(terria.workbench.contains(publicItem)).toBe(true);
    expect(terria.workbench.items).toEqual([publicItem]);
    expect(terria.workbench.itemIds).toEqual(["public-item"]);
  });

  it("removes private items when the required permission is revoked", () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        },
        private: {
          requiresAuth: true,
          requiredPermission: "private"
        }
      };
    });

    const privateItem = new WebMapServiceCatalogItem("private-item", terria);
    privateItem.setTrait(CommonStrata.definition, "permissionLevel", "private");
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    runInAction(() => {
      terria.userProfile = "limited";
      terria.configParameters.userProfilesDefinition = {
        limited: { allowed: ["private"], isAdmin: false }
      };
      terria.workbench.items = [privateItem, publicItem, item];
    });

    expect(terria.workbench.contains(privateItem)).toBe(true);
    expect(terria.workbench.contains(item)).toBe(true);
    expect(terria.workbench.contains(publicItem)).toBe(true);

    runInAction(() => {
      terria.configParameters.userProfilesDefinition!.limited.allowed = [];
    });

    expect(terria.workbench.contains(privateItem)).toBe(false);
    expect(terria.workbench.contains(item)).toBe(true);
    expect(terria.workbench.contains(publicItem)).toBe(true);
  });

  it("lets each member choose whether an unavailable custom level is hidden", () => {
    runInAction(() => {
      terria.configParameters.catalogAccessPolicies = {
        authenticated: {
          requiresAuth: true
        },
        partner: {
          requiresAuth: true,
          requiredPermission: "partner"
        }
      };
    });

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(true);

    const hiddenPartnerItem = new WebMapServiceCatalogItem(
      "hidden-partner-item",
      terria
    );
    hiddenPartnerItem.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      "partner"
    );
    hiddenPartnerItem.setTrait(
      CommonStrata.definition,
      "hideWhenUnauthorized",
      true
    );
    const visiblePartnerItem = new WebMapServiceCatalogItem(
      "visible-partner-item",
      terria
    );
    visiblePartnerItem.setTrait(
      CommonStrata.definition,
      "permissionLevel",
      "partner"
    );

    expect(canAccessCatalogMember(hiddenPartnerItem)).toBe(false);
    expect(canAccessCatalogMember(visiblePartnerItem)).toBe(false);
    expect(isCatalogMemberVisible(hiddenPartnerItem)).toBe(false);
    expect(isCatalogMemberVisible(visiblePartnerItem)).toBe(true);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "partner-user";
      terria.configParameters.userProfilesDefinition = {
        "partner-user": { allowed: ["partner"], isAdmin: false }
      };
    });

    expect(canAccessCatalogMember(item)).toBe(true);
    expect(canAccessCatalogMember(hiddenPartnerItem)).toBe(true);
    expect(canAccessCatalogMember(visiblePartnerItem)).toBe(true);
    expect(isCatalogMemberVisible(hiddenPartnerItem)).toBe(true);
  });
});
