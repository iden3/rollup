import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';

import ModalError from '../modals-info/modal-error';
import ButtonGM from './gm-buttons';
import { handleSendDeposit } from '../../../../state/tx/actions';
import { handleStateDeposit } from '../../../../state/tx-state/actions';
import { getWei } from '../../../../utils/utils';

class ModalDeposit extends Component {
    static propTypes = {
      config: PropTypes.object.isRequired,
      abiRollup: PropTypes.array.isRequired,
      modalDeposit: PropTypes.bool.isRequired,
      toggleModalDeposit: PropTypes.func.isRequired,
      handleSendDeposit: PropTypes.func.isRequired,
      handleStateDeposit: PropTypes.func.isRequired,
      tokensList: PropTypes.array.isRequired,
      tokensA: PropTypes.string.isRequired,
      gasMultiplier: PropTypes.number.isRequired,
      desWallet: PropTypes.object.isRequired,
    }

    constructor(props) {
      super(props);
      this.state = {
        modalError: false,
        error: '',
        tokenId: '',
        amount: '',
        disableButton: true,
      };
    }

    checkForm = () => {
      const {
        amount, tokenId,
      } = this.state;
      if (parseInt(amount, 10) && (parseInt(tokenId, 10) || tokenId === 0)) {
        this.setState({ disableButton: false });
      } else {
        this.setState({ disableButton: true });
      }
    }

    toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

    toggleModalClose = () => {
      this.props.toggleModalDeposit();
      this.setState({
        modalError: false,
        error: '',
        tokenId: '',
        amount: '',
        disableButton: true,
      });
    }

    handleClick = async () => {
      const {
        config, abiRollup, desWallet, tokensA, gasMultiplier,
      } = this.props;
      const amount = getWei(this.state.amount);
      const { nodeEth, operator } = config;
      const addressSC = config.address;
      if (parseInt(amount, 10) > parseInt(tokensA, 10)) {
        this.setState({ error: '0' });
        this.toggleModalError();
      } else {
        this.props.toggleModalDeposit();
        this.setState({ disableButton: true });
        const res = await this.props.handleSendDeposit(nodeEth, addressSC, amount, this.state.tokenId, desWallet,
          undefined, abiRollup, gasMultiplier, operator);
        const walletEthAddress = desWallet.ethWallet.address;
        const filters = {};
        if (walletEthAddress.startsWith('0x')) filters.ethAddr = walletEthAddress;
        if (res.message !== undefined) {
          if (res.message.includes('insufficient funds')) {
            this.setState({ error: '1' });
            this.toggleModalError();
          }
        }
        if (res.res) {
          this.props.handleStateDeposit(res, this.state.tokenId, operator, amount);
        }
      }
    }

    setAmount = (event) => {
      this.setState({ amount: event.target.value }, () => { this.checkForm(); });
    }

    setToken = (event, { value }) => {
      const tokenId = Number(value);
      this.setState({ tokenId }, () => { this.checkForm(); });
    }

    dropDownTokens = () => {
      const tokensOptions = [];
      for (const token in this.props.tokensList) {
        if (this.props.tokensList[token]) {
          tokensOptions.push({
            key: this.props.tokensList[token].address,
            value: this.props.tokensList[token].tokenId,
            text: `${this.props.tokensList[token].tokenId}: ${this.props.tokensList[token].address}`,
          });
        }
      }
      return (
        <Dropdown
          placeholder="token"
          options={tokensOptions}
          onChange={this.setToken}
          scrolling />
      );
    }

    render() {
      return (
        <div>
          <ModalError
            error={this.state.error}
            modalError={this.state.modalError}
            toggleModalError={this.toggleModalError} />
          <Modal open={this.props.modalDeposit}>
            <Modal.Header>Deposit</Modal.Header>
            <Modal.Content>
              <Form>
                <Form.Field>
                  <label htmlFor="amount">
                    Amount
                    <input
                      type="text"
                      id="amount"
                      onChange={this.setAmount}
                      value={this.state.amount} />
                  </label>
                </Form.Field>
                <Form.Field>
                  <label htmlFor="token-id">
                    Token ID
                  </label>
                  {this.dropDownTokens()}
                </Form.Field>
                <Form.Field>
                  <ButtonGM />
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button color="blue" onClick={this.handleClick} disabled={this.state.disableButton}>
                <Icon name="sign-in" />
                Deposit
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
  abiRollup: state.general.abiRollup,
  desWallet: state.general.desWallet,
  gasMultiplier: state.general.gasMultiplier,
  pendingOnchain: state.txState.pendingOnchain,
});

export default connect(mapStateToProps, { handleSendDeposit, handleStateDeposit })(ModalDeposit);
