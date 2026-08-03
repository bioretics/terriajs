import i18next from "i18next";
import { runInAction } from "mobx";
import { BaseModel } from "../Definition/Model";
import type Terria from "../Terria";

/**
 * Common permission level names used by this deployment's catalogue. These are
 * only string constants — the authoritative set of levels and their behaviour
 * lives in `configParameters.catalogAccessPolicies` (from config.json). Add or
 * rename levels there freely; catalogue members reference them by string via
 * the `permissionLevel` trait.
 */
export enum CatalogPermissionLevel {
  Unauthenticated = "unauthenticated",
  Authenticated = "authenticated",
  Private = "private"
}

/** Config shape for a single catalogue access level. */
export interface CatalogAccessPolicyConfig {
  requiresAuth: boolean;
  requiredPermission?: string;
  hideWhenUnauthorized: boolean;
  deniedMessage?: {
    title: string;
    message: string;
  };
}

function getCatalogAccessPolicyConfig(
  terria: Terria,
  level: string
): CatalogAccessPolicyConfig | undefined {
  return terria.configParameters.catalogAccessPolicies?.[level];
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

  return undefined;
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
 * levels which are merely gated remain visible and show an access message;
 * levels with `hideWhenUnauthorized` are hidden instead.
 */
export function isCatalogMemberVisible(item: BaseModel): boolean {
  const level = getCatalogPermissionLevel(item);
  if (!level) return true;

  const policy = getCatalogAccessPolicyConfig(item.terria, level);

  // Unknown levels fail closed: they cannot unexpectedly expose a member.
  return policy
    ? isAllowedByPolicy(item.terria, policy) || !policy.hideWhenUnauthorized
    : false;
}

/** Shows the plain-language denial message configured for the access level. */
export function showCatalogAccessDeniedMessage(item: BaseModel) {
  const level = getCatalogPermissionLevel(item);
  const policy = level
    ? getCatalogAccessPolicyConfig(item.terria, level)
    : undefined;
  const title = policy?.deniedMessage?.title ?? "access.accessDeniedTitle";
  const message =
    policy?.deniedMessage?.message ?? "access.accessDeniedMessage";

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
