'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import ObserverModelMixin from '../../ObserveModelMixin';
import defined from 'terriajs-cesium/Source/Core/defined';
import classNames from 'classnames';
import MenuPanel from '../../StandardUserInterface/customizable/MenuPanel.jsx';
import InnerPanel from "./InnerPanel";

import Styles from './coords-converter-panel.scss';
import DropdownStyles from './panel.scss';
import Icon from "../../Icon.jsx";

const Ellipsoid = require("terriajs-cesium/Source/Core/Ellipsoid").default;
const CesiumMath = require("terriajs-cesium/Source/Core/Math").default;

var CesiumResource = require("terriajs-cesium/Source/Core/Resource").default;

var zoomRectangleFromPoint = require('../../../Map/zoomRectangleFromPoint');

const CoordsConverterPanel = createReactClass({
    displayName: 'CoordsConverterPanel',
    mixins: [ObserverModelMixin],

    propTypes: {
        terria: PropTypes.object,
        userPropWhiteList: PropTypes.array,
        viewState: PropTypes.object.isRequired,
        //epsgList: PropTypes.array,
        conversionList: PropTypes.array,
        x: PropTypes.string,
        y: PropTypes.string,
        coordsTxt: PropTypes.string,
        //sCrs: PropTypes.string,
        //tCrs: PropTypes.string,
        //hiddenTxt: PropTypes.string
        selectConversion: PropTypes.number
    },

    getDefaultProps() {
        return {
            conversionList: [
                { desc: 'EPSG:4326 WGS84 → EPSG:3003 Monte Mario / Italy zone 1', from: 4326, to: 3003, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:3004 Monte Mario / Italy zone 2', from: 4326, to: 3004, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:4265 Monte Mario', from: 4326, to: 4265, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:5659 UTMRER', from: 4326, to: 5659, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:4258 ETRS89', from: 4326, to: 4258, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:25832 ETRS89 / UTM zone 32N', from: 4326, to: 25832, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:25833 ETRS89 / UTM zone 33N', from: 4326, to: 25833, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:6706 RDN2008', from: 4326, to: 6706, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:7791 RDN2008 / UTM zone 32N', from: 4326, to: 7791, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:7792 RDN2008 / UTM zone 33N', from: 4326, to: 7792, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:4230 ED50', from: 4326, to: 4230, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:23032 ED50 / UTM zone 32N', from: 4326, to: 23032, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:23033 ED50 / UTM zone 33N', from: 4326, to: 23033, transformForward: false, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:4326 WGS84 → EPSG:32632 WGS 84 / UTM zone 32N', from: 4326, to: 32632, transformForward: false, wkt: {} },
                { desc: 'EPSG:4326 WGS84 → EPSG:32633 WGS 84 / UTM zone 33N', from: 4326, to: 32633, transformForward: false, wkt: {} },
                { desc: 'EPSG:3003 Monte Mario / Italy zone 1 → EPSG:4326 WGS84', from: 3003, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:3004 Monte Mario / Italy zone 2 → EPSG:4326 WGS84', from: 3004, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4265 Monte Mario → EPSG:4326 WGS84', from: 4265, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:5659 UTMRER → EPSG:4326 WGS84', from: 5659, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'EPSG:4258 ETRS89 → EPSG:4326 WGS84', from: 4258, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:25832 ETRS89 / UTM zone 32N → EPSG:4326 WGS84', from: 25832, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:25833 ETRS89 / UTM zone 33N → EPSG:4326 WGS84', from: 25833, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:6706 RDN2008 → EPSG:4326 WGS84', from: 6706, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:7791 RDN2008 / UTM zone 32N → EPSG:4326 WGS84', from: 7791, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:7792 RDN2008 / UTM zone 33N → EPSG:4326 WGS84', from: 7792, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:4230 ED50 → EPSG:4326 WGS84', from: 4230, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:23032 ED50 / UTM zone 32N → EPSG:4326 WGS84', from: 23032, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:23033 ED50 / UTM zone 33N → EPSG:4326 WGS84', from: 23033, to: 4326, transformForward: true, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'EPSG:32632 WGS 84 / UTM zone 32N → EPSG:4326 WGS84', from: 32632, to: 4326, transformForward: true, wkt: {} },
                { desc: 'EPSG:32633 WGS 84 / UTM zone 33N → EPSG:4326 WGS84', from: 32633, to: 4326, transformForward: true, wkt: {} }
            ]
        };
    },

    getInitialState() {
        return {
            //isOpen: false,
            //sCrs: this.props.epsgList[0].code,
            //tCrs: this.props.epsgList[0].code,
            selectConversion: 0,
            x: '',
            y: '',
            coordsTxt: '',
            //hiddenTxt: ''
            coordsAreLatLon: false,
            fromFeatureInfo: false
        };
    },

    /*changeOpen(open) {
        //this.setState({
        //    isOpen: open
        //});
        this.props.viewState.openCoordinateConverterPanel = open;
    },*/

    openClose() {
        this.props.viewState.openCoordinateConverterPanel = !this.props.viewState.openCoordinateConverterPanel;

        this.setState({
            fromFeatureInfo: false
        });
    },

    changedCoords(event) {
        var text = event.target.value;
        var splitted = text.split(/[ |,|;]+/g);
        const x = parseFloat(splitted[0]);
        const y = parseFloat(splitted[1]);
        const areLatLon = x >= 0 && x <= 360 && y >= 0 && y <= 360;
        this.setState({
            coordsTxt: text,
            y: y,
            x: x,
            coordsAreLatLon: areLatLon,
            //fromFeatureInfo: false
        });
    },

    changeCSR(event) {
        this.setState({selectConversion: event.target.value});
    },

    loadRes() {
        CesiumResource.fetchJson({
            url: this.props.terria.corsProxy.getURL("http://servizigis.regione.emilia-romagna.it/arcgis/rest/services/Utilities/Geometry/GeometryServer/project"),
            queryParameters: {
                inSR: this.props.conversionList[this.state.selectConversion].from,
                outSR: this.props.conversionList[this.state.selectConversion].to,
                geometries: this.state.coordsAreLatLon ? this.state.y.toString() + "," + this.state.x.toString() : this.state.x.toString() + "," + this.state.y.toString(),
                transformation: JSON.stringify(this.props.conversionList[this.state.selectConversion].wkt),
                transformForward: this.props.conversionList[this.state.selectConversion].transformForward,
                f: 'json'
            }
        }).then(function (results) {
            if(results.geometries) {
                const geom = results.geometries[0];
                const areLatLon = geom.x >= 0 && geom.x <= 360 && geom.y >= 0 && geom.y <= 360;
                document.getElementById("conversionOutput").value = areLatLon ? geom.y.toFixed(6) + ", " + geom.x.toFixed(6) : geom.x.toFixed(4) + ", " + geom.y.toFixed(4);
            }
            else {
                document.getElementById("conversionOutput").value = results.error.message;
            }
        });

    },

    onLoadPickedCoords(event) {
        if (defined(this.props.terria.pickedFeatures)) {
            var cartographicCoords = Ellipsoid.WGS84.cartesianToCartographic(this.props.terria.pickedFeatures.pickPosition);

            const latitude = CesiumMath.toDegrees(cartographicCoords.latitude);
            const longitude = CesiumMath.toDegrees(cartographicCoords.longitude);

            this.setState({
                x: latitude,
                y: longitude,
                coordsTxt: latitude.toFixed(6) + ", " + longitude.toFixed(6),
                coordsAreLatLon: true,
                fromFeatureInfo: true
            });
        }
    },

    onGoTo(event) {
        var bboxSize = 0.005;
        var rectangle = zoomRectangleFromPoint(this.state.x, this.state.y, bboxSize);

        this.props.terria.currentViewer.zoomTo(rectangle, 2.0);

        this.props.terria.cesium._selectionIndicator.animateAppear();
    },

    clearCoord(event) {
        this.setState({
            x: '',
            y: '',
            coordsTxt: ''
        });
        document.getElementById("conversionOutput").value = "";
    },

    copyInCoordsToClipboard(event) {
        this.copyToClipboard("coords");
    },

    copyOutCoordsToClipboard(event) {
        this.copyToClipboard("conversionOutput");
    },

    copyToClipboard(id) {
        var copyText = document.getElementById(id);
        copyText.select();
        copyText.setSelectionRange(0, 99999); /*For mobile devices*/
        document.execCommand("copy");
    },

    renderContent() {
        return (<div>
            {/*<div>
                <p><label>Cattura coordinate ultimo click</label></p>
                <p><button className={Styles.btnIcon} onClick={this.onLoadPickedCoords}><Icon glyph={Icon.GLYPHS.location} /></button></p>
            </div>*/}
            <div className={classNames(DropdownStyles.section, Styles.section)}>
                <p>
                    <label>Coordinate</label>
                    <br/>
                    <label><i>Lat, Long (in gradi decimali) oppure X, Y oppure Est, Nord</i></label>
                </p>
                <p>
                    <input className={Styles.coordsField} type="text" id="coords" onChange={this.changedCoords} value={this.state.coordsTxt} />
                </p>
                <p>
                    <button className={Styles.btnIcon} onClick={this.copyInCoordsToClipboard}><Icon glyph={Icon.GLYPHS.copy} /></button>
                </p>
                {/*<p>
                    <label>CRS sorgente</label>
                </p>
                <p>
                    <input className={Styles.crsSelect} readOnly value={this.props.epsgList[0].text}></input>
                </p>
                <p>
                    <label>CRS destinazione</label>
                </p>
                <p>
                    <select className={Styles.crsSelect} onChange={this.changedT} defaultValue={this.state.tCrs} >
                        {this.props.epsgList.map(function (epsg) { return <option key={epsg.code} className={Styles.crsItem} value={epsg.code}>{epsg.text}</option>; })}
                    </select>
                </p>*/}
                <p>
                    <label>Conversione</label>
                </p>
                <p>
                    <select className={Styles.crsSelect} onChange={this.changeCSR} defaultValue={0} >
                        {this.props.conversionList.map((conv, index) => {
                            if(!this.state.fromFeatureInfo || (this.state.fromFeatureInfo && conv.from === 4326))
                                return <option key={index} className={Styles.crsItem} value={index}>{conv.desc}</option>;
                        })}
                    </select>
                </p>
            </div>
            <div className={classNames(Styles.viewer, DropdownStyles.section)}>
                <ul className={classNames(Styles.viewerSelector)}>
                    <li className={Styles.listItem}>
                        <input className={Styles.btnCoord} type="button" value="Converti" onClick={(event) => this.loadRes(event)} />
                    </li>
                    <li className={Styles.listItem}>
                        <button className={Styles.btnCoord} onClick={this.onGoTo}>Vai a</button>
                    </li>
                    {/*<li className={Styles.listItem}>
                        <button className={Styles.btnCoord} onClick={this.clearCoord}>Reset</button>
                    </li>*/}
                </ul>
                <p />
            </div>
            <div className={classNames(Styles.viewer, DropdownStyles.section)}>
                <label>Risultato</label>
                <p><input className={Styles.coordsField} id="conversionOutput" readOnly></input></p>
                <button className={Styles.btnIcon} onClick={this.copyOutCoordsToClipboard}><Icon glyph={Icon.GLYPHS.copy} /></button>
            </div>
        </div>
        )
    },

    render() {
        const dropdownTheme = {
            outer: Styles.coordsPanel,
            inner: Styles.dropdownInner,
        };

        /*return (
            <div>
                <MenuPanel theme={dropdownTheme}
                    btnText="Coordinate"
                    viewState={this.props.viewState}
                    btnTitle="Convertitore di coordinate"
                    isOpen={this.state.isOpen}
                    onOpenChanged={this.changeOpen}
                    smallScreen={this.props.viewState.useSmallScreenInterface}
                >
                    <If condition={this.state.isOpen}>
                        {this.renderContent()}
                    </If>
                </MenuPanel>
            </div>
        );*/

        const isOpen = this.props.viewState.openCoordinateConverterPanel;
        if (isOpen) {
            this.onLoadPickedCoords();
        }

        return (
            <div
                className={classNames(Styles.panel, dropdownTheme.outer, {
                    [Styles.isOpen]: isOpen
                })}
            >
                <button
                    className={Styles.storyBtn}
                    type="button"
                    onClick={this.openClose}
                >
                    <span>Coordinate</span>
                </button>
                <If condition={isOpen}>
                    <Choose>
                        <When condition={!this.props.viewState.useSmallScreenInterface}>
                            <InnerPanel
                                showDropdownAsModal={this.props.showDropdownAsModal}
                                modalWidth={this.props.modalWidth}
                                theme={dropdownTheme}
                                caretOffset={this.state.caretOffset}
                                dropdownOffset={this.state.dropdownOffset}
                            >
                                {this.renderContent()}
                            </InnerPanel>
                        </When>
                        <Otherwise>
                            <InnerPanel
                                theme={dropdownTheme}
                                caretOffset="15px"
                                onDismissed={this.onDismissed}
                            >
                                {this.renderContent()}
                            </InnerPanel>
                        </Otherwise>
                    </Choose>
                </If>
            </div>
        );
    },
});

export default CoordsConverterPanel;
