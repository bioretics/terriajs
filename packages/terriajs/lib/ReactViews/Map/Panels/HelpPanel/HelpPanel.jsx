import { runInAction } from "mobx";
import { observer } from "mobx-react";
import PropTypes from "prop-types";
import { Component } from "react";
import { withTranslation } from "react-i18next";
import styled, { withTheme } from "styled-components";
import {
  Category,
  HelpAction
} from "../../../../Core/Analytics/analyticEvents";
import Box from "../../../../Styled/Box";
import Button from "../../../../Styled/Button";
import Icon, { StyledIcon } from "../../../../Styled/Icon";
import Text from "../../../../Styled/Text";
import { withViewState } from "../../../Context";
import parseCustomMarkdownToReact from "../../../Custom/parseCustomMarkdownToReact";
import { PanelIconButton } from "../../../SidePanel/SidePanel";
import HelpPanelItem from "./HelpPanelItem";

export const HELP_PANEL_ID = "help";

const PANEL_WIDTH = 320;
const VIDEO_PANEL_WIDTH = 490;

const PanelWrapper = styled.div`
  position: fixed;
  top: ${(p) => p.theme.topToolbarHeight}px;
  bottom: ${(p) => p.theme.statusBarHeight}px;
  right: ${(p) => p.$offsetRight}px;
  width: ${PANEL_WIDTH}px;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;

  background: ${(p) => p.theme.card};
  border-left: 1px solid ${(p) => p.theme.border};
  box-shadow: ${(p) => p.theme.shadowLg};
  color: ${(p) => p.theme.textLight};
  font-family: ${(p) => p.theme.fontBase};

  z-index: ${(p) => (p.$isTopElement ? 99999 : 110)};
  transition: right 0.25s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 830px) {
    right: ${(p) => (p.$offsetRight < 0 ? -PANEL_WIDTH : 0)}px;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid ${(p) => p.theme.border};
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-family: ${(p) => p.theme.fontBase};
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: ${(p) => p.theme.textLight};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PanelBody = styled(Box).attrs({ column: true, scroll: true })`
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
`;

const IntroSection = styled.div`
  flex: 0 0 auto;
  padding: 16px 12px;
  border-bottom: 1px solid ${(p) => p.theme.border};
`;

const IntroText = styled(Text)`
  color: ${(p) => p.theme.mutedForeground};
  font-size: 12px;
  line-height: 18px;

  p {
    margin: 0 0 8px;
  }
  p:last-child {
    margin-bottom: 0;
  }
`;

const TourButton = styled(Button)`
  margin-top: 16px;
  border-radius: ${(p) => p.theme.radiusMedium};
  font-weight: 600;
`;

const MenuList = styled.div`
  flex: 0 0 auto;
  padding: 0 12px;
`;

@observer
class HelpPanel extends Component {
  static displayName = "HelpPanel";

  static propTypes = {
    viewState: PropTypes.object.isRequired,
    theme: PropTypes.object,
    t: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);
    this.state = {
      isAnimatingOpen: true
    };
  }

  componentDidMount() {
    // The animation timing is controlled in the CSS so the timeout can be 0 here.
    setTimeout(() => this.setState({ isAnimatingOpen: false }), 0);
  }

  componentWillUnmount() {
    // Make sure that retainSharePanel is set to false. This property is used to temporarily disable closing when Share Panel loses focus.
    // If the Share Panel is open underneath help panel, we now want to allow it to close normally.
    setTimeout(() => {
      this.props.viewState.setRetainSharePanel(false);
    }, 500); // We need to re-enable closing of share panel when loses focus.
  }

  render() {
    const { t } = this.props;
    const helpItems = this.props.viewState.terria.configParameters.helpContent;
    const isExpanded = this.props.viewState.helpPanelExpanded;
    const isAnimatingOpen = this.state.isAnimatingOpen;
    const offsetRight = isAnimatingOpen
      ? -PANEL_WIDTH
      : isExpanded
        ? VIDEO_PANEL_WIDTH
        : 0;
    return (
      <PanelWrapper
        $offsetRight={offsetRight}
        $isTopElement={this.props.viewState.topElement === "HelpPanel"}
        onClick={() => this.props.viewState.setTopElement("HelpPanel")}
      >
        <PanelHeader>
          <HeaderTitle title={t(($) => $.helpPanel.menuPaneTitle)}>
            {t(($) => $.helpPanel.menuPaneTitle)}
          </HeaderTitle>
          <PanelIconButton
            type="button"
            onClick={() => this.props.viewState.hideHelpPanel()}
            title={t(($) => $.general.close)}
            aria-label="Close help panel"
          >
            <StyledIcon glyph={Icon.GLYPHS.closeLight} />
          </PanelIconButton>
        </PanelHeader>
        <PanelBody>
          <IntroSection>
            <IntroText highlightLinks>
              {parseCustomMarkdownToReact(
                t(($) => $.helpPanel.menuPaneBody, {
                  supportEmail: this.props.viewState.terria.supportEmail
                })
              )}
            </IntroText>
            <TourButton
              primary
              shortMinHeight
              fullWidth
              onClick={() => {
                this.props.viewState.terria.analytics.logEvent(
                  Category.help,
                  HelpAction.takeTour
                );
                runInAction(() => {
                  this.props.viewState.hideHelpPanel();
                  this.props.viewState.setTourIndex(0);
                });
              }}
              renderIcon={() => (
                <StyledIcon
                  light
                  styledWidth={"16px"}
                  glyph={Icon.GLYPHS.tour}
                />
              )}
              textProps={{
                medium: true
              }}
            >
              {t(($) => $.helpPanel.takeTour)}
            </TourButton>
          </IntroSection>
          <MenuList>
            {helpItems &&
              helpItems.map((item, i) => (
                <HelpPanelItem
                  key={i}
                  terria={this.props.viewState.terria}
                  viewState={this.props.viewState}
                  content={item}
                />
              ))}
          </MenuList>
        </PanelBody>
      </PanelWrapper>
    );
  }
}

export default withTranslation()(withViewState(withTheme(HelpPanel)));
