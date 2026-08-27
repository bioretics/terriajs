import CatalogMemberTraits from "./CatalogMemberTraits";
import GroupTraits from "./GroupTraits";
import mixTraits from "../mixTraits";
import primitiveTrait from "../Decorators/primitiveTrait";

/**
 * `allowedGroups` / `hideWhenUnauthorized` come from CatalogMemberTraits.
 * `useAuthentication` is declared here so plain `type: "group"` catalogues can
 * set it (OGC groups already get it via GetCapabilitiesTraits).
 */
export default class CatalogGroupTraits extends mixTraits(
  GroupTraits,
  CatalogMemberTraits
) {
  @primitiveTrait({
    type: "boolean",
    name: "Use authentication",
    description:
      "If true, members may inherit use of the configured authentication method when they do not set `useAuthentication` themselves."
  })
  useAuthentication?: boolean;
}
