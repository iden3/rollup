import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, Table,
} from 'semantic-ui-react';

class ModalInfoOffchain extends Component {
  static propTypes = {
    modalInfoOffchain: PropTypes.bool.isRequired,
    keyItem: PropTypes.object.isRequired,
    toggleModalInfoOffchain: PropTypes.func.isRequired,
    currentBatch: PropTypes.number.isRequired,
  }

  handleClick = () => {
    this.props.toggleModalInfoOffchain();
  }

  getReceiver = () => {
    const { keyItem } = this.props;
    if (keyItem.type === 'Send') {
      return (
        <Table.Row>
          <Table.Cell>
              Receiver:
          </Table.Cell>
          <Table.Cell>
            {keyItem.receiver}
          </Table.Cell>
        </Table.Row>
      );
    }
  }

  getModalContent = () => {
    const { keyItem, currentBatch } = this.props;
    if (keyItem) {
      let state;
      if (keyItem.state === 'Success') {
        state = <Table.Cell positive>{keyItem.state}</Table.Cell>;
      } else if (keyItem.state === 'Error') {
        state = <Table.Cell negative>{keyItem.state}</Table.Cell>;
      } else if (keyItem.state === 'Pending') {
        state = <Table.Cell warning>{keyItem.state}</Table.Cell>;
      } else {
        state = <Table.Cell>{keyItem.state}</Table.Cell>;
      }
      return (
        <Table>
          <Table.Body>
            <Table.Row>
              <Table.Cell>
              Type:
              </Table.Cell>
              <Table.Cell>
                {keyItem.type}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
              Amount:
              </Table.Cell>
              <Table.Cell>
                {keyItem.amount}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
              State:
              </Table.Cell>
              {state}
            </Table.Row>
            {this.getReceiver()}
            <Table.Row>
              <Table.Cell>
              Current Batch:
              </Table.Cell>
              <Table.Cell>
                {currentBatch}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>
                Maximum batch:
              </Table.Cell>
              <Table.Cell>
                {keyItem.maxNumBatch}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      );
    }
  }

  render() {
    return (
      <div>
        <Modal open={this.props.modalInfoOffchain}>
          <Modal.Header>Transaction Information</Modal.Header>
          <Modal.Content>
            {this.getModalContent()}
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.handleClick}>
              OK
            </Button>
          </Modal.Actions>
        </Modal>
      </div>
    );
  }
}


export default ModalInfoOffchain;
