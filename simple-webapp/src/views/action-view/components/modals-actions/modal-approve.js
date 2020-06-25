import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon,
} from 'semantic-ui-react';

import ModalError from '../modals-info/modal-error';
import ButtonGM from './gm-buttons';
import { handleApprove } from '../../../../state/tx/actions';
import { getWei } from '../../../../utils/utils';

class ModalApprove extends Component {
    static propTypes = {
      config: PropTypes.object.isRequired,
      abiTokens: PropTypes.array.isRequired,
      modalApprove: PropTypes.bool.isRequired,
      toggleModalApprove: PropTypes.func.isRequired,
      handleApprove: PropTypes.func.isRequired,
      gasMultiplier: PropTypes.number.isRequired,
      desWallet: PropTypes.object.isRequired,
    }

    constructor(props) {
      super(props);
      this.amountTokensRef = React.createRef();
      this.addressTokensRef = React.createRef();
      this.state = {
        modalError: false,
        error: '',
        amount: '',
        addressTokens: '',
        disableButton: true,
      };
    }

    toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

    toggleModalClose = () => {
      this.props.toggleModalApprove();
      this.setState({
        disableButton: true,
        amount: '',
        addressTokens: '',
      });
    }

    handleClickApprove = async () => {
      const {
        config, desWallet, gasMultiplier, abiTokens,
      } = this.props;
      const {
        amount, addressTokens,
      } = this.state;
      const amountTokens = getWei(amount);
      this.toggleModalClose();
      this.setState({ disableButton: true });
      const res = await this.props.handleApprove(addressTokens, abiTokens, desWallet, amountTokens, config.address,
        config.nodeEth, gasMultiplier);
      if (res.message !== undefined) {
        if (res.message.includes('insufficient funds')) {
          this.setState({ error: '1' });
          this.toggleModalError();
        }
      }
    }

    checkForm = () => {
      const {
        amount, addressTokens,
      } = this.state;
      if (parseInt(amount, 10) && addressTokens !== '') {
        this.setState({ disableButton: false });
      } else {
        this.setState({ disableButton: true });
      }
    }

    setAmount = () => {
      this.setState({ amount: this.amountTokensRef.current.value }, () => { this.checkForm(); });
    }

    getExampleAddress = () => {
      this.setState({ addressTokens: this.props.config.tokensAddress }, () => { this.checkForm(); });
    }

    handleChangeAddress = (event) => {
      this.setState({ addressTokens: event.target.value }, () => { this.checkForm(); });
    }

    render() {
      return (
        <div>
          <ModalError
            error={this.state.error}
            modalError={this.state.modalError}
            toggleModalError={this.toggleModalError} />
          <Modal open={this.props.modalApprove}>
            <Modal.Header>Approve Tokens</Modal.Header>
            <Modal.Content>
              <Form>
                <Form.Field>
                  <label htmlFor="amountToken">
                    Amount Tokens:
                    <input type="text" ref={this.amountTokensRef} onChange={this.setAmount} id="amountToken" />
                  </label>
                </Form.Field>
                <Form.Field>
                  <label htmlFor="addressTokens">
                    Address SC Tokens:
                    <input
                      type="text"
                      id="baby-ax-r"
                      value={this.state.addressTokens}
                      onChange={this.handleChangeAddress}
                      size="40" />
                    <Button
                      content="Fill with example address"
                      labelPosition="right"
                      floated="right"
                      onClick={this.getExampleAddress} />
                  </label>
                </Form.Field>
                <Form.Field>
                  <ButtonGM />
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={this.handleClickApprove} color="blue" disabled={this.state.disableButton}>
                <Icon name="ethereum" />
                APPROVE
              </Button>
              <Button color="grey" basic onClick={this.toggleModalClose}>
                <Icon name="close" />
                Close
              </Button>
            </Modal.Actions>
          </Modal>
        </div>
      );
    }
}

const mapStateToProps = (state) => ({
  config: state.general.config,
  abiTokens: state.general.abiTokens,
  desWallet: state.general.desWallet,
  gasMultiplier: state.general.gasMultiplier,
});

export default connect(mapStateToProps, { handleApprove })(ModalApprove);
