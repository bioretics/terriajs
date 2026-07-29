import i18next from "i18next";
import { runInAction } from "mobx";
import { BaseModel } from "../Definition/Model";
import type Terria from "../Terria";

/**
 * Permission levels supported by catalogue members.
 *
 * Add a value here and a corresponding policy to `catalogAccessPolicies` when
 * introducing a new access requirement.
 */
export enum CatalogPermissionLevel {
  Unauthenticated = "unauthenticated",
  Authenticated = "authenticated"
}

interface CatalogAccessPolicy {
  isAllowed(terria: Terria): boolean;
  deniedMessage: {
    title: string;
    message: string;
  };
}

/**
 * The single policy table for catalogue-member access. Keeping the policy
 * separate from the traits lets new access levels use a different
 * authentication or authorisation check without changing catalogue UI code.
 */
const catalogAccessPolicies: Record<
  CatalogPermissionLevel,
  CatalogAccessPolicy
> = {
  [CatalogPermissionLevel.Unauthenticated]: {
    isAllowed: () => true,
    deniedMessage: {
      title: "",
      message: ""
    }
  },
  [CatalogPermissionLevel.Authenticated]: {
    isAllowed: (terria) => terria.isAuthenticated,
    deniedMessage: {
      title: "access.authenticationRequiredTitle",
      message: "access.authenticationRequiredMessage"
    }
  }
};

/**
 * Returns the configured level for a member. Omitting `permissionLevel` keeps a
 * catalogue item publicly accessible.
 */
export function getCatalogPermissionLevel(item: BaseModel): string {
  return (
    (item as BaseModel & { permissionLevel?: string }).permissionLevel ??
    CatalogPermissionLevel.Unauthenticated
  );
}

export function canAccessCatalogMember(item: BaseModel): boolean {
  const policy =
    catalogAccessPolicies[
      getCatalogPermissionLevel(item) as CatalogPermissionLevel
    ];

  // An unrecognised configured level must not accidentally grant access.
  return policy?.isAllowed(item.terria) ?? false;
}

/** Shows the plain-language denial message configured for the access level. */
export function showCatalogAccessDeniedMessage(item: BaseModel) {
  const policy =
    catalogAccessPolicies[
      getCatalogPermissionLevel(item) as CatalogPermissionLevel
    ];
  const title = policy?.deniedMessage.title ?? "access.accessDeniedTitle";
  const message = policy?.deniedMessage.message ?? "access.accessDeniedMessage";

  runInAction(() => {
    item.terria.messageModal = {
      isVisible: true,
      header: i18next.t(title),
      message: i18next.t(message)
    };
  });
}

/**
 * Checks access and informs the user when access is denied. All catalogue
 * entry points use this before they create a request or alter the workbench.
 */
export function ensureCatalogMemberAccess(item: BaseModel): boolean {
  if (canAccessCatalogMember(item)) return true;

  showCatalogAccessDeniedMessage(item);
  return false;
}
