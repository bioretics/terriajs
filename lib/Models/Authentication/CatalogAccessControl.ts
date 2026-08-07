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
 * groups configured on its reference when the trait is missing.
 */
export function getCatalogAllowedGroups(item: BaseModel): string[] | undefined {
  const allowedGroups = (item as CatalogAccessControlledMember).allowedGroups;
  if (allowedGroups !== undefined) return allowedGroups;

  const sourceReference = item.sourceReference;
  if (sourceReference && sourceReference !== item) {
    return getCatalogAllowedGroups(sourceReference);
  }

  return undefined;
}

/**
 * Returns whether a member opts into being hidden when access is denied. A
 * dereferenced item inherits this setting from its reference.
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
