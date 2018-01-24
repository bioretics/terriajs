import clipboard from 'clipboard';
import React from 'react';
import Styles from './clipboard.scss';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import defined from 'terriajs-cesium/Source/Core/defined';

export default class Clipboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tooltip: null
    };
    this.resetTooltip = this.resetTooltip.bind(this);
  }

  componentDidMount() {
    const that = this;
    this.clipboardBtn = new clipboard(`.btn-copy-${this.props.id}`);
    this.clipboardBtn.on('success', _=>
      that.setState({
        tooltip: "copied!"
      }));
    this.clipboardBtn.on('error', _=>
        that.setState({
          tooltip: "copy unsuccessful!"
        }));
    window.setTimeout(that.resetTooltip, 3000);
  }

  componentWillUnmount() {
    const that = this;
    this.clipboardBtn.destroy();
    window.clearTimeout(that.resetTooltip);
  }

  resetTooltip() {
    if(defined(this.state.tooltip)){
      this.setState({
        tooltip: null
      });
    }
  }

  render() {
    return (
      <div className={Styles.clipboard}>
        <div>Condividi URL</div>
        <div className={Styles.clipboardBody}>
          {this.props.source}
          <button className={classNames(`btn-copy-${this.props.id}`, Styles.copyBtn)} data-clipboard-target={`#${this.props.id}`}>
            Copia
          </button>
        </div>
        {this.state.tooltip && <span className={Styles.tooltip}>{this.state.tooltip}</span>}
      </div>
    );
  }
}

Clipboard.propTypes = {
   id: PropTypes.string.isRequired,
   source: PropTypes.object.isRequired,
};
