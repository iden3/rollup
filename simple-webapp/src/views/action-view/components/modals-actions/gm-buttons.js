import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'semantic-ui-react';
import { selectGasMultiplier } from '../../../../state/general/actions';

const GAS_MULTIPLIER = {
  SLOW: 1,
  AVG: 2,
  FAST: 3,
};

class ButtonGM extends Component {
  static propTypes = {
    selectGasMultiplier: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      slow: false,
      avg: true,
      fast: false,
    };
  }

  selectActive = (num) => {
    if (num === GAS_MULTIPLIER.SLOW) {
      this.setState({
        slow: true, avg: false, fast: false,
      });
    } else if (num === GAS_MULTIPLIER.AVG) {
      this.setState({
        slow: false, avg: true, fast: false,
      });
    } else if (num === GAS_MULTIPLIER.FAST) {
      this.setState({
        slow: false, avg: false, fast: true,
      });
    } else {
      this.setState({
        slow: false, avg: false, fast: false,
      });
    }
  }

  changeGasMultiplier = (num, event) => {
    event.preventDefault();
    this.props.selectGasMultiplier(num);
    this.selectActive(num);
  }

  render() {
    return (
      <Button.Group>
        <Button
          onClick={(event) => this.changeGasMultiplier(GAS_MULTIPLIER.SLOW, event)}
          active={this.state.slow}>
          Slow
        </Button>
        <Button.Or />
        <Button
          onClick={(event) => this.changeGasMultiplier(GAS_MULTIPLIER.AVG, event)}
          active={this.state.avg}>
          Avg
        </Button>
        <Button.Or />
        <Button
          onClick={(event) => this.changeGasMultiplier(GAS_MULTIPLIER.FAST, event)}
          active={this.state.fast}>
          Fast
        </Button>
      </Button.Group>
    );
  }
}

export default connect(null, { selectGasMultiplier })(ButtonGM);
