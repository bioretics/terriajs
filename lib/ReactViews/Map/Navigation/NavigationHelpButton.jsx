'use strict';
const React = require('react');
import ObserveModelMixin from '../../ObserveModelMixin';
import triggerResize from '../../../Core/triggerResize';
import Styles from './full_screen_button.scss';
import classNames from "classnames";
import Icon from "../../Icon.jsx";

// 
const NavigationHelpButton = React.createClass({
    mixins: [ObserveModelMixin],

    propTypes: {
        terria: React.PropTypes.object,
        viewState: React.PropTypes.object.isRequired,
        animationDuration: React.PropTypes.number // Defaults to 1 millisecond.
    },

    getInitialState() {
        return {
            isActive: false
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
        const btnClassName = classNames(Styles.btn, {
            [Styles.isActive]: this.props.viewState.isMapFullScreen
        });
        return (
            <div className={Styles.fullScreen}>
                <button type='button' onClick={this.showNavigationHelp} title='Mostra le istruzioni per la navigazione della mappa'
                        className={btnClassName}><span>{this.renderButtonText()}</span></button>
            </div>
        );
    }
});
module.exports = NavigationHelpButton;
