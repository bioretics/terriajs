import i18next from "i18next";
import { runInAction } from "mobx";
import { BaseModel } from "../Definition/Model";

type CatalogAccessControlledMember = BaseModel & {
  allowedGroups?: string[];
  hideWhenUnauthorized?: boolean;
};

/**
 * Returns the configured allowed groups for a member. Omitting `allowedGroups`
 * keeps a catalogue item publicly accessible. A dereferenced item inherits the
 * groups configured on its reference when the trait is missing; a member also
 * inherits from its parent catalogue group. A member value overrides.
 */
export function getCatalogAllowedGroups(item: BaseModel): string[] | undefined {
  const allowedGroups = (item as CatalogAccessControlledMember).allowedGroups;
  if (allowedGroups !== undefined) return allowedGroups;

  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    const fromReference = getCatalogAllowedGroups(sourceReference);
    if (fromReference !== undefined) return fromReference;
  }

  for (const parentId of item.knownContainerUniqueIds) {
    const parent = item.terria.getModelById(BaseModel, parentId);
    if (!parent) continue;
    const fromParent = getCatalogAllowedGroups(parent);
    if (fromParent !== undefined) return fromParent;
  }

  return undefined;
}

/**
 * Returns whether a member opts into being hidden when access is denied. A
 * dereferenced item inherits this setting from its reference; a member also
 * inherits from its parent catalogue group when unset.
 */
export function getCatalogMemberHideWhenUnauthorized(item: BaseModel): boolean {
  const hideWhenUnauthorized = (item as CatalogAccessControlledMember)
    .hideWhenUnauthorized;
  if (hideWhenUnauthorized !== undefined) return hideWhenUnauthorized;

  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogMemberHideWhenUnauthorized(sourceReference);
  }

  for (const parentId of item.knownContainerUniqueIds) {
    const parent = item.terria.getModelById(BaseModel, parentId);
    if (parent) return getCatalogMemberHideWhenUnauthorized(parent);
  }

  return false;
}

/**
 * Returns whether authentication should be used for this member. Reads stratum
 * values only (ignores the false default) so a parent group's setting applies
 * when the member leaves the trait unset. Member overrides group.
 */
export function getCatalogUseAuthentication(item: BaseModel): boolean {
  const own = item.traits?.useAuthentication?.getValue(item);
  if (own !== undefined) return Boolean(own);

  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogUseAuthentication(sourceReference);
  }

  for (const parentId of item.knownContainerUniqueIds) {
    const parent = item.terria.getModelById(BaseModel, parentId);
    if (parent) return getCatalogUseAuthentication(parent);
  }

  return false;
}

export function canAccessCatalogMember(item: BaseModel): boolean {
  const allowedGroups = getCatalogAllowedGroups(item);
  // No allowedGroups → public.
  if (allowedGroups === undefined) return true;

  const { terria } = item;
  const userGroup = terria.userProfile;
  return (
    terria.isAuthenticated &&
    userGroup !== undefined &&
    allowedGroups.includes(userGroup)
  );
}

/**
 * Returns whether a catalogue member may be shown in UI listings. Restricted
 * members without `hideWhenUnauthorized` remain visible and show an access
 * message; members with `hideWhenUnauthorized` are hidden when access is denied.
 */
export function isCatalogMemberVisible(item: BaseModel): boolean {
  const allowedGroups = getCatalogAllowedGroups(item);
  if (allowedGroups === undefined) return true;

  return (
    !getCatalogMemberHideWhenUnauthorized(item) || canAccessCatalogMember(item)
  );
}

/** Shows the plain-language denial message for a blocked catalogue member. */
export function showCatalogAccessDeniedMessage(item: BaseModel) {
  const isAuthenticated = item.terria.isAuthenticated;
  const title = isAuthenticated
    ? "access.accessDeniedTitle"
    : "access.authenticationRequiredTitle";
  const message = isAuthenticated
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
