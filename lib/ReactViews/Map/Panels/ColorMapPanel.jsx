'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import ObserverModelMixin from '../../ObserveModelMixin';
import defined from 'terriajs-cesium/Source/Core/defined';
import classNames from 'classnames';
import MenuPanel from '../../StandardUserInterface/customizable/MenuPanel.jsx';

import Styles from './color-map-panel.scss';
import DropdownStyles from './panel.scss';

import Ellipsoid from 'terriajs-cesium/Source/Core/Ellipsoid';
import CesiumMath from 'terriajs-cesium/Source/Core/Math';
const CesiumMaterial = require('terriajs-cesium/Source/Scene/Material');
import { reduce } from 'when';

const ColorMapPanel = createReactClass({
    displayName: 'ColorMapPanel',
    mixins: [ObserverModelMixin],

    propTypes: {
        terria: PropTypes.object,
        userPropWhiteList: PropTypes.array,
        viewState: PropTypes.object.isRequired,
        fromHeight: PropTypes.number,
        toHeight: PropTypes.number,
        color: PropTypes.string
    },

    getDefaultProps() {
        return {}
    },

    getInitialState() {
        return {
            isOpen: false,
            fromHeight: 0,
            toHeight: 4000,
            color: '#FF0000'
        };
    },

    changeOpenState(open) {
        this.setState({
            isOpen: open
        });
    },

    changedFromHeight(event) {
        this.setState({ fromHeight: event.target.value });
    },

    changedToHeight(event) {
        this.setState({ toHeight: event.target.value });
    },

    changedColor(event) {
        this.setState({ color: event.target.value });
    },

    clear() {
        this.setState({ fromHeight: 0 });
        this.setState({ toHeight: 4000 });
        this.setState({ color: '#FF0000' });
        this.props.terria.cesium.scene.globe.material = undefined;
        this.props.terria.cesium.notifyRepaintRequired();
    },

    getColorRamp() {
        var elevationRamp = [0.0, 0.5, 1.0];
        //var elevationRamp = [0.0, 0.045, 0.1, 0.15, 0.37, 0.54, 1.0];
        var ramp = document.createElement('canvas');
        ramp.width = 2000;
        ramp.height = 1;
        var ctx = ramp.getContext('2d');

        var grd = ctx.createLinearGradient(0, 0, 2000, 0);
        /*grd.addColorStop(elevationRamp[0], '#FFFFFF00'); //white
        grd.addColorStop(elevationRamp[1], '#2747E090'); //blue
        grd.addColorStop(elevationRamp[2], '#D33B7D90'); //pink
        grd.addColorStop(elevationRamp[3], '#D3303890'); //red
        grd.addColorStop(elevationRamp[4], '#FF974290'); //orange
        grd.addColorStop(elevationRamp[5], '#FFD70090'); //yellow
        grd.addColorStop(elevationRamp[6], '#FFFFFF00'); //white*/

        grd.addColorStop(elevationRamp[0], '#ff000000'); //white
        grd.addColorStop(elevationRamp[1], this.state.color + '90');
        grd.addColorStop(elevationRamp[2], '#ff000000'); //white

        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 2000, 1);

        /*var rampLegend = document.getElementById('myCanvas');
        var ctx2 = rampLegend.getContext('2d');
        var grd2 = ctx.createLinearGradient(0, 0, 400, 0);
        grd2.addColorStop(elevationRamp[0], '#FFFFFF00'); //white
        grd2.addColorStop(elevationRamp[1], '#2747E0FF'); //blue
        grd2.addColorStop(elevationRamp[2], '#D33B7DFF'); //pink
        grd2.addColorStop(elevationRamp[3], '#D33038FF'); //red
        grd2.addColorStop(elevationRamp[4], '#FF9742FF'); //orange
        grd2.addColorStop(elevationRamp[5], '#FFD700FF'); //yellow
        grd2.addColorStop(elevationRamp[6], '#FFFFFF00'); //white
        ctx2.fillStyle = grd2;
        ctx2.fillRect(0, 0, 400, 100);*/

        return ramp;
    },

    colorByElevationThreshold() {
        const min = this.state.fromHeight;
        const max = this.state.toHeight;
        const scene = this.props.terria.cesium.scene;
        var material = CesiumMaterial.fromType('ElevationRamp');
        var shadingUniforms = material.uniforms;
        shadingUniforms.minimumHeight = min;
        shadingUniforms.maximumHeight = max;
        shadingUniforms.image = this.getColorRamp();
        scene.globe.material = material;
        this.props.terria.cesium.notifyRepaintRequired();
    },

    renderContent() {
        return (<div>
            {/*<div className={classNames(DropdownStyles.header)}>
                <label className={DropdownStyles.heading}>COLORA MAPPA</label>
            </div>*/}
            <div className={classNames(DropdownStyles.section, Styles.section)}>
                <div>Range di altitudine da colorare</div>
                <div className={Styles.explanation}>range min - max (in metri)</div>
                <ul className={classNames(Styles.viewerSelector)}>
                    <li className={Styles.listItemRange}>
                        <input className={Styles.fieldRange} type="number" onChange={this.changedFromHeight} value={this.state.fromHeight} />
                    </li>
                    <li className={Styles.listItemRange}>
                        <input className={Styles.fieldRange} type="number" onChange={this.changedToHeight} value={this.state.toHeight} />
                    </li>
                </ul>
            </div>
            <div className={classNames(DropdownStyles.section, Styles.section)}>
                <div>Colore</div>
                <div className={Styles.explanation}></div>
                <input className={Styles.fieldRange} type="color" onChange={this.changedColor} value={this.state.color} />
                {/*<canvas id="myCanvas" width="400" height="100">Your browser does not support the HTML5 canvas tag.</canvas>*/}
            </div>
            <div className={classNames(Styles.viewer, DropdownStyles.section)}>
                <ul className={classNames(Styles.viewerSelector)}>
                    <li className={Styles.listItem}>
                        <input className={Styles.btnColorMap} type="button" value="Colora" onClick={this.colorByElevationThreshold} />
                    </li>
                    <li className={Styles.listItem}>
                        <button className={Styles.btnColorMap} onClick={this.clear}>Reset</button>
                    </li>
                </ul>
            </div>
        </div>
        )
    },

    render() {
        const dropdownTheme = {
            outer: Styles.colorPanel,
            inner: Styles.dropdownInner,
        };

        return (
            <div>
                <MenuPanel theme={dropdownTheme}
                    btnText="Colora"
                    viewState={this.props.viewState}
                    btnTitle="Filtro colore sull'altitudine"
                    isOpen={this.state.isOpen}
                    onOpenChanged={this.changeOpenState}
                    smallScreen={this.props.viewState.useSmallScreenInterface}>
                    <If condition={this.state.isOpen && this.props.terria.cesium}>
                        {this.renderContent()}
                    </If>
                </MenuPanel>
            </div>
        );
    },
});

export default ColorMapPanel;
