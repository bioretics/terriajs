import { i18n } from "i18next";
import { observer } from "mobx-react";
import React from "react";
import { withTranslation } from "react-i18next";
import styled from "styled-components";
import { applyTranslationIfExists } from "../../../../Language/languageHelpers";
import Terria from "../../../../Models/Terria";
import Box from "../../../../Styled/Box";
import Icon, { GLYPHS } from "../../../../Styled/Icon";
import { IMapNavigationItem } from "../../../../ViewModels/MapNavigation/MapNavigationModel";
import MapIconButton from "../../../MapIconButton/MapIconButton";

interface PropTypes {
  item: IMapNavigationItem;
  terria: Terria;
  closeTool?: boolean;
  expandInPlace?: boolean;
  i18n: i18n;
}

@observer
class MapNavigationItemBase extends React.Component<
  PropTypes,
  { isOpen: boolean }
> {
  constructor(props: PropTypes) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  toggleList = () => {
    this.setState((prevState) => ({ isOpen: !prevState.isOpen }));
  };

  render() {
    const { closeTool = true, item, expandInPlace, i18n } = this.props;
    const { isOpen } = this.state;

    if (item.render)
      return (
        <Control key={item.id} ref={item.controller.itemRef}>
          {item.render}
        </Control>
      );

    return (
      <Control ref={item.controller.itemRef}>
        <MapIconButton
          expandInPlace={expandInPlace === undefined ? true : expandInPlace}
          noExpand={item.noExpand}
          iconElement={() => <Icon glyph={item.controller.glyph} />}
          title={applyTranslationIfExists(item.title || item.name, i18n)}
          onClick={() => {
            item.controller.handleClick();
            this.toggleList();
          }}
          disabled={item.controller.disabled}
          primary={item.controller.active}
          closeIconElement={
            closeTool ? () => <Icon glyph={GLYPHS.closeTool} /> : undefined
          }
        >
          {applyTranslationIfExists(item.name, i18n)}
        </MapIconButton>

        {item.childrenItems && item.childrenItems.length > 0 && (
          <NestedListWrapper isOpen={isOpen}>
            <NestedList isOpen={isOpen}>
              {item.childrenItems.map((childItem) => (
                <li key={childItem.id}>
                  <MapNavigationItem
                    item={childItem}
                    terria={this.props.terria}
                  />
                </li>
              ))}
            </NestedList>
          </NestedListWrapper>
        )}
      </Control>
    );
  }
}

export const Control = styled(Box).attrs({
  centered: true,
  column: true
})`
  pointer-events: auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (min-width: ${(props) => props.theme.sm}px) {
    margin: 0;
    padding-top: 10px;
    height: auto;
  }

  @media (max-width: ${(props) => props.theme.mobile}px) {
    padding-right: 10px;
    margin-bottom: 5px;
  }
`;

const NestedListWrapper = styled.div<{ isOpen: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: ${(props) => (props.isOpen ? "10px" : "0")};
  align-items: flex-start;
`;

const NestedList = styled.ul<{ isOpen: boolean }>`
  position: relative;
  padding: 10px;
  margin: 0;
  list-style-type: none;
  border-radius: 4px;
  z-index: 10;
  visibility: ${(props) => (props.isOpen ? "visible" : "hidden")};
  opacity: ${(props) => (props.isOpen ? 1 : 0)};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  display: flex;
  flex-direction: column;

  li {
    margin-left: 0;
  }
`;

export const MapNavigationItem = withTranslation()(MapNavigationItemBase);
