import React from 'react';

import createReactClass from 'create-react-class';

import PropTypes from 'prop-types';

import knockout from 'terriajs-cesium/Source/ThirdParty/knockout';
import ObserveModelMixin from '../ObserveModelMixin';
import SearchBox from '../Search/SearchBox.jsx';
import SidebarSearch from '../Search/SidebarSearch.jsx';
import Workbench from '../Workbench/Workbench.jsx';
import Icon from '../Icon.jsx';
import FullScreenButton from './FullScreenButton.jsx';
import { removeMarker } from '../../Models/LocationMarkerUtils';

import Styles from './side-panel.scss';


import SidebarElevation from '../Map/Elevation/SidebarElevation.jsx';

//import SplitPane from 'react-split-pane';

const SidePanel = createReactClass({
    displayName: 'SidePanel',
    mixins: [ObserveModelMixin],

    propTypes: {
        terria: PropTypes.object.isRequired,
        viewState: PropTypes.object.isRequired
    },

    componentDidMount() {
        this.subscribeToProps();
    },

    componentDidUpdate() {
        this.subscribeToProps();
    },

    componentWillUnmount() {
        this.unsubscribeFromProps();
    },

    subscribeToProps() {
        this.unsubscribeFromProps();

        // Close the search results when the Now Viewing changes (so that it's visible).
        this._nowViewingChangeSubscription = knockout.getObservable(this.props.terria.nowViewing, 'items').subscribe(() => {
            this.props.viewState.searchState.showLocationSearchResults = false;
        });
    },

    unsubscribeFromProps() {
        if (this._nowViewingChangeSubscription) {
            this._nowViewingChangeSubscription.dispose();
            this._nowViewingChangeSubscription = undefined;
        }
    },

    onAddDataClicked() {
        this.props.viewState.openAddData();
    },

    onAddLocalDataClicked() {
        this.props.viewState.openUserData();
    },

    changeSearchText(newText) {
        this.props.viewState.searchState.locationSearchText = newText;

        if (newText.length === 0) {
            removeMarker(this.props.terria);
        }
    },

    search() {
        this.props.viewState.searchState.searchLocations();
    },

    startLocationSearch() {
        this.props.viewState.searchState.showLocationSearchResults = true;
    },

    render() {
        const searchState = this.props.viewState.searchState;

        this.props.terria.currentViewer.notifyRepaintRequired();

        return (
            <div className={Styles.workBench}>
                <div className={Styles.header}>

                    <FullScreenButton
                        terria={this.props.terria}
                        viewState={this.props.viewState}
                        minified={true}
                        animationDuration={250}
                    />

                    <SearchBox
                        onSearchTextChanged={this.changeSearchText}
                        onDoSearch={this.search}
                        onFocus={this.startLocationSearch}
                        searchText={searchState.locationSearchText}
                        placeholder='Cerca'

                    />
                    <div className={Styles.addData}>
                        <button type='button' onClick={this.onAddDataClicked} className={Styles.button} title='Aggiungi layer da catalogo'>
                            <Icon glyph={Icon.GLYPHS.add} />Apri catalogo
                        </button>
                        <button
                            type='button'
                            onClick={this.onAddLocalDataClicked}
                            className={Styles.uploadData}
                            title='Aggiungi nuovo layer'
                        >
                            <Icon glyph={Icon.GLYPHS.upload} />
                        </button>
                    </div>
                </div>
                {/*<SplitPane defaultSize={500} minSize={300} style={{position:"relative"}} split="horizontal" resizerClassName={Styles.Resizer}>*/}
                <div className={Styles.body}>
                    <Choose>
                        <When condition={searchState.locationSearchText.length > 0 && searchState.showLocationSearchResults}>
                            <SidebarSearch
                                terria={this.props.terria}
                                viewState={this.props.viewState}
                                isWaitingForSearchToStart={searchState.isWaitingToStartLocationSearch} />
                        </When>
                        <Otherwise>
                            <Choose>
                                <When condition={this.props.terria.cesium && this.props.terria.elevationPoints}>
                                    <SidebarElevation
                                        terria={this.props.terria}
                                        viewState={this.props.viewState}
                                        isWaitingForSearchToStart={searchState.isWaitingToStartLocationSearch} />
                                </When>
                                <When condition={this.props.terria.nowViewing.items && this.props.terria.nowViewing.items.length > 0}>
                                    <Workbench viewState={this.props.viewState} terria={this.props.terria} />
                                </When>
                                <Otherwise>
                                    <div className={Styles.workbenchEmpty}>
                                        <div>Il pannello dei layer è vuoto</div>
                                        <p>
                                            <strong>
                                                Click su &apos;Aggiungi layer&apos; per:
                                    </strong>
                                        </p>
                                        <ul>
                                            <li>visionare il catalogo corrente</li>
                                            <li>caricare nuovi dati</li>
                                        </ul>
                                        <p><Icon glyph={Icon.GLYPHS.bulb} /><strong>INFO:</strong> <em>Tutti i layer attivi saranno elencati qui</em></p>
                                    </div>
                                </Otherwise>
                            </Choose>
                        </Otherwise>
                    </Choose>
                </div>
                {/*</SplitPane>*/}
            </div>
        );
    }
});

module.exports = SidePanel;
