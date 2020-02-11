import React, { Component } from 'react';
import {
  Table, Container,
} from 'semantic-ui-react';

import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class InfoOp extends Component {
  static propTypes = {
    currentBatch: PropTypes.number.isRequired,
    currentSlot: PropTypes.number.isRequired,
    currentBlock: PropTypes.number.isRequired,
    currentEra: PropTypes.number.isRequired,
  }

  render() {
    return (
      <Container>
        <Table color="olive" inverted>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
                <p>Current Batch:</p>
              </Table.Cell>
              <Table.Cell textAlign="left">
                <b style={{ color: 'black' }}>{this.props.currentBatch}</b>
              </Table.Cell>
              <Table.Cell>
                <p>Current Block:</p>
              </Table.Cell>
              <Table.Cell textAlign="left">
                <b style={{ color: 'black' }}>{this.props.currentBlock}</b>
              </Table.Cell>
              <Table.Cell>
                <p>Current Slot:</p>
              </Table.Cell>
              <Table.Cell textAlign="left">
                <b style={{ color: 'black' }}>{this.props.currentSlot}</b>
              </Table.Cell>
              <Table.Cell>
                <p>Current Era:</p>
              </Table.Cell>
              <Table.Cell textAlign="left">
                <b style={{ color: 'black' }}>{this.props.currentEra}</b>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  currentBlock: state.general.currentBlock,
  currentEra: state.general.currentEra,
  currentSlot: state.general.currentSlot,
  currentBatch: state.general.currentBatch,
});

export default connect(mapStateToProps, { })(InfoOp);
