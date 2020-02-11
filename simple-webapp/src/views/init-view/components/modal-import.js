import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, Form, Icon, Message, Progress,
} from 'semantic-ui-react';

class ModalImport extends Component {
    static propTypes = {
      passwordRef: PropTypes.object.isRequired,
      errorWallet: PropTypes.string,
      modalImport: PropTypes.bool.isRequired,
      isLoadingWallet: PropTypes.bool.isRequired,
      handleChangeWallet: PropTypes.func.isRequired,
      handleClickImport: PropTypes.func.isRequired,
      toggleModalImport: PropTypes.func.isRequired,
      desc: PropTypes.string,
      step: PropTypes.number.isRequired,
    }

    isLoading = () => {
      if (this.props.isLoadingWallet === true) {
        return (
          <div>
            <Message warning>
              <Icon name="circle notched" loading />
              Your wallet is being checked...
              This may take a few seconds!
            </Message>
            <p>{this.props.desc}</p>
            <Progress value={this.props.step} total="3" progress="ratio" color="blue" active />
          </div>
        );
      } if (this.props.errorWallet !== '') {
        return (
          <Message error>
            Invalid Wallet or Password
          </Message>
        );
      }
    }

    render() {
      return (
        <Modal open={this.props.modalImport}>
          <Modal.Header>Import Wallet</Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <label htmlFor="wallet-file">
                  Wallet
                  <input type="file" onChange={(e) => this.props.handleChangeWallet(e)} id="wallet-file" />
                </label>
              </Form.Field>
              <Form.Field>
                <label htmlFor="password">
                  Password
                  <input type="password" ref={this.props.passwordRef} id="password" />
                </label>
              </Form.Field>
            </Form>
            {this.isLoading()}
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.props.handleClickImport}>
              <Icon name="check" />
              Import
            </Button>
            <Button color="grey" basic onClick={this.props.toggleModalImport}>
              <Icon name="close" />
              Close
            </Button>
          </Modal.Actions>
        </Modal>
      );
    }
}

export default ModalImport;
