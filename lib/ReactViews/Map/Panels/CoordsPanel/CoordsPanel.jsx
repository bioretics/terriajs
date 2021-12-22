"use strict";

import classNames from "classnames";
import React, { useState, useEffect } from "react";
import Icon, { StyledIcon } from "../../../../Styled/Icon";
// import Loader from "../../../Loader";
import MenuPanel from "../../../StandardUserInterface/customizable/MenuPanel";
import Input from "../../../Styled/Input/Input.jsx";
import DropdownStyles from "../panel.scss";
import Styles from "./coords-panel.scss";

// import clipboard from "clipboard";
import Box from "../../../../Styled/Box";
import Button from "../../../../Styled/Button";
import Select from "../../../../Styled/Select";
import CesiumResource from "terriajs-cesium/Source/Core/Resource";
import createZoomToFunction from "../../../../Map/zoomRectangleFromPoint";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import PropTypes from "prop-types";

const CoordsText = props => {
  const {
    name,
    title,
    message,
    tooltip,
    value,
    setValue,
    isCartographic,
    moveTo,
    readonly
  } = props;

  // const clipboardBtn = new clipboard(`.btn-copy-${name}`);

  return (
    <div className={DropdownStyles.section}>
      <div>{title}</div>
      <div className={Styles.explanation}>
        <i>{message}</i>
      </div>
      <Box>
        <Input
          title={tooltip}
          className={Styles.shareUrlfield}
          light={false}
          dark={true}
          large
          type="text"
          value={value}
          readOnly={readonly ?? false}
          // placeholder={this.state.placeholder}
          // onClick={e => setValue(e)}
          onChange={e => setValue(e.target.value)}
          id={name}
        />
        <Button
          primary
          title="Copia le coordinate negli Appunti"
          css={`
            width: 35px;
            border-radius: 2px;
            margin: 2px;
          `}
          className={`btn-copy-${name}`}
          data-clipboard-target={`#${name}`}
        >
          <StyledIcon
            light={true}
            realDark={false}
            glyph={Icon.GLYPHS.copy}
            styledWidth="24px"
          />
        </Button>
        <Button
          title="Centra la mappa alle coordinate indicate (attivo solo se sono cartografiche)"
          css={`
            width: 35px;
            border-radius: 2px;
            margin: 2px;
            background: #519ac2;
          `}
          disabled={!isCartographic}
          onClick={moveTo}
        >
          <StyledIcon
            light={true}
            realDark={false}
            glyph={Icon.GLYPHS.location}
            styledWidth="24px"
          />
        </Button>
      </Box>
    </div>
  );
};

const SrsSelection = props => {
  const {
    title,
    tooltip,
    isCartographic,
    setSrs,
    reset,
    convert,
    conversionList
  } = props;

  useEffect(() => {
    setSrs(conversionList[0]);
  }, [isCartographic]);

  return (
    <div className={DropdownStyles.section}>
      <div>{title}</div>

      <Select
        onChange={e => {
          setSrs(conversionList[e.target.value]);
        }}
        title={tooltip}
      >
        {conversionList.map((conv, index) => {
          if (!isCartographic || (isCartographic && conv.from === 4326))
            return (
              <option key={index} className={Styles.crsItem} value={index}>
                {conv.desc}
              </option>
            );
        })}
      </Select>
      <Button
        primary
        css={`
          border-radius: 2px;
          margin: 2px;
        `}
        className={Styles.formatButton}
        onClick={convert}
      >
        Converti
      </Button>
      <Button
        css={`
          border-radius: 2px;
          margin: 2px;
        `}
        className={Styles.formatButton}
        onClick={reset}
      >
        Reset
      </Button>
    </div>
  );
};

