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
            /*epsgList: [
                { code: 4326, text: 'WGS 84' },
                { code: 32632, text: 'UTM zone 32N' }, { code: 32633, text: 'UTM zone 33N' },
                { code: 4265, text: 'Monte Mario' }, { code: 3003, text: 'Monte Mario / Italy zone 1' }, { code: 3004, text: 'Monte Mario / Italy zone 2' }, { code: 4806, text: 'Monte Mario (Rome)' },
                { code: 4230, text: 'ED50' }, { code: 23032, text: 'ED50 / UTM zone 32N' }, { code: 23033, text: 'ED50 / UTM zone 33N' },
                { code: 4258, text: 'ETRS89' }, { code: 25832, text: 'ETRS89 / UTM zone 32N' }, { code: 25833, text: 'ETRS89 / UTM zone 33N' }]*/
            conversionList: [
                { desc: 'Monte Mario / Italy zone 1 → WGS84', from: 3003, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'Monte Mario / Italy zone 2 → WGS84', from: 3004, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'Monte Mario → WGS84', from: 4265, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'UTMRER → WGS84', from: 5659, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'ETRS89 → WGS84', from: 4258, to: 4326 },
                { desc: 'ETRS89 / UTM zone 32N → WGS84', from: 25832, to: 4326 },
                { desc: 'ETRS89 / UTM zone 33N → WGS84', from: 25833, to: 4326 },
                { desc: 'RDN2008 → WGS84', from: 6706, to: 4326 },
                { desc: 'RDN2008 / UTM zone 32N → WGS84', from: 7791, to: 4326 },
                { desc: 'RDN2008 / UTM zone 33N → WGS84', from: 7792, to: 4326 },
                { desc: 'ED50 → WGS84', from: 4230, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'ED50 / UTM zone 32N → WGS84', from: 23032, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'ED50 / UTM zone 33N → WGS84', from: 23033, to: 4326, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'WGS 84 / UTM zone 32N → WGS84', from: 32632, to: 4326 },
                { desc: 'WGS 84 / UTM zone 33N → WGS84', from: 32633, to: 4326 },
                { desc: 'WGS84 → Monte Mario / Italy zone 1', from: 4326, to: 3003, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'WGS84 → Monte Mario / Italy zone 2', from: 4326, to: 3004, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'WGS84 → Monte Mario', from: 4326, to: 4265, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'WGS84 → UTMRER', from: 4326, to: 5659, wkt: {"wkt":"GEOGTRAN[\"CGT_AD400_MM_ETRS89_V1A\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_ad400_v1/RER_AD400_MM_ETRS89_V1A\",0.0]]"} },
                { desc: 'WGS84 → ETRS89', from: 4326, to: 4258 },
                { desc: 'WGS84 → ETRS89 / UTM zone 32N', from: 4326, to: 25832 },
                { desc: 'WGS84 → ETRS89 / UTM zone 33N', from: 4326, to: 25833 },
                { desc: 'WGS84 → RDN2008', from: 4326, to: 6706 },
                { desc: 'WGS84 → RDN2008 / UTM zone 32N', from: 4326, to: 7791 },
                { desc: 'WGS84 → RDN2008 / UTM zone 33N', from: 4326, to: 7792 },
                { desc: 'WGS84 → ED50', from: 4326, to: 4230, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'WGS84 → ED50 / UTM zone 32N', from: 4326, to: 23032, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'WGS84 → ED50 / UTM zone 33N', from: 4326, to: 23033, wkt: {"wkt":"GEOGTRAN[\"CGT_ED50_ETRS89_GPS7_K2\",GEOGCS[\"GCS_European_1950\",DATUM[\"D_European_1950\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_ED50_ETRS89_GPS7_K2\",0.0]]"} },
                { desc: 'WGS84 → WGS 84 / UTM zone 32N', from: 4326, to: 32632 },
                { desc: 'WGS84 → WGS 84 / UTM zone 33N', from: 4326, to: 32633 }
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
        };
    },

    changeOpen(open) {
        /*this.setState({
            isOpen: open
        });*/
        this.props.viewState.openCoordinateConverterPanel = open;
    },

    openClose() {
        this.props.viewState.openCoordinateConverterPanel = !this.props.viewState.openCoordinateConverterPanel;
    },

    changedCoords(event) {
        var text = event.target.value;
        var splitted = text.split(/[ |,|;]+/g);
        this.setState({ coordsTxt: text });
        this.setState({ y: splitted[0] });
        this.setState({ x: splitted[1] });
    },

    /*changedS(event) {
        this.state.sCrs = event.target.value;
    },

    changedT(event) {
        this.state.tCrs = event.target.value;
    },*/

    changeCSR(event) {
        this.setState({selectConversion: event.target.value});
    },

    //changedHidden(event) { },

    loadRes() {
        CesiumResource.fetchJson({
            url: "http://servizigis.regione.emilia-romagna.it/arcgis/rest/services/Utilities/Geometry/GeometryServer/project",
            queryParameters: {
                inSR: this.props.conversionList[this.state.selectConversion].from,
                outSR: this.props.conversionList[this.state.selectConversion].to,
                geometries: this.state.coordsTxt,
                transformation: JSON.stringify({ wkt: "GEOGTRAN[\"CGT_MM_ETRS89_GPS7_K2\",GEOGCS[\"GCS_Monte_Mario\",DATUM[\"D_Monte_Mario\",SPHEROID[\"International_1924\",6378388.0,297.0]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],GEOGCS[\"GCS_ETRS_1989\",DATUM[\"D_ETRS_1989\",SPHEROID[\"GRS_1980\",6378137.0,298.257222101]],PRIMEM[\"Greenwich\",0.0],UNIT[\"Degree\",0.0174532925199433]],METHOD[\"NTv2\"],PARAMETER[\"Dataset_it_emirom_gps7_k2/RER_MM_ETRS89_GPS7_K2\",0.0]]" }),
                f: 'json'
            }
        }).then(function (results) {
            if(results.geometries) {
                const geom = results.geometries[0];
                document.getElementById("conversionOutput").value = geom.x + ", " + geom.y;
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
                x: longitude,
                y: latitude,
                coordsTxt: latitude + ", " + longitude
            });
        }
    },

    onGoTo(event) {
        var bboxSize = 0.005;
        var rectangle = zoomRectangleFromPoint(this.state.y, this.state.x, bboxSize);
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
                    <label>Coordinate ("lat, lon")</label>
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
                        {this.props.conversionList.map(function (conv, index) { return <option key={index} className={Styles.crsItem} value={index}>{conv.desc}</option>; })}
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
                    <li className={Styles.listItem}>
                        <button className={Styles.btnCoord} onClick={this.clearCoord}>Reset</button>
                    </li>
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
