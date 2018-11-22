'use strict';
import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import ObserveModelMixin from '../../ObserveModelMixin';
import Styles from './navigation_help_button.scss';
import classNames from "classnames";

// 
const NavigationHelpButton = createReactClass({
    displayName: 'Come navigare',
    mixins: [ObserveModelMixin],

    propTypes: {
        terria: PropTypes.object,
        viewState: PropTypes.object.isRequired
    },

    getInitialState() {
        return {
            //isActive: false
        };
    },
    showNavigationHelp() {
        var message = `
            <div>
                <p>La navigazione della mappa 3D è possibile in uno dei seguenti modi:</p>
                <p>* usando il mouse ed il tasto CTRL;</p>
                <p>* tramite i controlli sulla destra dell'interfaccia;</p>
                <p>* attivando il bottone "Naviga da tastiera" ed usando poi questi tasti della tastiera:<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; w = zoom in<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; s = zoom out<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; q = muovi in su<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; e = muovi in giù<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; d = muovi a sinistra<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; a = muovi a destra<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; r = ruota in su<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; f = ruota in giù<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; z = ruota a sinistra<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; x = ruota a destra</p>
            </div>
        `;
        //message += require('./NavigationHelp.html');

        var options = {
            title: 'Come navigare',
            confirmText: ("Ok"),
            width: 600,
            height: 550,
            message: message,
            horizontalPadding : 100
        };
        this.props.viewState.notifications.push(options);
    },

    renderButtonText() {
        return <span className={Styles.exit}>Come navigare</span>;
    },

    render() {
        return (
            <div>
                <button className={Styles.btn} type='button' onClick={this.showNavigationHelp} title='Mostra le istruzioni per la navigazione della mappa'>
                    <span>{this.renderButtonText()}</span>
                </button>
            </div>
        );
    }
});
module.exports = NavigationHelpButton;
