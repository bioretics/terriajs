import { ReactNode, RefObject, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import Box from "../../Styled/Box";
import { RawButton } from "../../Styled/Button";
import { TextSpan } from "../../Styled/Text";

// only spans are valid html for buttons (even though divs work)
const ButtonWrapper = styled(Box).attrs({
  as: "span"
})`
  display: flex;
  justify-content: center;
  align-items: center;
  transition: flex 0.3s ease-out;
`;

interface IStyledMapIconButtonProps {
  roundLeft?: boolean;
  roundRight?: boolean;
  primary?: boolean;
  splitter?: boolean;
  disabled?: boolean;
  inverted?: boolean;
  engaged?: boolean;
}

// MapLibre-style map control: light square button with a soft outline
// shadow, kept light regardless of the UI theme (like GeoLibre does).
const StyledMapIconButton = styled(RawButton)<IStyledMapIconButtonProps>`
  border-radius: ${(props) => props.theme.radiusMedium};
  ${(props) =>
    props.roundLeft &&
    `border-radius: ${props.theme.radiusMedium} 0 0 ${props.theme.radiusMedium};`}
  ${(props) =>
    props.roundRight &&
    `border-radius: 0 ${props.theme.radiusMedium} ${props.theme.radiusMedium} 0;`}

  background: ${(props) => props.theme.mapControlBg};
  color: ${(props) => props.theme.mapControlColor};
  border: none;

  height: ${(props) => props.theme.mapControlSize}px;
  min-width: ${(props) => props.theme.mapControlSize}px;
  direction: rtl;
  box-shadow: ${(props) => props.theme.mapControlShadow};
  transition: background-color 0.15s ease;

  svg {
    height: 18px;
    width: 18px;
    margin: 0 auto;
    vertical-align: middle;
    fill: ${(props) => props.theme.mapControlColor};
  }

  &:hover,
  &:focus-visible {
    background-image: linear-gradient(
      ${(props) => props.theme.mapControlHoverBg},
      ${(props) => props.theme.mapControlHoverBg}
    );
  }

  ${(props) =>
    (props.primary || props.engaged) &&
    !props.disabled &&
    `
    background: ${props.theme.colorPrimary};
    color: ${props.theme.textLight};
    svg {
      fill: ${props.theme.textLight};
      stroke: ${props.theme.textLight};
    }
  `}
  ${(props) =>
    props.splitter &&
    !props.disabled &&
    `
    background: ${props.theme.colorSecondary};
    color: ${props.theme.textLight};
    svg {
      fill: ${props.theme.textLight};
    }
  `}

  ${(props) =>
    props.inverted &&
    `
    background: ${props.theme.charcoalGrey};
    color: ${props.theme.textLight};
    svg {
      fill: ${props.theme.textLight};
    }
  `}

  ${(props) =>
    props.disabled &&
    `
    cursor: not-allowed;
    svg {
      opacity: 0.3;
    }
    &:hover,
    &:focus-visible {
      background-image: none;
    }
  `}
`;

interface IMapIconButtonProps extends IStyledMapIconButtonProps {
  expandInPlace?: boolean;
  neverCollapse?: boolean;
  title?: string;
  iconElement: () => JSX.Element;
  closeIconElement?: () => JSX.Element;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  buttonRef?: RefObject<any>;
  noExpand?: boolean;
}

function MapIconButton(props: IMapIconButtonProps) {
  const [isExpanded, setExpanded] = useState(false);
  const {
    children,
    roundLeft,
    roundRight,
    title,
    expandInPlace,
    neverCollapse,
    primary,
    splitter,
    engaged,
    inverted,
    disabled,
    noExpand = false
  } = props;
  const expanded = !noExpand && (isExpanded || neverCollapse) && children;
  const buttonRef = useRef();
  const theme = useTheme();
  const size = `${theme.mapControlSize}px`;

  const handleAway = () => setExpanded(false);
  const handleFocus = (expanded: boolean) => {
    if (!disabled) {
      setExpanded(expanded);
    }
  };

  const MapIconButtonRaw = (
    <StyledMapIconButton
      ref={props.buttonRef || buttonRef}
      className={props.className}
      primary={primary}
      splitter={splitter}
      engaged={engaged}
      inverted={inverted}
      roundLeft={roundLeft}
      roundRight={roundRight}
      disabled={disabled}
      type="button"
      title={title}
      onMouseOver={() => handleFocus(true)}
      onFocus={() => handleFocus(true)}
      onMouseOut={handleAway}
      onBlur={handleAway}
      onClick={props.onClick}
      css={`
        svg {
          margin: 0px 5px;
        }
      `}
    >
      <ButtonWrapper>
        {/* only spans are valid html for buttons (even though divs work) */}
        {!noExpand && primary && props.closeIconElement && (
          <span
            css={`
              display: block;
            `}
          >
            {props.closeIconElement()}
          </span>
        )}
        {children && !noExpand && (
          <TextSpan
            noWrap
            medium
            css={`
              display: block;
              transition:
                visibility 0.3s ease,
                max-width 0.3s ease,
                margin-right 0.3s ease,
                opacity 0.3s ease;
              visibility: ${expanded ? `visible` : `hidden`};
              max-width: ${expanded ? `150px` : `0px`};
              margin-right: ${expanded ? `10px` : `0px`};
              opacity: ${expanded ? `1.0` : `0`};
            `}
          >
            {children}
          </TextSpan>
        )}
        {props.iconElement && (
          <span
            css={`
              display: block;
            `}
          >
            {props.iconElement()}
          </span>
        )}
      </ButtonWrapper>
    </StyledMapIconButton>
  );
  // we need to add some positional wrapping elements if we need to expand the
  // button in place (`absolute`ly) instead of in the layout flow (`relative`).
  if (expandInPlace) {
    return (
      <div
        css={
          expandInPlace &&
          `
            position:relative;
            width: ${size};
            height: ${size};
            margin:auto;
          `
        }
      >
        <div
          css={
            expandInPlace &&
            `
              position:absolute;
              top:0;
              right:0;
              ${isExpanded && `z-index:10;`}
            `
          }
        >
          {MapIconButtonRaw}
        </div>
      </div>
    );
  } else return MapIconButtonRaw;
}

export default MapIconButton;
