import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Modal, Button,
} from 'semantic-ui-react';

const message = {
  '0': 'You do not have enough approved tokens.',
  '1': 'You do not have enough ether.',
};

class ModalError extends Component {
  static propTypes = {
    modalError: PropTypes.bool.isRequired,
    error: PropTypes.string.isRequired,
    toggleModalError: PropTypes.func.isRequired,
  }

  render() {
    return (
      <Modal open={this.props.modalError}>
        <Modal.Header>Error</Modal.Header>
        <Modal.Content>
          {message[this.props.error]}
        </Modal.Content>
        <Modal.Actions>
          <Button color="red" onClick={this.props.toggleModalError}>
            OK
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }
}

export default ModalError;
