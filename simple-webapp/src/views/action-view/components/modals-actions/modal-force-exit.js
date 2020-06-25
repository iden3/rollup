import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon,
} from 'semantic-ui-react';
import ModalError from '../modals-info/modal-error';
import ButtonGM from './gm-buttons';
import { handleSendForceExit, handleGetIds } from '../../../../state/tx/actions';
import { handleStateForceExit } from '../../../../state/tx-state/actions';
import { getWei } from '../../../../utils/utils';

class ModalForceExit extends Component {
    static propTypes = {
      config: PropTypes.object.isRequired,
      modalForceExit: PropTypes.bool.isRequired,
      toggleModalForceExit: PropTypes.func.isRequired,
      handleSendForceExit: PropTypes.func.isRequired,
      handleStateForceExit: PropTypes.func.isRequired,
      desWallet: PropTypes.object.isRequired,
      babyjub: PropTypes.string.isRequired,
      gasMultiplier: PropTypes.number.isRequired,
    }

    constructor(props) {
      super(props);
      this.amountRef = React.createRef();
      this.tokenIdRef = React.createRef();
      this.state = {
        amount: '',
        modalError: false,
        sendDisabled: true,
        error: '',
        tokenId: 0,
      };
    }

    closeModal = () => {
      this.props.toggleModalForceExit();
      this.setState({
        amount: '',
        modalError: false,
        sendDisabled: true,
        error: '',
        tokenId: 0,
      });
    }

    toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

    checkForm = () => {
      const {
        amount, tokenId,
      } = this.state;
      if (parseInt(amount, 10) && (parseInt(tokenId, 10) || tokenId === 0)) {
        this.setState({ sendDisabled: false });
      } else {
        this.setState({ sendDisabled: true });
      }
    }

    setAmount = (event) => {
      this.setState({ amount: event.target.value }, () => { this.checkForm(); });
    }

    setTokenId = (event) => {
      this.setState({ tokenId: event.target.value }, () => { this.checkForm(); });
    }

    handleClick = async () => {
      const { config, desWallet, gasMultiplier } = this.props;
      const amountWei = getWei(this.state.amount);
      const tokenId = Number(this.tokenIdRef.current.value);
      this.closeModal();
      const res = await this.props.handleSendForceExit(config.nodeEth, config.address, tokenId, amountWei, desWallet,
        config.abiRollup, config.operator, gasMultiplier);
      if (res.message !== undefined) {
        if (res.message.includes('insufficient funds')) {
          this.setState({ error: '1' });
          this.toggleModalError();
        }
      }
      if (res.res) {
        this.props.handleStateForceExit(res, config.operator, tokenId, amountWei);
      }
    }

    modal = () => {
      return (
        <Modal open={this.props.modalForceExit}>
          <Modal.Header>Force Exit</Modal.Header>
          <Modal.Content>
            <Form>
              <Form.Field>
                <label htmlFor="babyjub-from">
                  Sender BabyJubJub Address
                  <input
                    type="text"
                    defaultValue={this.props.babyjub}
                    id="baby-ax-s"
                    disabled />
                </label>
              </Form.Field>
              <Form.Field>
                <label htmlFor="amount">
                  Amount
                  <input
                    type="text"
                    ref={this.amountRef}
                    id="amount"
                    onChange={this.setAmount} />
                </label>
              </Form.Field>
              <Form.Field>
                <label htmlFor="tokenid">
                  Token ID
                  <input
                    type="text"
                    ref={this.tokenIdRef}
                    id="tokenid"
                    onChange={this.setTokenId}
                    defaultValue="0" />
                </label>
              </Form.Field>
              <Form.Field>
                <ButtonGM />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.handleClick} disabled={this.state.sendDisabled}>
              <Icon name="share" />
              Force Exit
            </Button>
            <Button color="grey" basic onClick={this.closeModal}>
              <Icon name="close" />
              Close
            </Button>
          </Modal.Actions>
        </Modal>
      );
    }

    render() {
      return (
        <div>
          <ModalError
            error={this.state.error}
            modalError={this.state.modalError}
            toggleModalError={this.toggleModalError} />
          {this.modal()}
        </div>
      );
    }
}

const mapStateToProps = (state) => ({
  config: state.general.config,
  desWallet: state.general.desWallet,
  gasMultiplier: state.general.gasMultiplier,
});

export default connect(mapStateToProps, { handleSendForceExit, handleGetIds, handleStateForceExit })(ModalForceExit);
