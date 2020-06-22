import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, Table,
} from 'semantic-ui-react';

class ModalInfoTx extends Component {
    static propTypes = {
      modalInfoTx: PropTypes.bool.isRequired,
      txTotal: PropTypes.array.isRequired,
      toggleModalInfoTx: PropTypes.func.isRequired,
      getInfoModalOnchain: PropTypes.func.isRequired,
      getInfoModalOffchain: PropTypes.func.isRequired,
    }

    handleClick = () => {
      this.props.toggleModalInfoTx();
    }

    getModalContent = () => {
      try {
        const { txTotal } = this.props;
        return txTotal.map((key, index) => {
          let state;
          if (key.state && key.state.includes('Success')) {
            state = <Table.Cell positive>{key.state}</Table.Cell>;
          } else if (key.state === 'Error') {
            state = <Table.Cell negative>{key.state}</Table.Cell>;
          } else {
            state = <Table.Cell>{key.state}</Table.Cell>;
          }
          let buttonInfo;
          if (key.type === 'Deposit' || key.type === 'Withdraw' || key.type === 'ForceExit') {
            buttonInfo = (
              <Table.Cell>
                <Button key={index} onClick={(event) => this.props.getInfoModalOnchain(event, key)}>
                Info
                </Button>
              </Table.Cell>
            );
          } else if (key.type === 'Send' || key.type === 'Exit') {
            buttonInfo = (
              <Table.Cell>
                <Button key={index} onClick={(event) => this.props.getInfoModalOffchain(event, key)}>
                Info
                </Button>
              </Table.Cell>
            );
          }
          return (
            <Table.Row key={index}>
              <Table.Cell>{key.type}</Table.Cell>
              <Table.Cell>{key.amount}</Table.Cell>
              {state}
              {buttonInfo}
            </Table.Row>
          );
        });
      } catch (err) {
        return ('');
      }
    }

    render() {
      return (
        <div>
          <Modal open={this.props.modalInfoTx}>
            <Modal.Header>Transactions History</Modal.Header>
            <Modal.Content>
              <Table fixed>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Transaction Type</Table.HeaderCell>
                    <Table.HeaderCell>Transaction Amount</Table.HeaderCell>
                    <Table.HeaderCell>State</Table.HeaderCell>
                    <Table.HeaderCell>Info</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {this.getModalContent()}
                </Table.Body>
              </Table>
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


export default ModalInfoTx;
