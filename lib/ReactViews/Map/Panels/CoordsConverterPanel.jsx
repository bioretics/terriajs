'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import ObserverModelMixin from '../../ObserveModelMixin';
import defined from 'terriajs-cesium/Source/Core/defined';
import classNames from 'classnames';
import MenuPanel from '../../StandardUserInterface/customizable/MenuPanel.jsx';

import Styles from './coords-converter-panel.scss';
import DropdownStyles from './panel.scss';
import Icon from "../../Icon.jsx";

import Ellipsoid from 'terriajs-cesium/Source/Core/Ellipsoid';
import CesiumMath from 'terriajs-cesium/Source/Core/Math';

var zoomRectangleFromPoint = require('../../../Map/zoomRectangleFromPoint');

const CoordsConverterPanel = createReactClass({
    displayName: 'CoordsConverterPanel',
    mixins: [ObserverModelMixin],

    propTypes: {
        terria: PropTypes.object,
        userPropWhiteList: PropTypes.array,
        isOpen: PropTypes.bool,
        viewState: PropTypes.object.isRequired,
        epsgList: PropTypes.array,
        x: PropTypes.string,
        y: PropTypes.string,
        sCrs: PropTypes.string,
        tCrs: PropTypes.string
    },

    getDefaultProps() {
        return {
            isOpen: false,
            epsgList: [
                {code: 4326, text: 'WGS 84'}, 
                {code: 32632, text: 'UTM zone 32N'}, {code: 32633, text: 'UTM zone 33N'}, 
                {code: 4265, text: 'Monte Mario'}, {code: 3003, text: 'Monte Mario / Italy zone 1'}, {code: 3004, text: 'Monte Mario / Italy zone 2'}, {code: 4806, text: 'Monte Mario (Rome)'}, 
                {code: 4230, text: 'ED50'}, {code: 23032, text: 'ED50 / UTM zone 32N'}, {code: 23033, text: 'ED50 / UTM zone 33N'}, 
                {code: 4258, text: 'ETRS89'}, {code: 25832, text: 'ETRS89 / UTM zone 32N'}, {code: 25833, text: 'ETRS89 / UTM zone 33N'} ]
        };
    },

    getInitialState() {
        return {
            sCrs: this.props.epsgList[0].code,
            tCrs: this.props.epsgList[0].code,
            x: '',
            y: ''
        };
    },

    onOpenChanged(open) {
        this.setState({
            isOpen: open
        });

        /*if (open) {
            
        }*/
    },

    changedX(event) {
        this.setState({x: event.target.value});
    },

    changedY(event) {
        this.setState({y: event.target.value});
    },

    changedS(event) {
        this.state.sCrs = event.target.value;
    },

    changedT(event) {
        this.state.tCrs = event.target.value;
    },

    loadRes(x, y, sourceCrs, targetCrs) {
        var xmlRequest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                        <wps:Execute service="WPS" version="1.0.0" xmlns:wps="http://www.opengis.net/wps/1.0.0" xmlns:ows="http://www.opengis.net/ows/1.1"
                        xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wps/1.0.0
                        http://schemas.opengis.net/wps/1.0.0/wpsExecute_request.xsd">
                        <ows:Identifier>TransformCoordinates</ows:Identifier>
                        <wps:DataInputs>
                            <wps:Input>
                            <ows:Identifier>SourceCRS</ows:Identifier>
                            <wps:Data>
                                <wps:LiteralData>epsg:` + sourceCrs + `</wps:LiteralData>
                            </wps:Data>
                            </wps:Input>
                            <wps:Input>
                            <ows:Identifier>TargetCRS</ows:Identifier>
                            <wps:Data>
                                <wps:LiteralData>epsg:` + targetCrs + `</wps:LiteralData>
                            </wps:Data>
                            </wps:Input>
                            <wps:Input>
                            <ows:Identifier>InputData</ows:Identifier>
                            <wps:Data>
                                <wps:ComplexData>
                                <MultiGeometry srsName="http://www.opengis.net/gml/srs/epsg.xml#4326" xmlns="http://www.opengis.net/gml">
                                    <geometryMember>
                                    <Point>
                                        <coord>
                                        <X>` + x + `</X>
                                        <Y>` + y + `</Y>
                                        </coord>
                                    </Point>
                                    </geometryMember>
                                </MultiGeometry>
                                </wps:ComplexData>
                            </wps:Data>
                            </wps:Input>
                        </wps:DataInputs>
                        <wps:ResponseForm>
                            <wps:RawDataOutput>
                            <ows:Identifier>TransformedData</ows:Identifier>
                            </wps:RawDataOutput>
                        </wps:ResponseForm>
                        </wps:Execute>`;


        var url = "/proxy/http://geoportale.regione.emilia-romagna.it/rer_wcts/services";

        var xhr = new XMLHttpRequest();
        xhr.addEventListener("readystatechange", processRequest, false);
        xhr.open('POST', url, true);

        xhr.setRequestHeader("Content-type", "text/xml");

        xhr.send(xmlRequest);

        function processRequest(e) {
            if (xhr.readyState == 4 && xhr.status == 200) {
                document.getElementById("conversionOutput").innerHTML = xhr.responseText;
            }
            else {
                console.log('XMLHttpRequest: readyState = ' + xhr.readyState + '  ;  status = ' + xhr.status);
            }
        }
    },

    onLoadPickedCoords(event) {
        if (defined(this.props.terria.pickedFeatures))
        {
            var cartographicCoords = Ellipsoid.WGS84.cartesianToCartographic(this.props.terria.pickedFeatures.pickPosition);

            const latitude = CesiumMath.toDegrees(cartographicCoords.latitude);
            const longitude = CesiumMath.toDegrees(cartographicCoords.longitude);

            this.setState({
                x: longitude,
                y: latitude
            });
        }
    },

    onGoTo(event) {
        var bboxSize = 0.2;
        var rectangle = zoomRectangleFromPoint(this.state.y, this.state.x, bboxSize);
        this.props.terria.currentViewer.zoomTo(rectangle, 2.0);
    },

    render() {
        const dropdownTheme = {
            btn: Styles.btnShare,
            inner: Styles.dropdownInner
        };

        return (
            <MenuPanel theme={dropdownTheme}
                       btnText="Coordinate"
                       viewState={this.props.viewState}
                       btnTitle="Convertitore di coordinate"
                       onOpenChanged={this.onOpenChanged}>
                <If condition={this.state.isOpen}>
                    <div className={classNames(DropdownStyles.header)}>
                        <label className={DropdownStyles.heading}>CONVERTITORE DI COORDINATE</label>
                    </div>
                    <div>
                        <p>
                            <label>Coordinate ultimo click:     </label>
                            <button className={Styles.btnCoordLoad} onClick={this.onLoadPickedCoords}>Carica</button>
                        </p>
                    </div>

                    <div className={classNames(DropdownStyles.section, Styles.section)}>
                        <p>
                            <label>CRS sorgente</label>
                        </p>
                        <p>
                            <select style={{color: 'gray'}} onChange={this.changedS} defaultValue={this.state.sCrs} >
                                { this.props.epsgList.map(function(epsg) { return <option key={epsg.code} value={epsg.code}>{epsg.text}</option>; }) }
                            </select>
                        </p>
                        <p>
                            CRS destinazione
                        </p>
                        <p>
                            <select style={{color: 'gray'}} onChange={this.changedT} defaultValue={this.state.tCrs} >
                                { this.props.epsgList.map(function(epsg) { return <option key={epsg.code} value={epsg.code}>{epsg.text}</option>; }) }
                            </select>
                        </p>
                    </div>
                    <div className={classNames(DropdownStyles.section, Styles.section)}>
                        <p>
                            <label>Coord X</label>
                        </p>
                        <p>
                            <input type="text" name="coordX" style={{color: 'gray'}} onChange={this.changedX} value={this.state.x} />
                        </p>
                        <p>
                            <label>Coord Y</label>
                        </p>
                        <p>
                            <input type="text" name="coordY" style={{color: 'gray'}} onChange={this.changedY} value={this.state.y} />
                        </p>
                    </div>
                    <div className={classNames(Styles.viewer, DropdownStyles.section)}>
                        <ul className={classNames(Styles.viewerSelector)}>
                            <li className={Styles.listItem}>
                                <input className={Styles.btnCoord} type="button" value="Converti" onClick={(event)=>this.loadRes(this.state.x, this.state.y, this.state.sCrs, this.state.tCrs, event)} />
                            </li>
                            <li className={Styles.listItem}>
                                <button className={Styles.btnCoord} onClick={this.onGoTo}>Vai a</button>
                            </li>
                        </ul>
                        <p/>
                        <p/>
                    </div>
                    <div style={{border: 'solid gray'}}>
                        <label>Coordinate convertite</label>
                        <p id="conversionOutput"></p>
                    </div>
                </If>
            </MenuPanel>
        );
    },
});

export default CoordsConverterPanel;
