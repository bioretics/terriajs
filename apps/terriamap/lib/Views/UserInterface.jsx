import PropTypes from "prop-types";
import RelatedMaps from "terriajs/lib/ReactViews/RelatedMaps/RelatedMaps";
import { MenuLeft } from "terriajs/lib/ReactViews/StandardUserInterface/customizable/Groups";
import MenuItem from "terriajs/lib/ReactViews/StandardUserInterface/customizable/MenuItem";
import StandardUserInterface from "terriajs/lib/ReactViews/StandardUserInterface/StandardUserInterface";
import packageJson from "../../package.json";
import version from "../../version";

export const TerriaUserInterface = ({ terria, viewState, themeOverrides }) => {
  // Print version to console
  console.log("rer3d-map v." + packageJson.version);

  const relatedMaps = viewState.terria.configParameters.relatedMaps;
  const aboutButtonHrefUrl =
    viewState.terria.configParameters.aboutButtonHrefUrl;

  return (
    <StandardUserInterface
      terria={terria}
      viewState={viewState}
      themeOverrides={themeOverrides}
      version={version}
    >
      <MenuLeft>
        {viewState.terria.configParameters.userProfileLoginServiceUrl ? (
          <MenuItem
            target="_self"
            key="login-link"
            caption={!viewState.terria.userProfile ? "Login" : "Logout"}
            href={
              !viewState.terria.userProfile
                ? viewState.terria.configParameters.userProfileLoginServiceUrl +
                  document.baseURI
                : document.baseURI
            }
          />
        ) : null}
        {aboutButtonHrefUrl ? (
          <MenuItem
            caption="About"
            href={aboutButtonHrefUrl}
            key="about-link"
          />
        ) : null}
        {relatedMaps && relatedMaps.length > 0 ? (
          <RelatedMaps relatedMaps={relatedMaps} />
        ) : null}
      </MenuLeft>
    </StandardUserInterface>
  );
};

TerriaUserInterface.propTypes = {
  terria: PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
  themeOverrides: PropTypes.object
};
