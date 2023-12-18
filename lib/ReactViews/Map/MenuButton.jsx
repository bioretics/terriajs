import React from "react";
import classNames from "classnames";
import Icon from "../../Styled/Icon";
import PropTypes from "prop-types";
import Styles from "./menu-button.scss";

/**
 * Basic button for use in the menu part at the top of the map.
 *
 * @constructor
 */
function MenuButton(props) {
  // const target = props.href !== "#" ? "_blank" : undefined;
  const target = props.target;
  const rel = target === "_blank" ? "noreferrer" : undefined;
  return (
    <a
      className={classNames(Styles.btnAboutLink, {
        [Styles.aboutTweak]: props.href === "about.html"
      })}
      href={props.href}
      target={target}
      rel={rel}
      title={props.caption}
    >
      {props.href !== "#" && <Icon glyph={Icon.GLYPHS.externalLink} />}
      <span>{props.caption}</span>
    </a>
  );
}

MenuButton.defaultProps = {
  href: "#",
  target: "_blank"
};

MenuButton.propTypes = {
  target: PropTypes.string,
  href: PropTypes.string,
  caption: PropTypes.string.isRequired
};

export default MenuButton;
