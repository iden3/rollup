/* global BigInt */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import { handleSendSend, handleGetIds } from '../../../state/tx/actions';
import { handleStateSend } from '../../../state/tx-state/actions';
import { hexToPoint } from '../../../utils/utils';

const web3 = require('web3');

class ModalSend extends Component {
    static propTypes = {
      handleGetIds: PropTypes.func.isRequired,
      config: PropTypes.object.isRequired,
      modalSend: PropTypes.bool.isRequired,
      toggleModalSend: PropTypes.func.isRequired,
      handleSendSend: PropTypes.func.isRequired,
      handleStateSend: PropTypes.func.isRequired,
      desWallet: PropTypes.object.isRequired,
      babyjub: PropTypes.string.isRequired,
      activeItem: PropTypes.string.isRequired,
      pendingOffchain: PropTypes.array.isRequired,
    }

    constructor(props) {
      super(props);
      this.idToRef = React.createRef();
      this.idFromRef = React.createRef();
      this.babyjubRef = React.createRef();
      this.amountRef = React.createRef();
      this.tokenIdRef = React.createRef();
      this.feeRef = React.createRef();
      this.state = {
        initModal: true,
        idsSender: [],
        idsReceiver: [],
        idTo: NaN,
        idFrom: NaN,
        babyJubReceiver: '',
        idsSend: true,
      };
    }

    toggleModalChange = () => { this.setState((prev) => ({ initModal: !prev.initModal })); }

    toggleCloseModal = () => { this.toggleModalChange(); this.props.toggleModalSend(); }

    handleClick = async () => {
      const { config, desWallet } = this.props;
      let idTo;
      if (this.props.activeItem === 'send0') {
        idTo = 0;
      } else {
        idTo = Number(this.state.idTo);
      }
      const idFrom = Number(this.state.idFrom);
      this.toggleCloseModal();
      const res = await this.props.handleSendSend(config.operator, idTo, this.state.amount, desWallet,
        this.state.tokenId, this.state.fee, idFrom);
      if (res.nonce || res.nonce === 0) {
        this.props.handleStateSend(res, idFrom, config.operator, this.state.amount,
          this.state.babyJubReceiver, this.props.pendingOffchain, idTo);
      }
    }

    getIDs = async () => {
      const { operator } = this.props.config;
      this.setState({ idTo: NaN, idFrom: NaN, idsSend: true });
      const senderBabyjubPoint = hexToPoint(this.props.babyjub);
      const sender = { ax: senderBabyjubPoint[0], ay: senderBabyjubPoint[1] };
      const idsSender = await this.props.handleGetIds(operator, sender, this.props.babyjub);
      let idsReceiver = [];
      if (this.props.activeItem !== 'send0') {
        try {
          this.setState({ babyJubReceiver: this.babyjubRef.current.value });
          const receiverBabyjubPoint = hexToPoint(this.babyjubRef.current.value);
          const receiver = { ax: receiverBabyjubPoint[0], ay: receiverBabyjubPoint[1] };
          idsReceiver = await this.props.handleGetIds(operator, receiver, this.babyjubRef.current.value);
        } catch (error) {
          idsReceiver = [];
        }
      }
      let amount;
      let fee;
      let tokenId;
      try {
        amount = web3.utils.toWei(this.amountRef.current.value, 'ether');
      } catch (err) {
        amount = '0';
      }
      try {
        fee = web3.utils.toWei(this.feeRef.current.value, 'ether');
      } catch (err) {
        fee = '0';
      }
      try {
        tokenId = Number(this.tokenIdRef.current.value);
      } catch (err) {
        tokenId = '0';
      }
      this.setState({
        amount, fee, tokenId, idsSender, idsReceiver,
      });
      this.toggleModalChange();
    }

    handleChangeFrom = (e, { value }) => {
      this.setState(
        { idFrom: value },
        () => {
          if ((this.state.idFrom && this.state.idTo) || this.props.activeItem === 'send0') {
            this.setState({ idsSend: false });
          }
        },
      );
    }

    handleChangeTo = (e, { value }) => {
      this.setState(
        { idTo: value },
        () => {
          if (this.state.idFrom && this.state.idTo) {
            this.setState({ idsSend: false });
          }
        },
      );
    }

    idsFrom = () => {
      let dropdown;
      if (this.state.idsSender.length === 0) {
        dropdown = (<Dropdown placeholder="idFrom" />);
      } else {
        const ids = this.state.idsSender.filter(
          (id) => BigInt(id.amount) >= (BigInt(this.state.amount) + BigInt(this.state.fee)),
        );
        dropdown = (
          <Dropdown
            placeholder="idFrom"
            options={ids}
            onChange={this.handleChangeFrom}
            scrolling />
        );
      }
      return dropdown;
    }

    idsTo = () => {
      let dropdown;
      if (this.props.activeItem === 'send0') {
        dropdown = (
          <Form.Field>
            <label htmlFor="babyjub-to">
              <input
                type="text"
                id="receiver"
                value={0}
                disabled />
            </label>
          </Form.Field>
        );
      } else if (this.state.idsReceiver.length === 0) {
        dropdown = (<Dropdown placeholder="idTo" />);
      } else {
        dropdown = (
          <Dropdown
            placeholder="idTo"
            options={this.state.idsReceiver}
            onChange={this.handleChangeTo}
            scrolling />
        );
      }
      return dropdown;
    }

    receiverBySend = () => {
      if (this.props.activeItem === 'send') {
        return (
          <label htmlFor="babyjub-to">
            Receiver BabyJubJub Address
            <input
              type="text"
              id="baby-ax-r"
              ref={this.babyjubRef} />
          </label>
        );
      }
    }

    modal = () => {
      if (this.state.initModal === true) {
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
                    <input type="text" ref={this.amountRef} id="amount" />
                  </label>
                </Form.Field>
                <Form.Field>
                  <label htmlFor="token-id">
                    Token ID
                    <input type="text" disabled ref={this.tokenIdRef} id="token-id" defaultValue="0" />
                  </label>
                </Form.Field>
                <Form.Field>
                  <label htmlFor="fee">
                    Fee
                    <input type="text" ref={this.feeRef} id="fee" />
                  </label>
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button color="blue" onClick={this.getIDs}>
                <Icon name="share" />
                Next
              </Button>
              <Button color="grey" basic onClick={this.props.toggleModalSend}>
                <Icon name="close" />
                Close
              </Button>
            </Modal.Actions>
          </Modal>
        );
      }
      return (
        <Modal open={this.props.modalSend}>
          <Modal.Header>Send</Modal.Header>
          <Modal.Content>
            <Form>
              <p><b>ID Sender</b></p>
              {this.idsFrom()}
              <p><b>ID Receiver</b></p>
              {this.idsTo()}
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.toggleModalChange}>
              <Icon name="arrow left" />
              Previous
            </Button>
            <Button color="blue" onClick={this.handleClick} disabled={this.state.idsSend}>
              <Icon name="share" />
              Send
            </Button>
            <Button color="grey" basic onClick={this.toggleCloseModal}>
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
