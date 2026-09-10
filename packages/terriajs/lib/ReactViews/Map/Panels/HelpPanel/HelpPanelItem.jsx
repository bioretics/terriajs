import { observer } from "mobx-react";
import PropTypes from "prop-types";
import { Component } from "react";
import { withTranslation } from "react-i18next";
import styled, { withTheme } from "styled-components";
import {
  Category,
  HelpAction
} from "../../../../Core/Analytics/analyticEvents";
import { isJsonString } from "../../../../Core/Json";
import Icon, { StyledIcon } from "../../../../Styled/Icon";
import Text from "../../../../Styled/Text";
import { applyTranslationIfExists } from "../../../../Language/languageHelpers";
import HelpVideoPanel from "./HelpVideoPanel";

@observer
class HelpPanelItem extends Component {
  static displayName = "HelpPanelItem";

  static propTypes = {
    terria: PropTypes.object.isRequired,
    viewState: PropTypes.object.isRequired,
    content: PropTypes.object.isRequired,
    theme: PropTypes.object,
    t: PropTypes.func.isRequired,
    i18n: PropTypes.object.isRequired
  };

  render() {
    const { i18n } = this.props;

    const itemSelected =
      this.props.viewState.selectedHelpMenuItem === this.props.content.itemName;

    // `content.icon` is user defined and can possibly force the UI to lookup a
    // nonexistant icon.
    const title = isJsonString(this.props.content.title)
      ? applyTranslationIfExists(this.props.content.title, i18n)
      : "";
    const paneMode = this.props.content.paneMode;
    const opensInPanel = paneMode !== "externalLink";
    const iconGlyph = opensInPanel
      ? Icon.GLYPHS.right
      : Icon.GLYPHS.externalLink;
    return (
      <ItemRoot>
        <MenuButton
          type="button"
          $isSelected={itemSelected}
          role={paneMode === "externalLink" ? "link" : undefined}
          onClick={() => {
            this.props.terria.analytics.logEvent(
              Category.help,
              HelpAction.itemSelected,
              title
            );
            if (opensInPanel) {
              this.props.viewState.selectHelpMenuItem(
                this.props.content.itemName
              );
            } else if (paneMode === "externalLink" && this.props.content.url) {
              window.open(this.props.content.url);
            }
          }}
        >
          <MenuItemText>{title}</MenuItemText>
          <StyledIcon styledWidth={"12px"} glyph={iconGlyph} />
        </MenuButton>
        {opensInPanel && (
          <HelpVideoPanel
            terria={this.props.terria}
            viewState={this.props.viewState}
            content={this.props.content}
            itemString={this.props.content.itemName}
            paneMode={this.props.content.paneMode}
            markdownContent={this.props.content.markdownText}
            videoUrl={
              isJsonString(this.props.content.videoUrl)
                ? applyTranslationIfExists(this.props.content.videoUrl, i18n)
                : undefined
            }
            placeholderImage={
              isJsonString(this.props.content.placeholderImage)
                ? applyTranslationIfExists(
                    this.props.content.placeholderImage,
                    i18n
                  )
                : undefined
            }
            videoCoverImageOpacity={this.props.content.videoCoverImageOpacity}
          />
        )}
      </ItemRoot>
    );
  }
}

const ItemRoot = styled.div`
  &:last-child > button {
    border-bottom: 0;
  }
`;

const MenuButton = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 8px;
  border: 0;
  border-bottom: 1px solid ${(p) => p.theme.border};
  border-radius: ${(p) => p.theme.radiusMedium};
  background: ${(p) => (p.$isSelected ? p.theme.accent : "transparent")};
  color: ${(p) =>
    p.$isSelected ? p.theme.textLight : p.theme.mutedForeground};
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  & ${StyledIcon} {
    fill: currentColor;
    flex-shrink: 0;
  }

  &:hover,
  &:focus-visible {
    background: ${(p) => p.theme.accent};
    color: ${(p) => p.theme.textLight};
  }
`;

const MenuItemText = styled(Text).attrs({
  semiBold: true,
  medium: true
})`
  text-align: left;
  color: inherit;
`;

export default withTranslation()(withTheme(HelpPanelItem));
