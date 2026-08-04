import i18next from "i18next";
import { runInAction } from "mobx";
import { BaseModel } from "../Definition/Model";
import type Terria from "../Terria";

/** Config shape for a single catalogue access level. */
export interface CatalogAccessPolicyConfig {
  requiresAuth: boolean;
  requiredPermission?: string;
  default?: boolean;
}

type CatalogAccessControlledMember = BaseModel & {
  permissionLevel?: string;
  hideWhenUnauthorized?: boolean;
};

function getCatalogAccessPolicyConfig(
  terria: Terria,
  level: string
): CatalogAccessPolicyConfig | undefined {
  return terria.configParameters.catalogAccessPolicies?.[level];
}

/**
 * Returns the policy key that should behave as the public/default level.
 * Falls back to `unauthenticated` for deployments that do not mark one.
 */
function getDefaultCatalogAccessPolicyLevel(terria: Terria): string {
  const defaultLevel = Object.entries(
    terria.configParameters.catalogAccessPolicies ?? {}
  ).find(([, policy]) => policy.default)?.[0];

  return defaultLevel ?? "unauthenticated";
}

function isAllowedByPolicy(
  terria: Terria,
  policy: CatalogAccessPolicyConfig
): boolean {
  if (policy.requiredPermission) {
    return terria.hasPermission(policy.requiredPermission);
  }
  if (policy.requiresAuth) {
    return terria.isAuthenticated;
  }
  return true;
}

/**
 * Returns the configured level for a member. Omitting `permissionLevel` keeps a
 * catalogue item publicly accessible (no policy lookup).
 */
export function getCatalogPermissionLevel(item: BaseModel): string | undefined {
  const permissionLevel = (item as CatalogAccessControlledMember)
    .permissionLevel;
  if (permissionLevel) return permissionLevel;

  // A dereferenced item inherits the level configured on its reference.
  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogPermissionLevel(sourceReference);
  }

  return undefined;
}

/**
 * Returns whether a member opts into being hidden when its permission level is
 * unavailable. A dereferenced item inherits this setting from its reference.
 */
export function getCatalogMemberHideWhenUnauthorized(item: BaseModel): boolean {
  const hideWhenUnauthorized = (item as CatalogAccessControlledMember)
    .hideWhenUnauthorized;
  if (hideWhenUnauthorized !== undefined) return hideWhenUnauthorized;

  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogMemberHideWhenUnauthorized(sourceReference);
  }

  return false;
}

export function canAccessCatalogMember(item: BaseModel): boolean {
  const level = getCatalogPermissionLevel(item);
  // No permissionLevel → public.
  if (!level) return true;

  const policy = getCatalogAccessPolicyConfig(item.terria, level);

  // An unrecognised / unconfigured level must not accidentally grant access.
  return policy ? isAllowedByPolicy(item.terria, policy) : false;
}

/**
 * Returns whether a catalogue member may be shown in UI listings. Permission
 * levels which are merely gated remain visible and show an access message. A
 * member can instead opt into being hidden with its `hideWhenUnauthorized`
 * trait. Public members and the config-marked default level are always visible.
 */
export function isCatalogMemberVisible(item: BaseModel): boolean {
  const level = getCatalogPermissionLevel(item);
  if (!level || level === getDefaultCatalogAccessPolicyLevel(item.terria)) {
    return true;
  }

  return (
    !getCatalogMemberHideWhenUnauthorized(item) || canAccessCatalogMember(item)
  );
}

/**
 * Shows the denial message for a catalogue member. Message copy depends on
 * whether the member is hidden when unauthorized.
 */
export function showCatalogAccessDeniedMessage(item: BaseModel) {
  const hideWhenUnauthorized = getCatalogMemberHideWhenUnauthorized(item);
  const title = hideWhenUnauthorized
    ? "access.accessDeniedTitle"
    : "access.authenticationRequiredTitle";
  const message = hideWhenUnauthorized
    ? "access.accessDeniedMessage"
    : "access.authenticationRequiredMessage";

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
