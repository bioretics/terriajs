"use strict";

import classNames from "classnames";
import React, { useState } from "react";
import Icon, { StyledIcon } from "../../../../Styled/Icon";
import MenuPanel from "../../../StandardUserInterface/customizable/MenuPanel";
import Input from "../../../../Styled/Input";
import DropdownStyles from "../panel.scss";
import Styles from "./color-panel.scss";
import Box from "../../../../Styled/Box";
import Button from "../../../../Styled/Button";
import Color from "terriajs-cesium/Source/Core/Color";
import createElevationBandMaterial from "terriajs-cesium/Source/Scene/createElevationBandMaterial";
import PropTypes from "prop-types";

const ColorPanel = (props) => {
  const { terria, viewState, modalWidth, onUserClick } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [layers, setLayers] = useState([]);
  const [bandTransparency, setBandTransparency] = useState(0.5);

  const dropdownTheme = {
    outer: classNames(Styles.sharePanel),
    inner: classNames(Styles.dropdownInner)
  };

  const btnText = "Colora";
  const btnTitle = "Colora il terreno in base all'altitudine";

  const apply = () => {
    var material = createElevationBandMaterial({
      scene: terria.cesium.scene,
      layers: layers.map((layer) => {
        return {
          entries: [
            {
              height: layer.fromHeight,
              color: Color.fromCssColorString(layer.fromColor).withAlpha(
                bandTransparency
              )
            },
            {
              height: layer.toHeight,
              color: Color.fromCssColorString(layer.toColor).withAlpha(
                bandTransparency
              )
            }
          ]
        };
      })
    });

    terria.cesium.scene.globe.material = material;
  };

  const renderContent = () => {
    return (
      <div className={DropdownStyles.section}>
        <div>Range di altitudine da colorare</div>
        <div className={Styles.explanation}>range min - max (in metri)</div>
        <Box
          styledMargin="10px 8px 8px 0"
          style={{ display: "flex", alignItems: "center" }}
        >
          Transparency
          <Input
            style={{ marginLeft: "8px" }}
            styledWidth="100px"
            min={0}
            max={1}
            step={0.01}
            light={false}
            dark={true}
            type="number"
            value={bandTransparency}
            onChange={(e) => setBandTransparency(Number(e.target.value))}
          />
        </Box>
        <Button
          title="Add a color range"
          css={`
            width: 35px;
            border-radius: 2px;
            margin: 2px;
            margin-top: 8px;
            margin-bottom: 8px;
          `}
          onClick={() => {
            setLayers((old) => [
              ...old,
              {
                fromHeight: 0,
                fromColor: "#0000FF",
                toHeight: 0,
                toColor: "#0000FF"
              }
            ]);
          }}
        >
          <StyledIcon
            light={true}
            realDark={true}
            glyph={Icon.GLYPHS.add}
            styledWidth="24px"
          />
        </Button>
        {layers.map((layer, index) => {
          return (
            <Box key={index}>
              <Input
                className={Styles.shareUrlfield}
                light={false}
                dark={true}
                large
                type="number"
                placeholder="From"
                value={layer.fromHeight}
                onChange={(e) => {
                  setLayers(
                    layers.map((item, ind) =>
                      ind === index
                        ? { ...item, fromHeight: Number(e.target.value) }
                        : item
                    )
                  );
                }}
              />
              <Input
                className={Styles.shareUrlfield}
                light={false}
                dark={true}
                large
                type="color"
                value={layer.fromColor}
                onChange={(e) => {
                  setLayers(
                    layers.map((item, ind) =>
                      ind === index
                        ? {
                            ...item,
                            fromColor: e.target.value,
                            toColor: e.target.value
                          }
                        : item
                    )
                  );
                }}
              />
              <Input
                className={Styles.shareUrlfield}
                light={false}
                dark={true}
                large
                type="number"
                placeholder="To"
                value={layer.toHeight}
                onChange={(e) => {
                  setLayers(
                    layers.map((item, ind) =>
                      ind === index
                        ? { ...item, toHeight: Number(e.target.value) }
                        : item
                    )
                  );
                }}
              />
              <Input
                className={Styles.shareUrlfield}
                light={false}
                dark={true}
                large
                type="color"
                value={layer.toColor}
                onChange={(e) => {
                  setLayers(
                    layers.map((item, ind) =>
                      ind === index
                        ? { ...item, toColor: e.target.value }
                        : item
                    )
                  );
                }}
              />
              <Button
                title="Remove the color range"
                css={`
                  width: 35px;
                  border-radius: 2px;
                  margin: 2px;
                `}
                onClick={() => {
                  setLayers(layers.filter((_, i) => i !== index));
                }}
              >
                <StyledIcon
                  light={true}
                  realDark={true}
                  glyph={Icon.GLYPHS.remove}
                  styledWidth="24px"
                />
              </Button>
            </Box>
          );
        })}
        <Box style={{ marginTop: "10px" }}>
          <Button
            primary
            css={`
              border-radius: 2px;
              margin: 2px;
            `}
            className={Styles.formatButton}
            onClick={apply}
          >
            Applica
          </Button>
        </Box>
        <small>
          <i>
            Dopo aver premuto il bottone "Applica", clicca sulla mappa per
            aggiornarla.
          </i>
        </small>
      </div>
    );
  };

  return (
    <div>
      <MenuPanel
        theme={dropdownTheme}
        btnText={false ? null : btnText}
        viewState={viewState}
        btnTitle={btnTitle}
        isOpen={isOpen}
        onOpenChanged={setIsOpen}
        showDropdownAsModal={false}
        modalWidth={modalWidth}
        smallScreen={viewState.useSmallScreenInterface}
        onDismissed={() => {
          if (true) viewState.shareModalIsVisible = false;
        }}
        onUserClick={onUserClick}
      >
        {isOpen && renderContent()}
      </MenuPanel>
    </div>
  );
};

ColorPanel.propTypes = {
  terria: PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
  modalWidth: PropTypes.number,
  onUserClick: PropTypes.func
};

export default ColorPanel;
