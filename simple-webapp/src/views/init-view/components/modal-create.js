import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button, Modal, Form, Icon, Message, Progress,
} from 'semantic-ui-react';

class ModalCreate extends Component {
  static propTypes = {
    fileNameRef: PropTypes.object.isRequired,
    passwordRef: PropTypes.object.isRequired,
    modalCreate: PropTypes.bool.isRequired,
    handleClickCreate: PropTypes.func.isRequired,
    toggleModalCreate: PropTypes.func.isRequired,
    errorCreateWallet: PropTypes.string,
    isCreatingWallet: PropTypes.bool.isRequired,
    isLoadingWallet: PropTypes.bool.isRequired,
    nameWallet: PropTypes.string,
    desc: PropTypes.string,
    step: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props);
    this.state = {
      password: '',
      match: '',
    };
  }

  isLoading = () => {
    if (this.props.isCreatingWallet === true || this.props.isLoadingWallet === true) {
      return (
        <div>
          <Message warning>
            <Icon name="circle notched" loading />
            Your wallet is being created and imported...
            This may take a few seconds!
          </Message>
          <p>{this.props.desc}</p>
          <Progress value={this.props.step} total="4" progress="ratio" color="blue" active />
        </div>
      );
    } if (this.props.errorCreateWallet !== '') {
      return (
        <Message error>
          Error
        </Message>
      );
    }
  }

  setPassword = (e) => {
    e.preventDefault();
    this.setState({ password: e.target.value });
  }

  checkPassword = (e) => {
    e.preventDefault();
    if (this.state.password === e.target.value) {
      this.setState({ match: true });
    } else {
      this.setState({ match: false });
    }
  }

  checkPasswordMessage = () => {
    const { match } = this.state;
    if (this.props.isCreatingWallet === false && this.props.isLoadingWallet === false) {
      if (match === true) {
        return (
          <Message positive>
            <Icon name="check" />
          Passwords match
          </Message>
        );
      }
      if (match === false) {
        return (
          <Message error>
            <Icon name="exclamation" />
          Passwords do not match
          </Message>
        );
      }
    }
  }

  render() {
    return (
      <Modal open={this.props.modalCreate}>
        <Modal.Header>Rollup Wallet</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field>
              <label htmlFor="file-name">
                File Name
                <input type="text" ref={this.props.fileNameRef} id="file-name" defaultValue={this.props.nameWallet} />
              </label>
            </Form.Field>
            <Form.Field>
              <label htmlFor="password">
                Password
                <input type="password" ref={this.props.passwordRef} id="password" onChange={this.setPassword} />
              </label>
            </Form.Field>
            <Form.Field>
              <label htmlFor="password2">
                Repeat password
                <input type="password" id="password2" onChange={this.checkPassword} />
              </label>
            </Form.Field>
          </Form>
          {this.checkPasswordMessage()}
          {this.isLoading()}
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" onClick={this.props.handleClickCreate}>
            <Icon name="check" />
            Create
          </Button>
          <Button color="grey" basic onClick={this.props.toggleModalCreate}>
            <Icon name="close" />
            Close
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }
}

export default ModalCreate;
