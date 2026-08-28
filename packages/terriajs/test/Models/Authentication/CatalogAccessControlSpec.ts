import { runInAction } from "mobx";
import Result from "../../../lib/Core/Result";
import {
  canAccessCatalogMember,
  getCatalogAllowedGroups,
  getCatalogMemberHideWhenUnauthorized,
  getCatalogUseAuthentication,
  isCatalogMemberVisible
} from "../../../lib/Models/Authentication/CatalogAccessControl";
import CatalogGroup from "../../../lib/Models/Catalog/CatalogGroup";
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
    item.setTrait(CommonStrata.definition, "allowedGroups", ["regione"]);
  });

  it("defaults catalogue items to public access when allowedGroups is omitted", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    expect(canAccessCatalogMember(publicItem)).toBe(true);
  });

  it("denies access when allowedGroups is an empty array", () => {
    item.setTrait(CommonStrata.definition, "allowedGroups", []);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "regione";
    });

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(true);
  });

  it("does not hide public items even with hideWhenUnauthorized", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);
    publicItem.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);

    expect(isCatalogMemberVisible(publicItem)).toBe(true);
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

  it("allows an authenticated user whose group is allowed to add a protected item", async () => {
    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "regione";
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

  it("denies an authenticated user whose group is not allowed", () => {
    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "basic";
    });

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(true);
  });

  it("denies an authenticated user with no group", () => {
    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = undefined;
    });

    expect(canAccessCatalogMember(item)).toBe(false);
  });

  it("hides restricted items with hideWhenUnauthorized until the user has an allowed group", () => {
    item.setTrait(CommonStrata.definition, "allowedGroups", ["admin"]);
    item.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "basic";
    });

    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(false);

    runInAction(() => {
      terria.userProfile = "admin";
    });

    expect(canAccessCatalogMember(item)).toBe(true);
    expect(isCatalogMemberVisible(item)).toBe(true);
  });

  it("removes items when the user's group no longer matches allowedGroups", () => {
    const adminItem = new WebMapServiceCatalogItem("admin-item", terria);
    adminItem.setTrait(CommonStrata.definition, "allowedGroups", ["admin"]);
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "admin";
      terria.workbench.items = [adminItem, publicItem, item];
    });

    // item requires regione; with admin profile the reaction drops it.
    expect(terria.workbench.contains(adminItem)).toBe(true);
    expect(terria.workbench.contains(item)).toBe(false);
    expect(terria.workbench.contains(publicItem)).toBe(true);

    runInAction(() => {
      terria.userProfile = "regione";
    });

    expect(terria.workbench.contains(adminItem)).toBe(false);
    expect(terria.workbench.contains(publicItem)).toBe(true);
  });

  it("removes restricted items from the workbench when access is lost", () => {
    const publicItem = new WebMapServiceCatalogItem("public-item", terria);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "regione";
      terria.workbench.items = [item, publicItem];
    });

    expect(terria.workbench.contains(item)).toBe(true);
    expect(terria.workbench.contains(publicItem)).toBe(true);

    runInAction(() => {
      terria.userAuthToken = undefined;
      terria.userProfile = undefined;
    });

    expect(terria.workbench.contains(item)).toBe(false);
    expect(terria.workbench.contains(publicItem)).toBe(true);
    expect(terria.workbench.items).toEqual([publicItem]);
    expect(terria.workbench.itemIds).toEqual(["public-item"]);
  });

  it("lets each member choose whether an unavailable group restriction is hidden", () => {
    expect(canAccessCatalogMember(item)).toBe(false);
    expect(isCatalogMemberVisible(item)).toBe(true);

    const hiddenPartnerItem = new WebMapServiceCatalogItem(
      "hidden-partner-item",
      terria
    );
    hiddenPartnerItem.setTrait(CommonStrata.definition, "allowedGroups", [
      "partner"
    ]);
    hiddenPartnerItem.setTrait(
      CommonStrata.definition,
      "hideWhenUnauthorized",
      true
    );
    const visiblePartnerItem = new WebMapServiceCatalogItem(
      "visible-partner-item",
      terria
    );
    visiblePartnerItem.setTrait(CommonStrata.definition, "allowedGroups", [
      "partner"
    ]);

    expect(canAccessCatalogMember(hiddenPartnerItem)).toBe(false);
    expect(canAccessCatalogMember(visiblePartnerItem)).toBe(false);
    expect(isCatalogMemberVisible(hiddenPartnerItem)).toBe(false);
    expect(isCatalogMemberVisible(visiblePartnerItem)).toBe(true);

    runInAction(() => {
      terria.userAuthToken = "test-token";
      terria.userProfile = "partner";
    });

    expect(canAccessCatalogMember(hiddenPartnerItem)).toBe(true);
    expect(canAccessCatalogMember(visiblePartnerItem)).toBe(true);
    expect(isCatalogMemberVisible(hiddenPartnerItem)).toBe(true);
  });
  describe("group inheritance", () => {
    let group: CatalogGroup;
    let child: WebMapServiceCatalogItem;

    beforeEach(() => {
      group = new CatalogGroup("protected-group", terria);
      child = new WebMapServiceCatalogItem("group-child-item", terria);
      terria.addModel(group);
      terria.addModel(child);
      group.setTrait(CommonStrata.definition, "members", [child.uniqueId!]);
      child.knownContainerUniqueIds.push(group.uniqueId!);
    });

    it("inherits allowedGroups and hideWhenUnauthorized from a parent group", () => {
      group.setTrait(CommonStrata.definition, "allowedGroups", ["regione"]);
      group.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);

      expect(getCatalogAllowedGroups(child)).toEqual(["regione"]);
      expect(getCatalogMemberHideWhenUnauthorized(child)).toBe(true);
      expect(canAccessCatalogMember(child)).toBe(false);
      expect(isCatalogMemberVisible(child)).toBe(false);
    });

    it("lets a child override inherited group access traits", () => {
      group.setTrait(CommonStrata.definition, "allowedGroups", ["regione"]);
      group.setTrait(CommonStrata.definition, "hideWhenUnauthorized", true);
      child.setTrait(CommonStrata.definition, "allowedGroups", ["admin"]);
      child.setTrait(CommonStrata.definition, "hideWhenUnauthorized", false);

      expect(getCatalogAllowedGroups(child)).toEqual(["admin"]);
      expect(getCatalogMemberHideWhenUnauthorized(child)).toBe(false);
    });

    it("inherits useAuthentication from a parent group unless overridden", () => {
      expect(getCatalogUseAuthentication(child)).toBe(false);
      group.setTrait(CommonStrata.definition, "useAuthentication", true);
      expect(getCatalogUseAuthentication(child)).toBe(true);
      child.setTrait(CommonStrata.definition, "useAuthentication", false);
      expect(getCatalogUseAuthentication(child)).toBe(false);
    });
  });
});
