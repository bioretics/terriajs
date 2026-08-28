import CatalogMemberTraits from "./CatalogMemberTraits";
import GetCapabilitiesTraits from "./GetCapabilitiesTraits";
import GroupTraits from "./GroupTraits";
import mixTraits from "../mixTraits";

/** `allowedGroups` / `hideWhenUnauthorized` from CatalogMemberTraits; `useAuthentication` from GetCapabilitiesTraits. */
export default class CatalogGroupTraits extends mixTraits(
  GroupTraits,
  CatalogMemberTraits,
  GetCapabilitiesTraits
) {}
