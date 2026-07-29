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
  Authenticated = "authenticated",
  Private = "private"
}

interface CatalogAccessPolicy {
  /** Determines whether the current user has the permission required by this level. */
  isAllowed(terria: Terria): boolean;
  /**
   * If true, users without the required permission must not be able to
   * discover the member in catalogue, add-data, or workbench UI.
   */
  hideWhenUnauthorized: boolean;
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
    hideWhenUnauthorized: false,
    deniedMessage: {
      title: "",
      message: ""
    }
  },
  [CatalogPermissionLevel.Authenticated]: {
    isAllowed: (terria) => terria.isAuthenticated,
    hideWhenUnauthorized: false,
    deniedMessage: {
      title: "access.authenticationRequiredTitle",
      message: "access.authenticationRequiredMessage"
    }
  },
  [CatalogPermissionLevel.Private]: {
    // A profile-aware deployment requires the "private" permission (or an
    // administrator profile). A basic-token deployment has no profiles, so
    // any authenticated user has this permission.
    isAllowed: (terria) => terria.hasPermission(CatalogPermissionLevel.Private),
    hideWhenUnauthorized: true,
    deniedMessage: {
      title: "access.accessDeniedTitle",
      message: "access.accessDeniedMessage"
    }
  }
};

/**
 * Returns the configured level for a member. Omitting `permissionLevel` keeps a
 * catalogue item publicly accessible.
 */
export function getCatalogPermissionLevel(item: BaseModel): string {
  const permissionLevel = (
    item as BaseModel & {
      permissionLevel?: string;
    }
  ).permissionLevel;
  if (permissionLevel) return permissionLevel;

  // A dereferenced item inherits the level configured on its reference.
  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogPermissionLevel(sourceReference);
  }

  return CatalogPermissionLevel.Unauthenticated;
}

export function canAccessCatalogMember(item: BaseModel): boolean {
  const policy =
    catalogAccessPolicies[
      getCatalogPermissionLevel(item) as CatalogPermissionLevel
    ];

  // An unrecognised configured level must not accidentally grant access.
  return policy?.isAllowed(item.terria) ?? false;
}

/**
 * Returns whether a catalogue member may be shown in UI listings. Permission
 * levels which are merely gated remain visible and show an access message;
 * levels with `hideWhenUnauthorized` are hidden instead.
 */
export function isCatalogMemberVisible(item: BaseModel): boolean {
  const policy =
    catalogAccessPolicies[
      getCatalogPermissionLevel(item) as CatalogPermissionLevel
    ];

  // Unknown levels fail closed: they cannot unexpectedly expose a member.
  return policy
    ? policy.isAllowed(item.terria) || !policy.hideWhenUnauthorized
    : false;
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
