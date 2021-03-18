import ObserveModelMixin from '../../ObserveModelMixin';
import React from 'react';
import createReactClass from 'create-react-class';
import classNames from "classnames";
import PropTypes from 'prop-types';
import Styles from './sidebar-elevation.scss';

import Input from "../../Styled/Input/Input.jsx";

import ElevationChartPanel from "../../Custom/Chart/ElevationChartPanel.jsx";

// Required for updateDistance3D
const CesiumMath = require('terriajs-cesium/Source/Core/Math.js').default;
const Cartesian3 = require('terriajs-cesium/Source/Core/Cartesian3.js').default;
const PolylinePipeline = require('terriajs-cesium/Source/Core/PolylinePipeline.js').default;
const sampleTerrainMostDetailed = require('terriajs-cesium/Source/Core/sampleTerrainMostDetailed.js').default;
const EllipsoidGeodesic = require('terriajs-cesium/Source/Core/EllipsoidGeodesic.js').default;

// Handle any of the three kinds of search based on the props
const SidebarElevation = createReactClass({
    displayName: 'SidebarElevation',
    mixins: [ObserveModelMixin],

    propTypes: {
        viewState: PropTypes.object.isRequired,
        terria: PropTypes.object.isRequired
    },

    getInitialState() {
        return {
            updateFor3D: false
        };
    },

    componentDidUpdate(prevProps, prevState) {
        if (prevState.updateFor3D === this.state.updateFor3D && this.state.updateFor3D === true) {
            this.setState({ updateFor3D: false });
        }
    },

    prettifyNumber(number, squared) {
        if (typeof number == 'undefined') {
            return 0;
        }

        if (number <= 0) {
            return "";
        }
        // Given a number representing a number in metres, make it human readable
        let label = "m";
        if (squared) {
            if (number > 999999) {
                label = "km";
                number = number / 1000000.0;
            }
        } else {
            if (number > 999) {
                label = "km";
                number = number / 1000.0;
            }
        }

        number = number.toFixed(2);
        // http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
        number = number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        let numberStr = number + " " + label;
        if (squared) {
            numberStr += "\u00B2";
        }
        return numberStr;
    },

    /**
    * Update distance using 3D points instead of 2D points (so elevation also is considered).
    */
    updateDistance3D() {
        //this.setState({ totalDistance3DMetres: 0 });
        //this.setState({ totalDistance3DMetres: 0/*, stepDistance3DMetres: undefined*/ });
        const positions = this.props.terria.elevationPoints[0];
        const scene = this.props.terria.cesium.scene;

        const terrainProvider = scene.terrainProvider;
        const ellipsoid = scene.globe.ellipsoid;
        // Granularity: the distance, in radians, between each latitude and longitude; determines the number of positions in the buffer.
        const granularity = 0.000005;
        const cartesianPositions = ellipsoid.cartographicArrayToCartesianArray(positions);
        const cartographicArray = ellipsoid.cartesianArrayToCartographicArray(
            PolylinePipeline.generateCartesianArc({
                positions: cartesianPositions,
                granularity: granularity
            })
        );

        const that = this;
        // Function to sample and interpole a path over a terrain.
        // sampleTerrain can be used instead of sampleTerrainMostDetailed
        sampleTerrainMostDetailed(terrainProvider, cartographicArray)
            .then(function (raisedPositionsCartographic) {
                const maxH = Math.max.apply(Math, raisedPositionsCartographic.map(function (o) { return o.height; }));
                const minH = Math.min.apply(Math, raisedPositionsCartographic.map(function (o) { return o.height; }));
                // Conversion from Cartographic to Cartesian3.
                let raisedPositions = ellipsoid.cartographicArrayToCartesianArray(raisedPositionsCartographic);
                let dist = 0;
                let tmp3dPos = [0.0];
                // Sum the 3D length of each segment.
                for (let i = 1; i < raisedPositions.length; ++i) {
                    let tmpDist = Cartesian3.distance(raisedPositions[i], raisedPositions[i - 1]);
                    dist += tmpDist;
                    tmp3dPos.push(dist);
                }

                // Set new value in state.
                that.props.terria.detailedElevationPath.totalDistance3DMetres = dist;
                that.props.terria.detailedElevationPath.maxH = maxH;
                that.props.terria.detailedElevationPath.minH = minH;
                that.props.terria.sampledElevationPoints = [[...raisedPositionsCartographic], [...tmp3dPos]];
                that.setState({ 
                    updateFor3D: true
                });
            }, function(reason) {
                console.log(reason)
            });
    },

    removeAll() {
        if(!this.props.viewState.useSmallScreenInterface)
            this.props.terria.elevationPoints = undefined;
    },

    showChart() {
        this.props.viewState.showElevationChart = !this.props.viewState.showElevationChart;
    },

    getBearing() {
        const positions = this.props.terria.elevationPoints[0];
        const ellipsoid = this.props.terria.cesium.scene.globe.ellipsoid;

        var start = positions[0];
        var end = positions[positions.length - 1];

        var geo = new EllipsoidGeodesic(start, end, ellipsoid);
        var bearing = (CesiumMath.toDegrees(geo.startHeading) + 360) % 360;

        this.props.terria.detailedElevationPath.bearing = bearing;

        return bearing.toFixed(0) + "°";
    },

    getHeightDifference() {
        const positions = this.props.terria.elevationPoints[0];

        var start = positions[0];
        var end = positions[positions.length - 1];

        var difference = end.height - start.height;
        return difference.toString() + "m";
    },

    handleUpdateDistance3DClick() {
        this.updateDistance3D();
    },

    render() {
        if((!this.props.viewState.useSmallScreenInterface && typeof this.props.terria.elevationPoints == 'undefined')) {
            return (<div></div>);
        }

        let positions = this.props.terria.elevationPoints[0];
        let stepDistanceMeters = this.props.terria.elevationPoints[1];

        return (
            <div>
                <Choose>
                    {/*<When condition={hasError}>
                        <div className={classNames({
                            [Styles.elevation]: !this.props.viewState.useSmallScreenInterface,
                            [Styles.elevationMobile]: this.props.viewState.useSmallScreenInterface
                            })}>
                            <div>
                                <strong>
                                    Alcuni punti della misura sono stati impostati in modalità 2D e sono quindi sprovvisti del dato di altitutine!
                                    <br />
                                    Chiudere il misuratore e procedere nuovamente ma in modalità 3D.
                                    </strong>
                            </div>
                            <div>
                                <button type='button' onClick={this.removeAll} className={Styles.btnDone}>Chiudi</button>
                            </div>
                        </div>
                    </When>*/}
                    <When condition={this.props.terria.elevationPoints && this.props.terria.elevationPoints[0] && this.props.terria.elevationPoints[0].length > 1}>
                        <div className={classNames({
                            [Styles.elevation]: !this.props.viewState.useSmallScreenInterface,
                            [Styles.elevationMobile]: this.props.viewState.useSmallScreenInterface
                            })}>
                            <font color="white">
                                {/*<center><h3>Percorsi</h3></center>*/}
                                <If condition={!this.props.viewState.useSmallScreenInterface}>
                                        <button type='button' onClick={this.removeAll} className={Styles.btnDone}>Chiudi</button>
                                        <button type='button' onClick={this.showChart} className={Styles.btnDone}>Grafico</button>
                                        <br/>
                                        <br/>
                                </If>
                                <center><b>Distanza 3D</b></center>
                                <center>Calcolata su tutto il percorso e non solo sulle tappe.</center>
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <button type='button' className={Styles.btnDone}
                                            title='misura la distanza fra una serie di punti 3D (tenendo conto della altitudine)'
                                            onClick={this.handleUpdateDistance3DClick}>
                                            Calcola
                                    </button>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <Input dark className={Styles.distanceField} type="text" readOnly
                                            value={this.prettifyNumber(this.props.terria.detailedElevationPath.totalDistance3DMetres)} />
                                    </li>
                                </ul>
                                {/*<hr />*/}
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <center><b>Alt. Min</b></center>
                                        <center><Input dark className={Styles.bearingField} type="text" readOnly
                                            value={this.prettifyNumber(this.props.terria.detailedElevationPath.minH)} /></center>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <center><b>Alt. Max</b></center>
                                        <center><Input dark className={Styles.bearingField} type="text" readOnly
                                            value={this.prettifyNumber(this.props.terria.detailedElevationPath.maxH)} /></center>
                                    </li>
                                </ul>
                                <hr />
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <center><b>Rotta</b></center>
                                        <center><Input dark className={Styles.bearingField} type="text" readOnly
                                            value={this.getBearing()} /></center>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <center><b>Dislivello</b></center>
                                        <center><Input dark className={Styles.bearingField} type="text" readOnly
                                            value={this.getHeightDifference()} /></center>
                                    </li>
                                </ul>
                                <hr />
                                <center><b>Dettaglio tappe</b></center>
                                <div>
                                    <ul className={Styles.table}>
                                        <li className={Styles.colsmall}>#</li>
                                        <li className={Styles.colnormal}>Altitudine</li>
                                        <li className={Styles.colnormal}>Dislivello</li>
                                        <li className={Styles.colnormal}>Distanza</li>
                                    </ul>
                                    <For each="item" index="idx" of={positions}>
                                        <ul className={Styles.table} key={idx}>
                                            <li className={Styles.colsmall}>{idx + 1}</li>
                                            <li className={Styles.colnormal}>{item.height}</li>
                                            <Choose>
                                                {/*<When condition={this.props.terria.elevationPoints && }>
                                                <li className={Styles.colnormal}>{this.prettifyNumber(this.state.stepDistance3DMetres[idx])}</li>
                                            </When>*/}
                                                <When condition={idx > 0}>
                                                    <li className={Styles.colnormal}>{item.height - positions[idx - 1].height}</li>
                                                </When>
                                                <Otherwise>
                                                    <li className={Styles.colnormal}></li>
                                                </Otherwise>
                                            </Choose>
                                            <Choose>
                                                <When condition={stepDistanceMeters && idx > 0 && stepDistanceMeters.length > 0}>
                                                    <li className={Styles.colnormal}>{this.prettifyNumber(stepDistanceMeters[idx])}</li>
                                                </When>
                                                <Otherwise>
                                                    <li className={Styles.colnormal}></li>
                                                </Otherwise>
                                            </Choose>
                                        </ul>
                                    </For>
                                </div>
                            </font>
                        </div>
                        <If condition={this.props.viewState.useSmallScreenInterface}>
                            <div className={Styles.elevationMobile}>
                                <ElevationChartPanel
                                    terria={this.props.terria}
                                    onHeightChange={this.onHeightChange}
                                    viewState={this.props.viewState}
                                />
                            </div>
                        </If>
                    </When>
                </Choose>
            </div>
        );
    },
});

module.exports = SidebarElevation;

