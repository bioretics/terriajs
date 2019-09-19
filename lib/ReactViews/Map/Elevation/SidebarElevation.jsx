import ObserveModelMixin from '../../ObserveModelMixin';
import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import Styles from './sidebar-elevation.scss';

import Chart from '../../Custom/Chart/Chart';
import ChartData from '../../../Charts/ChartData';
import Loader from '../../Loader.jsx';

// Required for updateDistance3D
const CesiumMath = require('terriajs-cesium/Source/Core/Math.js');
const Cartesian3 = require('terriajs-cesium/Source/Core/Cartesian3.js');
const PolylinePipeline = require('terriajs-cesium/Source/Core/PolylinePipeline.js');
const sampleTerrainMostDetailed = require('terriajs-cesium/Source/Core/sampleTerrainMostDetailed.js');
const EllipsoidGeodesic = require('terriajs-cesium/Source/Core/EllipsoidGeodesic.js');

// Handle any of the three kinds of search based on the props
const SidebarElevation = createReactClass({
    displayName: 'SidebarElevation',
    mixins: [ObserveModelMixin],

    propTypes: {
        viewState: PropTypes.object.isRequired,
        isWaitingForSearchToStart: PropTypes.bool,
        terria: PropTypes.object.isRequired
    },

    getInitialState() {
        return {
            totalDistance3DMetres: 0,
            max: undefined,
            min: undefined,
            updateFor3D: false
            //stepDistance3DMetres: [],
        };
    },

    componentDidUpdate(prevProps, prevState) {
        if (prevState.updateFor3D === this.state.updateFor3D) {
            if (this.state.updateFor3D === false) {
                /*const positions = this.props.terria.elevationPoints;
                const maxH = Math.max.apply(Math, positions.map(function(o) { return o.height; }));
                const minH = Math.min.apply(Math, positions.map(function(o) { return o.height; }));
                this.setState({ max: maxH, min: minH });*/

                this.setState({ totalDistance3DMetres: undefined, max: undefined, min: undefined });
            }
            else {
                this.setState({ updateFor3D: false });
            }
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

        console.log("AAAA");
        console.log(this.state.totalDistance3DMetres);

        this.setState({ totalDistance3DMetres: 0 });
        //this.setState({ totalDistance3DMetres: 0, stepDistance3DMetres: undefined });
        const positions = this.props.terria.elevationPoints;
        const scene = this.props.terria.cesium.scene;

        const terrainProvider = scene.terrainProvider;
        const ellipsoid = scene.globe.ellipsoid;
        // Granularity: the distance, in radians, between each latitude and longitude; determines the number of positions in the buffer.
        const granularity = 0.000001;
        const cartesianPositions = ellipsoid.cartographicArrayToCartesianArray(positions);
        const flatPositions = PolylinePipeline.generateArc({
            positions: cartesianPositions,
            granularity: granularity
        });
        const that = this;

        // Conversion from Cartesian3 to Cartographic (the sampleTerrain function get a Cartographic array)
        const cartographicArray = [];
        for (let i = 0; i < flatPositions.length; i += 3) {
            let cartesian = Cartesian3.unpack(flatPositions, i);
            cartographicArray.push(ellipsoid.cartesianToCartographic(cartesian));
        }

        console.log("UUUUUU");
        console.log(cartographicArray);

        // Function to sample and interpole a path over a terrain.
        // sampleTerrain can be used instead of sampleTerrainMostDetailed
        sampleTerrainMostDetailed(terrainProvider, cartographicArray)
            .then(function (raisedPositionsCartographic) {
                let dist = 0;

                const maxH = Math.max.apply(Math, raisedPositionsCartographic.map(function (o) { return o.height; }));
                const minH = Math.min.apply(Math, raisedPositionsCartographic.map(function (o) { return o.height; }));

                // Conversion from Cartographic to Cartesian3.
                let raisedPositions = ellipsoid.cartographicArrayToCartesianArray(raisedPositionsCartographic);

                // Sum the 3D length of each segment.
                for (let i = 1; i < raisedPositions.length; ++i) {
                    let tmpDist = Cartesian3.distance(raisedPositions[i], raisedPositions[i - 1]);
                    dist += tmpDist;
                }

                console.log("GGGG");
                console.log(dist);

                // Set new value in state.
                that.setState({ totalDistance3DMetres: dist, max: maxH, min: minH, updateFor3D: true });

                console.log(this.state.totalDistance3DMetres);


                //that.setState({ totalDistance3DMetres: dist, stepDistance3DMetres: dist3d, updateFor3D: false });
                // Update React UI.
                that.state.userDrawing.causeUpdate();
            });
    },

    removeAll() {
        this.props.terria.elevationPoints = undefined;
    },

    getBearing() {
        const positions = this.props.terria.elevationPoints;
        const ellipsoid = this.props.terria.cesium.scene.globe.ellipsoid;

        var start = positions[0];
        var end = positions[positions.length - 1];

        var geo = new EllipsoidGeodesic(start, end, ellipsoid);
        var bearing = (CesiumMath.toDegrees(geo.startHeading) + 360) % 360;
        return bearing.toFixed(0) + "°";
    },

    getHeightDifference() {
        const positions = this.props.terria.elevationPoints;

        var start = positions[0];
        var end = positions[positions.length - 1];

        var difference = end.height - start.height;
        return difference.toString() + "m";
    },

    handleUpdateDistance3DClick() {
        this.updateDistance3D();
    },

    render() {
        if(typeof this.props.terria.elevationPoints == 'undefined') {
            return (<div></div>);
        }
        
        const chartPoints = [];
        const distData = [];
        let positions = this.props.terria.elevationPoints;
        let hasError = false;
        if (positions.length > 1) {
            for (let i = 0; i < positions.length; ++i) {
                if (isNaN(positions[i].height)) {
                    positions = [];
                    hasError = true;
                    break;
                }
                chartPoints.push({ x: i + 1, y: Math.round(positions[i].height) });
                if (i === 0) {
                    distData.push(0);
                }
                else {
                    distData.push(positions[i]);
                }
            }
        }
        const chartData = new ChartData(chartPoints, { categoryName: 'altitudine', name: 'elevation', units: 'm', color: 'white' });

        return (
            <div>
                <Choose>
                    <When condition={hasError}>
                        <div className={Styles.elevation}>
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
                    </When>
                    <When condition={this.props.terria.elevationPoints}>
                        <div className={Styles.elevation}>
                            <font color="white">
                                <center><b>Distanza 3D</b></center>
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <button type='button' className={Styles.btnDone}
                                            title='misura la distanza fra una serie di punti 3D (tenendo conto della altitudine)'
                                            onClick={this.handleUpdateDistance3DClick}>
                                            Calcola
                                    </button>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <input className={Styles.distanceField} type="text" readOnly
                                            value={this.prettifyNumber(this.state.totalDistance3DMetres)} />
                                    </li>
                                </ul>
                                <hr />
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <center><b>Alt. Min</b></center>
                                        <center><input className={Styles.bearingField} type="text" readOnly
                                            value={this.prettifyNumber(this.state.min)} /></center>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <center><b>Alt. Max</b></center>
                                        <center><input className={Styles.bearingField} type="text" readOnly
                                            value={this.prettifyNumber(this.state.max)} /></center>
                                    </li>
                                </ul>
                                <hr />
                                <ul className={Styles.viewerSelector}>
                                    <li className={Styles.listItem}>
                                        <center><b>Rotta</b></center>
                                        <center><input className={Styles.bearingField} type="text" readOnly
                                            value={this.getBearing()} /></center>
                                    </li>
                                    <li className={Styles.listItem}>
                                        <center><b>Dislivello</b></center>
                                        <center><input className={Styles.bearingField} type="text" readOnly
                                            value={this.getHeightDifference()} /></center>
                                    </li>
                                </ul>
                                <hr />
                                <center><b>Profilo altimetrico</b></center>
                                <div >
                                    <Chart data={[chartData]} height={200} />
                                </div>
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
                                                <When condition={this.props.terria.stepDistanceMetres && idx > 0 && this.props.terria.stepDistanceMetres.length > 0}>
                                                    <li className={Styles.colnormal}>{this.props.terria.stepDistanceMetres[idx]}</li>
                                                </When>
                                                <Otherwise>
                                                    <li className={Styles.colnormal}></li>
                                                </Otherwise>
                                            </Choose>
                                        </ul>
                                    </For>
                                </div>
                                <hr />
                                <br />
                                <button type='button' onClick={this.removeAll} className={Styles.btnDone}>Chiudi</button>
                            </font>
                        </div>
                    </When>
                </Choose>
            </div>
        );
    },
});

module.exports = SidebarElevation;