const CoordsPanel = props => {
  const { terria, viewState, modalWidth, onUserClick } = props;

  const conversionList = [
    {
      desc: "EPSG:4326 WGS84 → EPSG:3003 Monte Mario / Italy zone 1",
      from: 4326,
      to: 3003,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:3004 Monte Mario / Italy zone 2",
      from: 4326,
      to: 3004,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:4265 Monte Mario",
      from: 4326,
      to: 4265,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:5659 UTMRER",
      from: 4326,
      to: 5659,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:4258 ETRS89",
      from: 4326,
      to: 4258,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:25832 ETRS89 / UTM zone 32N",
      from: 4326,
      to: 25832,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:25833 ETRS89 / UTM zone 33N",
      from: 4326,
      to: 25833,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:6706 RDN2008",
      from: 4326,
      to: 6706,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:7791 RDN2008 / UTM zone 32N",
      from: 4326,
      to: 7791,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:7792 RDN2008 / UTM zone 33N",
      from: 4326,
      to: 7792,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:4230 ED50",
      from: 4326,
      to: 4230,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:23032 ED50 / UTM zone 32N",
      from: 4326,
      to: 23032,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:23033 ED50 / UTM zone 33N",
      from: 4326,
      to: 23033,
      transformForward: false,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:32632 WGS 84 / UTM zone 32N",
      from: 4326,
      to: 32632,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:4326 WGS84 → EPSG:32633 WGS 84 / UTM zone 33N",
      from: 4326,
      to: 32633,
      transformForward: false,
      wkt: {}
    },
    {
      desc: "EPSG:3003 Monte Mario / Italy zone 1 → EPSG:4326 WGS84",
      from: 3003,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:3004 Monte Mario / Italy zone 2 → EPSG:4326 WGS84",
      from: 3004,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4265 Monte Mario → EPSG:4326 WGS84",
      from: 4265,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:5659 UTMRER → EPSG:4326 WGS84",
      from: 5659,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_AD400_MM_ETRS89_V1A",GEOGCS["GCS_Monte_Mario",DATUM["D_Monte_Mario",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A",0.0]]'
      }
    },
    {
      desc: "EPSG:4258 ETRS89 → EPSG:4326 WGS84",
      from: 4258,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:25832 ETRS89 / UTM zone 32N → EPSG:4326 WGS84",
      from: 25832,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:25833 ETRS89 / UTM zone 33N → EPSG:4326 WGS84",
      from: 25833,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:6706 RDN2008 → EPSG:4326 WGS84",
      from: 6706,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:7791 RDN2008 / UTM zone 32N → EPSG:4326 WGS84",
      from: 7791,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:7792 RDN2008 / UTM zone 33N → EPSG:4326 WGS84",
      from: 7792,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:4230 ED50 → EPSG:4326 WGS84",
      from: 4230,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:23032 ED50 / UTM zone 32N → EPSG:4326 WGS84",
      from: 23032,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:23033 ED50 / UTM zone 33N → EPSG:4326 WGS84",
      from: 23033,
      to: 4326,
      transformForward: true,
      wkt: {
        wkt:
          'GEOGTRAN["CGT_ED50_ETRS89_GPS7_K2",GEOGCS["GCS_European_1950",DATUM["D_European_1950",SPHEROID["International_1924",6378388.0,297.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],METHOD["NTv2"],PARAMETER["Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2",0.0]]'
      }
    },
    {
      desc: "EPSG:32632 WGS 84 / UTM zone 32N → EPSG:4326 WGS84",
      from: 32632,
      to: 4326,
      transformForward: true,
      wkt: {}
    },
    {
      desc: "EPSG:32633 WGS 84 / UTM zone 33N → EPSG:4326 WGS84",
      from: 32633,
      to: 4326,
      transformForward: true,
      wkt: {}
    }
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [coordsInputTxt, setCoordsInputTxt] = useState("");
  const [coordsOutputTxt, setCoordsOutputTxt] = useState("");
  const [inputX, setInputX] = useState(null);
  const [inputY, setInputY] = useState(null);
  const [outputX, setOutputX] = useState(null);
  const [outputY, setOutputY] = useState(null);
  const [isInputCartographic, setIsInputCartographic] = useState(false);
  const [isOutputCartographic, setIsOutputCartographic] = useState(false);
  const [srs, setSrs] = useState(conversionList[0]);

  const dropdownTheme = {
    outer: classNames(Styles.sharePanel),
    inner: classNames(Styles.dropdownInner)
  };

  const btnText = "Coordinate";
  const btnTitle = "Converti coordinate";

  const renderContent = () => {
    return (
      <div>
        <CoordsText
          name="coordsIn"
          title="Coordinate"
          value={coordsInputTxt}
          setValue={setCoordsInputTxt}
          isCartographic={isInputCartographic}
          moveTo={() => {
            moveTo(inputX, inputY);
          }}
          message="Lat, Lon (in gradi decimali) oppure X, Y oppure Est, Nord"
          tooltip="Se la finestra 'Informazioni' è aperta le coordinate sono lette da lì e non sono modificabili"
        />
        <SrsSelection
          title="Conversione"
          isCartographic={isInputCartographic}
          setSrs={setSrs}
          reset={reset}
          convert={callConverter}
          conversionList={conversionList}
          tooltip="Clicca per scegliere la conversione da utilizzare (se le coordinate sono geografiche l'elenco delle conversioni è filtrato con solo quelle ammissibili)"
        />
        <CoordsText
          name="coordsOut"
          title="Risultato"
          value={coordsOutputTxt}
          setValue={setCoordsOutputTxt}
          isCartographic={isOutputCartographic}
          moveTo={() => {
            moveTo(outputY, outputX);
          }}
          readonly
          message="Lat, Lon (in gradi decimali) oppure X, Y oppure Est, Nord"
          tooltip=""
        />
      </div>
    );
  };

  const moveTo = (x, y) => {
    const bboxSize = 0.005;
    const time = 2.0;
    const rectangle = createZoomToFunction(x, y, bboxSize);

    terria.currentViewer.zoomTo(rectangle, time);
    terria.cesium._selectionIndicator.animateAppear();
  };

  const reset = () => {
    setCoordsInputTxt("");
    setCoordsOutputTxt("");
    setIsInputCartographic(false);
    setIsOutputCartographic(false);
  };

  const callConverter = () => {
    if (!srs || !inputX || !inputY) {
      return;
    }

    CesiumResource.fetchJson({
      url: terria.corsProxy.getURL(
        "http://servizigis.regione.emilia-romagna.it/arcgis/rest/services/Utilities/Geometry/GeometryServer/project"
      ),
      queryParameters: {
        inSR: srs.from,
        outSR: srs.to,
        geometries: isInputCartographic
          ? inputY.toString() + "," + inputX.toString()
          : inputX.toString() + "," + inputY.toString(),
        transformation: JSON.stringify(srs.wkt),
        transformForward: srs.transformForward,
        f: "json"
      }
    }).then(function(results) {
      if (results.geometries) {
        const geom = results.geometries[0];
        const areLatLon =
          geom.x >= 0 && geom.x <= 360 && geom.y >= 0 && geom.y <= 360;
        const x = geom.x.toFixed(areLatLon ? 6 : 4);
        const y = geom.y.toFixed(areLatLon ? 6 : 4);

        setOutputX(x);
        setOutputY(y);
        setIsOutputCartographic(areLatLon);
        setCoordsOutputTxt(areLatLon ? y + ", " + x : x + ", " + y);
      } else {
        setCoordsOutputTxt(results.error.message);
      }
    });
  };

  useEffect(() => {
    if (coordsInputTxt && coordsInputTxt !== "") {
      const splitted = coordsInputTxt.toString().split(/[ |,|;]+/g);
      const x = parseFloat(splitted[0]);
      const y = parseFloat(splitted[1]);
      const areLatLon = x >= 0 && x <= 360 && y >= 0 && y <= 360;
      setInputX(x);
      setInputY(y);
      setIsInputCartographic(areLatLon);
    }
  }, [coordsInputTxt]);

  useEffect(() => {
    if (!!terria && !!terria.pickedPosition) {
      const cartographic = Ellipsoid.WGS84.cartesianToCartographic(
        terria.pickedPosition
      );
      const latitude = CesiumMath.toDegrees(cartographic.latitude).toFixed(6);
      const longitude = CesiumMath.toDegrees(cartographic.longitude).toFixed(6);
      if (coordsInputTxt !== `${latitude}, ${longitude}`) {
        setCoordsInputTxt(`${latitude}, ${longitude}`);
      }
    }
  }, [terria.pickedPosition]);

  return (
    <div>
      <MenuPanel
        theme={dropdownTheme}
        btnText={btnText}
        viewState={viewState}
        btnTitle={btnTitle}
        isOpen={isOpen}
        onOpenChanged={setIsOpen}
        showDropdownAsModal={false}
        modalWidth={modalWidth}
        smallScreen={viewState.useSmallScreenInterface}
        onDismissed={() => {
          viewState.shareModalIsVisible = false;
        }}
        onUserClick={onUserClick}
      >
        {isOpen && renderContent()}
      </MenuPanel>
    </div>
  );
};

CoordsText.propTypes = {
  name: PropTypes.string,
  title: PropTypes.string,
  message: PropTypes.string,
  tooltip: PropTypes.string,
  value: PropTypes.string,
  setValue: PropTypes.func,
  isCartographic: PropTypes.bool,
  moveTo: PropTypes.func,
  readonly: PropTypes.bool
};

SrsSelection.propTypes = {
  title: PropTypes.string,
  tooltip: PropTypes.string,
  isCartographic: PropTypes.bool,
  setSrs: PropTypes.func,
  reset: PropTypes.func,
  convert: PropTypes.func,
  conversionList: PropTypes.array
};

CoordsPanel.propTypes = {
  terria: PropTypes.object.isRequired,
  viewState: PropTypes.object.isRequired,
  modalWidth: PropTypes.number,
  onUserClick: PropTypes.func
};

// export default withTranslation()(CoordsPanel);
export default CoordsPanel;
