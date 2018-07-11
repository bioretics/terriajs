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
const CesiumMaterial = require('terriajs-cesium/Source/Scene/Material');

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
            totalDistance3DMetres: 0
        };
    },

    prettifyNumber(number, squared) {
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

    getColorRamp() {
        var elevationRamp = [0.0, 0.045, 0.1, 0.15, 0.37, 0.54, 1.0];
        //var slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2)/2, 0.87, 0.91, 1.0];
        var ramp = document.createElement('canvas');
        ramp.width = 9000;
        ramp.height = 1;
        var ctx = ramp.getContext('2d');

        var values = elevationRamp;

        /*grd.addColorStop(values[0], '#00000040'); //black
        grd.addColorStop(values[1], '#2747E040'); //blue
        grd.addColorStop(values[2], '#D33B7D40'); //pink
        grd.addColorStop(values[3], '#D3303840'); //red
        grd.addColorStop(values[4], '#FF974240'); //orange
        grd.addColorStop(values[5], '#ffd70040'); //yellow
        grd.addColorStop(values[6], '#ffffff40'); //white*/

        //ctx.fillStyle = grd;
        //ctx.fillRect(0, 0, 100, 1);

        ctx.fillStyle = '#FF0000B0';
        ctx.fillRect(150, 0, 160, 1);

        return ramp;
    },

    colorByElevationThreshold() {
        /*var material = CesiumMaterial.fromType('ElevationRamp');
        var shadingUniforms = material.uniforms;
        shadingUniforms.minimumHeight = 0;
        shadingUniforms.maximumHeight = 9000;
        shadingUniforms.image = this.getColorRamp();
        scene.globe.material = material;*/
    },

    /**
* Update distance using 3D points instead of 2D points (so elevation also is considered).
*/
    updateDistance3D() {
        this.setState({ totalDistance3DMetres: 0 });
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

        // Function to sample and interpole a path over a terrain.
        // sampleTerrain can be used instead of sampleTerrainMostDetailed
        sampleTerrainMostDetailed(terrainProvider, cartographicArray)
            .then(function (raisedPositionsCartographic) {
                let dist = 0;

                // Conversion from Cartographic to Cartesian3.
                let raisedPositions = ellipsoid.cartographicArrayToCartesianArray(raisedPositionsCartographic);

                // Sum the 3D length of each segment.
                for (let i = 1; i < raisedPositions.length; ++i) {
                    dist += Cartesian3.distance(raisedPositions[i], raisedPositions[i - 1]);
                }

                // Set new value in state.
                that.setState({ totalDistance3DMetres: dist });
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
        const chartPoints = [];
        const positions = this.props.terria.elevationPoints;
        if (positions.length > 1) {
            for (let i = 0; i < positions.length; ++i) {
                chartPoints.push({ x: i + 1, y: Math.round(positions[i].height) });
            }
        }
        const chartData = new ChartData(chartPoints, { categoryName: 'altitudine', name: 'elevation', units: 'm', color: 'white' });

        //if (this.props.isWaitingForSearchToStart) {
        //    return <div key="loader" className={Styles.loader}><Loader /></div>;
        //}

        return (
            <div>
                <If condition={this.props.terria.elevationPoints}>
                    <p />
                    <p />
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
                            <br />
                            <hr />
                            <br />
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
                            <br />
                            <hr />
                            <br />
                            <center><b>Profilo altimetrico</b></center>
                            <div >
                                <Chart data={[chartData]} height={200} />
                            </div>
                            <button type='button' onClick={this.removeAll} className={Styles.btnDone}>Fatto</button>
                        </font>
                    </div>
                </If>
            </div>
        );
    },
});

module.exports = SidebarElevation;

