'use strict';

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import {buildShareLink, buildShortShareLink, canShorten} from './BuildShareLink';
import ObserverModelMixin from '../../../ObserveModelMixin';
import defined from 'terriajs-cesium/Source/Core/defined';
import classNames from 'classnames';
import MenuPanel from '../../../StandardUserInterface/customizable/MenuPanel.jsx';
import Clipboard from '../../../Clipboard';

import Styles from './share-panel.scss';
import DropdownStyles from '../panel.scss';
import Icon from "../../../Icon.jsx";

const SharePanel = createReactClass({
    displayName: 'SharePanel',
    mixins: [ObserverModelMixin],

    propTypes: {
        terria: PropTypes.object,
        userPropWhiteList: PropTypes.array,
        isOpen: PropTypes.bool,
        advancedIsOpen: PropTypes.bool,
        shortenUrls: PropTypes.bool,
        viewState: PropTypes.object.isRequired
    },

    getDefaultProps() {
        return {
            isOpen: false,
            advancedIsOpen: false,
            shortenUrls: false
        };
    },

    getInitialState() {
        return {
            shortenUrls: this.props.shortenUrls && this.props.terria.getLocalProperty('shortenShareUrls'),
            imageUrl: '',
            shareUrl: ''
        };
    },

    advancedOptions() {
        return this.state.advancedIsOpen;
    },

    toggleAdvancedOptions(e) {
        this.setState((prevState) => ({
            advancedIsOpen: !prevState.advancedIsOpen
        }));
    },

    updateForShortening() {
        this.setState({
            shareUrl: ''
        });

        if (this.shouldShorten()) {
            this.setState({
                placeholder: 'Shortening...'
            });

            buildShortShareLink(this.props.terria)
                .then(shareUrl => this.setState({shareUrl}))
                .otherwise(() => {
                    this.setUnshortenedUrl();
                    this.setState({
                        errorMessage: 'Errore nel tentativo di abbreviazione URL.  Controllare la connessione internet e riprovare.'
                    });
                });
        } else {
            this.setUnshortenedUrl();
        }
    },

    setUnshortenedUrl() {
        this.setState({
            shareUrl: buildShareLink(this.props.terria)
        });
    },

    isUrlShortenable() {
        return canShorten(this.props.terria);
    },

    shouldShorten() {
        const localStoragePref = this.props.terria.getLocalProperty('shortenShareUrls');

        return this.isUrlShortenable() && (localStoragePref || !defined(localStoragePref));
    },

    onShortenClicked(e) {
        if (this.shouldShorten()) {
            this.props.terria.setLocalProperty('shortenShareUrls', false);
        } else if (this.isUrlShortenable()) {
            this.props.terria.setLocalProperty('shortenShareUrls', true);
        } else {
            return;
        }

        this.updateForShortening();
        this.forceUpdate();
    },

    onOpenChanged(open) {
        this.setState({
            isOpen: open
        });

        if (open) {
            this.props.terria.currentViewer.captureScreenshot().then(dataUrl => {
                this.setState({
                    imageUrl: dataUrl
                });
            });

            this.updateForShortening();
        }
    },

    renderSmallScreen(iframeCode, shareImgStyle, shareUrlTextBox) {
      return (<div>
        <div className={Styles.clipboard}><Clipboard source={shareUrlTextBox} id='share-url'/></div>
        <div className={DropdownStyles.section}>
              <a className={Styles.link} href={this.state.imageUrl} target='_blank'><div className={Styles.imgShare} style={shareImgStyle}></div></a>
        </div>
        <If condition={this.isUrlShortenable()}>
            <div className={classNames(DropdownStyles.section, Styles.shortenUrl)}>
                <button onClick={this.onShortenClicked}>
                    {this.shouldShorten() ? <Icon glyph={Icon.GLYPHS.checkboxOn}/> : <Icon glyph={Icon.GLYPHS.checkboxOff}/>}
                    Abbrevia l'URL
                </button>
            </div>
        </If>
      </div>);
    },

    renderNormal(iframeCode, shareImgStyle, shareUrlTextBox) {
        const btnStyle = {
            font: '14px Open Sans',
            textDecorationLine: 'none',
            backgroundColor: '#1ac9f6',
            color: '#ffffff',
            padding: '8px 8px 8px 8px',
          };
      return (
        <div>
          <div className={DropdownStyles.section}>
              <a className={Styles.link} href={this.state.imageUrl} target='_blank'><div className={Styles.imgShare} style={shareImgStyle}></div></a>
          </div>
          {/* Esplicitata la possibilità di salvare su disco lo screenshot della mappa */}
          <div className={Styles.clipboard}>
              <a style={btnStyle} href={this.state.imageUrl} download="screenshot_mappa.jpg">Salva screenshot mappa</a>
          </div>
          <div className={Styles.clipboard}><Clipboard source={shareUrlTextBox} id='share-url'/></div>
          <div className={classNames(DropdownStyles.section, Styles.shortenUrl)}>
              <div className={Styles.btnWrapper}>
                  <button type='button' onClick={this.toggleAdvancedOptions} className={Styles.btnAdvanced}>
                      <span>Opzioni avanzate</span>
                      {this.advancedOptions()? <Icon glyph={Icon.GLYPHS.opened}/> : <Icon glyph={Icon.GLYPHS.closed}/>}
                  </button>
              </div>
              <If condition={this.advancedOptions()}>
                {/* Aggiunto salvataggio su disco di un file di "progetto" della mappa corrente (tramite salvataggio shareUrl) */}
                <div className={DropdownStyles.section}>
                    <a style={btnStyle} href={"data:text/plain;charset=utf-8," + this.state.shareUrl} download="mappa.txt">Salva mappa corrente</a>
                </div>
                <div className={DropdownStyles.section}>
                    <p className={Styles.paragraph}>Per includere la mappa in una pagina HTML usare questo codice:</p>
                    <input className={Styles.field} type="text" readOnly placeholder={this.state.placeholder}
                        value={iframeCode}
                        onClick={e => e.target.select()}/>
                </div>
                <If condition={this.isUrlShortenable()}>
                    <div className={classNames(DropdownStyles.section, Styles.shortenUrl)}>
                        <button onClick={this.onShortenClicked}>
                            {this.shouldShorten() ? <Icon glyph={Icon.GLYPHS.checkboxOn}/> : <Icon glyph={Icon.GLYPHS.checkboxOff}/>}
                            Abbrevia l'URL
                        </button>
                    </div>
                </If>
              </If>
          </div>
        </div>);
    },

    render() {
        const dropdownTheme = {
            btn: Styles.btnShare,
            outer: Styles.sharePanel,
            inner: Styles.dropdownInner,
            icon: 'share'
        };

        const iframeCode = this.state.shareUrl.length ?
            `<iframe style="width: 720px; height: 600px; border: none;" src="${this.state.shareUrl}" allowFullScreen mozAllowFullScreen webkitAllowFullScreen></iframe>`
            : '';
        const shareImgStyle = {
            backgroundImage: 'url(' + this.state.imageUrl + ')'
        };

        const shareUrlTextBox = <input className={Styles.shareUrlfield} type="text" value={this.state.shareUrl}
               placeholder={this.state.placeholder} readOnly
               onClick={e => e.target.select()} id='share-url'/>;

        return (
            <MenuPanel theme={dropdownTheme}
                       btnText="Condividi"
                       viewState={this.props.viewState}
                       btnTitle="Condividi la mappa corrente"
                       onOpenChanged={this.onOpenChanged}
                       smallScreen={this.props.viewState.useSmallScreenInterface}>
                <If condition={this.state.isOpen}>
                  <Choose>
                    <When condition={this.props.viewState.useSmallScreenInterface}>
                      {this.renderSmallScreen(iframeCode, shareImgStyle, shareUrlTextBox)}
                    </When>
                    <Otherwise>
                      {this.renderNormal(iframeCode, shareImgStyle, shareUrlTextBox)}
                    </Otherwise>
                  </Choose>
                </If>
            </MenuPanel>
        );
    },
});

export default SharePanel;
