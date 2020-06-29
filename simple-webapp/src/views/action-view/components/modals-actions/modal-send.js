import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import { handleSendSend, handleGetIds } from '../../../../state/tx/actions';
import { handleStateSend } from '../../../../state/tx-state/actions';
import {
  getWei, feeTable, feeTableDropdown,
} from '../../../../utils/utils';

const rollupExampleAddress = '0x5b2ae71f33a4e3455cb4d25bf076189093c4beac4d0fd5f8ea538c5b3d1ad8a0';

class ModalSend extends Component {
    static propTypes = {
      config: PropTypes.object.isRequired,
      modalSend: PropTypes.bool.isRequired,
      toggleModalSend: PropTypes.func.isRequired,
      handleSendSend: PropTypes.func.isRequired,
      handleStateSend: PropTypes.func.isRequired,
      desWallet: PropTypes.object.isRequired,
      babyjub: PropTypes.string.isRequired,
      activeItem: PropTypes.string.isRequired,
      tokensRArray: PropTypes.array.isRequired,
      pendingOffchain: PropTypes.array.isRequired,
    }

    constructor(props) {
      super(props);
      this.state = {
        babyJubReceiver: '',
        amount: '',
        fee: '',
        tokenId: '',
        sendDisabled: true,
      };
    }

    componentDidUpdate = () => {
      if (this.state.babyJubReceiver === '' && this.props.activeItem === 'send0') {
        this.setState({ babyJubReceiver: 'exit' });
      } else if (this.state.babyJubReceiver === 'exit' && this.props.activeItem === 'send') {
        this.setState({ babyJubReceiver: '' });
      }
    }

    closeModal = () => {
      this.props.toggleModalSend();
      this.setState({
        babyJubReceiver: '',
        amount: '',
        fee: '',
        tokenId: '',
        sendDisabled: true,
      });
    }

    handleClick = async () => {
      const {
        config, desWallet, pendingOffchain, babyjub,
      } = this.props;
      const {
        amount, fee, babyJubReceiver, tokenId,
      } = this.state;
      const amountWei = getWei(amount);
      this.closeModal();
      const res = await this.props.handleSendSend(config.operator, babyJubReceiver, amountWei, desWallet,
        tokenId, feeTable[fee]);

      if (res.nonce || res.nonce === 0) {
        this.props.handleStateSend(res, config.operator, amountWei, fee, tokenId,
          babyJubReceiver, pendingOffchain, babyjub);
      }
    }

    checkForm = () => {
      const {
        amount, fee, babyJubReceiver, tokenId,
      } = this.state;
      if (parseInt(amount, 10) && fee !== '' && babyJubReceiver !== '' && (parseInt(tokenId, 10) || tokenId === 0)) {
        this.setState({ sendDisabled: false });
      } else {
        this.setState({ sendDisabled: true });
      }
    }

    setAmount = (event) => {
      this.setState({ amount: event.target.value }, () => { this.checkForm(); });
    }

    setToken = (event, { value }) => {
      const tokenId = Number(value);
      this.setState({ tokenId }, () => { this.checkForm(); });
    }

    setFee = (event, { value }) => {
      this.setState({ fee: value }, () => { this.checkForm(); });
    }

    getExampleAddress = () => {
      this.setState({ babyJubReceiver: rollupExampleAddress }, () => { this.checkForm(); });
    }

    handleChangeReceiver = (event) => {
      this.setState({ babyJubReceiver: event.target.value }, () => { this.checkForm(); });
    }

    receiverBySend = () => {
      if (this.props.activeItem === 'send') {
        return (
          <label htmlFor="babyjub-to">
            Receiver BabyJubJub Address
            <input
              type="text"
              id="baby-ax-r"
              value={this.state.babyJubReceiver}
              onChange={this.handleChangeReceiver} />
            <Button
              content="Fill with example address"
              labelPosition="right"
              floated="right"
              onClick={this.getExampleAddress} />
          </label>
        );
      }
    }

    dropDownTokens = () => {
      const tokensOptions = [];
      for (const token in this.props.tokensRArray) {
        if (this.props.tokensRArray[token]) {
          tokensOptions.push({
            key: this.props.tokensRArray[token].address,
            value: this.props.tokensRArray[token].tokenId,
            text: `${this.props.tokensRArray[token].tokenId}: ${this.props.tokensRArray[token].address}`,
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

    modal = () => {
      return (
        <Modal open={this.props.modalSend}>
          <Modal.Header>Send</Modal.Header>
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
                {this.receiverBySend()}
              </Form.Field>
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
                <p><b>Fee</b></p>
                <Dropdown
                  placeholder="fee"
                  options={feeTableDropdown}
                  onChange={this.setFee}
                  scrolling />
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.handleClick} disabled={this.state.sendDisabled}>
              <Icon name="share" />
              Send
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
          {this.modal()}
        </div>
      );
    }
}

const mapStateToProps = (state) => ({
  config: state.general.config,
  desWallet: state.general.desWallet,
  pendingOffchain: state.txState.pendingOffchain,
});

export default connect(mapStateToProps, {
  handleSendSend, handleGetIds, handleStateSend,
})(ModalSend);
