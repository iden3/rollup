import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, Table,
} from 'semantic-ui-react';

class ModalInfoOnchain extends Component {
    static propTypes = {
      modalInfoOnchain: PropTypes.bool.isRequired,
      keyItem: PropTypes.object.isRequired,
      toggleModalInfoOnchain: PropTypes.func.isRequired,
      currentBatch: PropTypes.number.isRequired,
    }

    handleClick = () => {
      this.props.toggleModalInfoOnchain();
    }

    getCurrentBatch = () => {
      const { keyItem } = this.props;
      if (keyItem.type === 'ForceExit' || keyItem.type === 'Deposit') {
        if (keyItem.state.includes('Pending')) {
          const currentBatch = Math.max(this.props.currentBatch, keyItem.currentBatch);
          return (
            <Table.Row>
              <Table.Cell>
                Current Batch:
              </Table.Cell>
              <Table.Cell>
                {currentBatch}
              </Table.Cell>
            </Table.Row>
          );
        }
      }
    }

    getConfirmationBatch = () => {
      const { keyItem } = this.props;
      if (keyItem.type === 'ForceExit' || keyItem.type === 'Deposit') {
        if (keyItem.state.includes('Success') && keyItem.state.includes('pending')) {
          const currentBatch = Math.max(this.props.currentBatch, keyItem.currentBatch);
          return (
            <Table.Row>
              <Table.Cell>
                Confirmation Batches:
              </Table.Cell>
              <Table.Cell>
                {currentBatch - keyItem.finalBatch}
              </Table.Cell>
            </Table.Row>
          );
        } if (keyItem.state.includes('Success') && !keyItem.state.includes('pending')) {
          return (
            <Table.Row>
              <Table.Cell>
                Confirmation Batches:
              </Table.Cell>
              <Table.Cell>
                5+
              </Table.Cell>
            </Table.Row>
          );
        }
      }
    }

    getMaxBatch = () => {
      const { keyItem } = this.props;
      if (keyItem.type === 'ForceExit' || keyItem.type === 'Deposit') {
        if (keyItem.state.includes('Pending')) {
          return (
            <Table.Row>
              <Table.Cell>
                Finality Batch:
              </Table.Cell>
              <Table.Cell>
                {keyItem.maxNumBatch}
              </Table.Cell>
            </Table.Row>
          );
        }
      }
    }

    getForgedBatch = () => {
      const { keyItem } = this.props;
      if (keyItem.type === 'ForceExit' || keyItem.type === 'Deposit') {
        if (keyItem.state.includes('Success')) {
          return (
            <Table.Row>
              <Table.Cell>
                Forged at Batch:
              </Table.Cell>
              <Table.Cell>
                {keyItem.finalBatch}
              </Table.Cell>
            </Table.Row>
          );
        }
      }
    }

    getModalContent = () => {
      const { keyItem } = this.props;
      if (keyItem) {
        let state;
        if (keyItem.state && keyItem.state.includes('Success')) {
          state = <Table.Cell positive>{keyItem.state}</Table.Cell>;
        } else if (keyItem.state === 'Error') {
          state = <Table.Cell negative>{keyItem.state}</Table.Cell>;
        } else if (keyItem.state && keyItem.state.includes('Pending')) {
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
              <Table.Row>
                <Table.Cell>
                  Hash:
                </Table.Cell>
                <Table.Cell>
                  {keyItem.id}
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  Token ID:
                </Table.Cell>
                <Table.Cell>
                  {keyItem.tokenId}
                </Table.Cell>
              </Table.Row>
              {this.getForgedBatch()}
              {this.getCurrentBatch()}
              {this.getMaxBatch()}
              {this.getConfirmationBatch()}
            </Table.Body>
          </Table>
        );
      }
    }

    render() {
      return (
        <div>
          <Modal open={this.props.modalInfoOnchain}>
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

export default ModalInfoOnchain;
