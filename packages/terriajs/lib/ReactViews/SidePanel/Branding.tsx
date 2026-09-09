import { observer } from "mobx-react";
import { Fragment } from "react";
import isDefined from "../../Core/isDefined";
import ViewState from "../../ReactViewModels/ViewState";
import parseCustomHtmlToReact from "../Custom/parseCustomHtmlToReact";
import { useViewState, withViewState } from "../Context";
import { useTheme } from "styled-components";

const DEFAULT_BRANDING =
  '<a target="_blank" href="http://terria.io"><img src="images/terria_logo.png" height="52" title="Version: {{ version }}" /></a>';

interface BrandingProps {
  viewState: ViewState;
  version?: string;
  /**
   * Show the reduced logo set (brandBarSmallElements / displayOneBrand) at the
   * small logo height. Used by the docked top toolbar, which has room for one
   * mark rather than a full brand bar.
   */
  compact?: boolean;
}

export default withViewState(
  observer((props: BrandingProps) => {
    const viewState = useViewState();
    const theme = useTheme();

    // Set brandingHtmlElements to brandBarElements or default Terria branding as default
    let brandingHtmlElements = props.viewState.terria.configParameters
      .brandBarElements ?? [DEFAULT_BRANDING];

    const useSmallBranding = viewState.useSmallScreenInterface || props.compact;

    if (useSmallBranding) {
      const brandBarSmallElements =
        props.viewState.terria.configParameters.brandBarSmallElements;
      const displayOne =
        props.viewState.terria.configParameters.displayOneBrand;

      // Use brandBarSmallElements if it exists
      if (brandBarSmallElements) brandingHtmlElements = brandBarSmallElements;
      // If no brandBarSmallElements, but displayOne parameter is selected
      // Try to find brand element based on displayOne index - OR find the first item that isn't an empty string (for backward compatability of old terriamap defaults)
      else if (isDefined(displayOne))
        brandingHtmlElements = [
          (brandingHtmlElements[displayOne] ||
            brandingHtmlElements.find((item) => item.length > 0)) ??
            DEFAULT_BRANDING
        ];
      // Fall back to the first non-empty element so the toolbar never shows
      // the full brand bar.
      else if (props.compact && brandingHtmlElements.length > 1)
        brandingHtmlElements = [
          brandingHtmlElements.find((item) => item.length > 0) ??
            DEFAULT_BRANDING
        ];
    }

    const logoHeight = useSmallBranding
      ? theme.logoSmallHeight
      : theme.logoHeight;

    const version = props.version ?? "Unknown";
    return (
      <div
        className="drag-handle"
        css={`
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;

          box-sizing: border-box;

          width: auto;
          height: ${logoHeight};

          overflow: hidden;

          a {
            display: flex;
            height: 100%;
            -webkit-box-align: center;
            align-items: center;
            -webkit-box-pack: center;
            justify-content: center;
          }
          span {
            display: block;
          }
          /* Config supplies raw <img height="52">, so constrain it to the
             available bar height rather than its intrinsic size. */
          img {
            height: 100%;
            max-height: 100%;
            width: auto;
            max-width: 100%;
            object-fit: contain;
          }

          font-family: ${(p: any) => p.theme.fontPop};

          padding: ${(p: any) => p.theme.logoPaddingHorizontal}
            ${(p: any) => p.theme.logoPaddingVertical};

          @media (max-width: ${(p: any) => p.theme.sm}px) {
            height: ${(p: any) => p.theme.logoSmallHeight};

            padding: ${(p: any) => p.theme.logoSmallPaddingHorizontal}
              ${(p: any) => p.theme.logoSmallPaddingVertical};
          }
        `}
      >
        {brandingHtmlElements.map((element, idx) => (
          <Fragment key={idx}>
            {parseCustomHtmlToReact(
              element.replace(/\{\{\s*version\s*\}\}/g, version),
              { disableExternalLinkIcon: true }
            )}
          </Fragment>
        ))}
      </div>
    );
  })
);
