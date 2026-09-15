"use strict";

/* eslint react/prop-types:0*/
import createReactClass from "create-react-class";
import classNames from "classnames";
import Icon from "../../../Styled/Icon";
import InnerPanel from "./InnerPanel";
import BaseOuterPanel from "./BaseOuterPanel";

import Styles from "./panel.scss";

import defined from "terriajs-cesium/Source/Core/defined";

const DropdownPanel = createReactClass({
  displayName: "DropdownPanel",
  mixins: [BaseOuterPanel],

  getInitialState() {
    return {
      localIsOpen: false,
      caretOffset: undefined,
      dropdownOffset: undefined
    };
  },

  onInnerMounted(innerElement) {
    if (innerElement) {
      const buttonElement = this.props.btnRef?.current || this.buttonElement;
      const buttonElementOffsetLeft = buttonElement?.offsetLeft || 0;
      const buttonElementClientWidth = buttonElement?.clientWidth || 0;
      const buttonElementScreenLeft =
        buttonElement?.getBoundingClientRect().left || 0;
      const panelWidth = innerElement.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportMargin = 5;

      let dropdownOffset;
      if (this.props.showDropdownInCenter) {
        dropdownOffset =
          buttonElementOffsetLeft +
          buttonElementClientWidth / 2 -
          panelWidth / 2;
      } else {
        dropdownOffset = buttonElementOffsetLeft;
        if (
          buttonElementScreenLeft + panelWidth + viewportMargin >
          viewportWidth
        ) {
          dropdownOffset =
            buttonElementOffsetLeft + buttonElementClientWidth - panelWidth;
        }
      }

      const panelScreenLeft = () =>
        buttonElementScreenLeft + (dropdownOffset - buttonElementOffsetLeft);
      const overflowRight =
        panelScreenLeft() + panelWidth + viewportMargin - viewportWidth;
      if (overflowRight > 0) {
        dropdownOffset -= overflowRight;
      }
      if (panelScreenLeft() < viewportMargin) {
        dropdownOffset += viewportMargin - panelScreenLeft();
      }

      // offset the caret to line up with the middle of the button - note that the caret offset is relative to the panel, whereas
      // the offsets for the button/panel are relative to their container.
      const caretOffset = Math.max(
        buttonElementClientWidth / 2 -
          10 -
          (dropdownOffset - buttonElementOffsetLeft),
        0
      );

      this.setState({
        caretOffset: caretOffset + "px",
        dropdownOffset: dropdownOffset + "px"
      });
    } else {
      this.setState({
        caretOffset: undefined,
        dropdownOffset: undefined
      });
    }
  },

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.forceClosed) {
      this.onDismissed();
    }
  },

  openWithUserClick(e) {
    if (this.props.userOnClick) {
      this.props.userOnClick();
    }
    this.openPanel(e);
  },

  render() {
    let iconGlyph;
    if (defined(Icon.GLYPHS[this.props.theme.icon])) {
      iconGlyph = Icon.GLYPHS[this.props.theme.icon];
    } else {
      iconGlyph = this.props.theme.icon;
    }

    return (
      <div className={classNames(Styles.panel, this.props.theme.outer)}>
        <button
          onClick={this.openWithUserClick}
          type="button"
          className={classNames(Styles.button, this.props.theme.btn, {
            [Styles.buttonForModalDropdown]: this.props.showDropdownAsModal
          })}
          title={this.props.btnTitle}
          ref={
            this.props.btnRef || ((element) => (this.buttonElement = element))
          }
          // eslint-disable-next-line react/no-unknown-property
          isOpen={this.isOpen()}
          css={`
            ${(p) =>
              p.isOpen &&
              `&:not(.foo) {
                background: ${p.theme.colorPrimary};
                svg {
                  fill: ${p.theme.textLight};
                }
              }`}
          `}
        >
          {this.props.theme.icon && <Icon glyph={iconGlyph} />}
          {this.props.btnText && <span>{this.props.btnText}</span>}
        </button>
        {this.isOpen() && (
          <InnerPanel
            // Centring is resolved above into a pixel offset that is kept
            // inside the viewport, so the CSS-only centring is not used.
            showDropdownAsModal={this.props.showDropdownAsModal}
            modalWidth={this.props.modalWidth}
            onDismissed={this.onDismissed}
            innerRef={this.onInnerMounted}
            doNotCloseFlag={this.getDoNotCloseFlag()}
            theme={this.props.theme}
            caretOffset={this.state.caretOffset}
            dropdownOffset={this.state.dropdownOffset}
            disableCloseOnFocusLoss={this.props.disableCloseOnFocusLoss}
            showCloseButton={this.props.showCloseButton}
          >
            {this.props.children}
          </InnerPanel>
        )}
      </div>
    );
  }
});

export default DropdownPanel;
