/* global BigInt */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import { handleSendSend, handleGetIds } from '../../../../state/tx/actions';
import { handleStateSend } from '../../../../state/tx-state/actions';
import { hexToPoint, getWei } from '../../../../utils/utils';

const rollupExampleAddress = '0x336938c2baed78293c4a4b292263cfa82c68bdb07cc069aec6252891ab41b92d';

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
      this.tokenIdRef = React.createRef();
      this.state = {
        babyJubReceiver: '',
        initModal: true,
        amount: '',
        fee: '',
        tokenId: '0',
        idsSender: [],
        idsReceiver: [],
        idTo: 0,
        idFrom: 0,
        nextDisabled: true,
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

    getInitState = () => {
      this.setState({
        babyJubReceiver: '',
        initModal: true,
        amount: '',
        fee: '',
        tokenId: '0',
        idsSender: [],
        idsReceiver: [],
        idTo: 0,
        idFrom: 0,
        nextDisabled: true,
        sendDisabled: true,
      });
    }

    toggleModalChange = () => this.setState((prev) => ({ initModal: !prev.initModal }));

    closeInitModal = () => {
      this.props.toggleModalSend();
      this.getInitState();
    }

    previousModal = () => {
      this.setState({ sendDisabled: true, idTo: 0, idFrom: 0 });
      this.toggleModalChange();
    }

    closeModal = () => {
      this.props.toggleModalSend();
      this.toggleModalChange();
      this.getInitState();
    }

    getIds = async (babyjubjub) => {
      const { operator } = this.props.config;
      const babyjubPoint = hexToPoint(babyjubjub);
      const babyjubAxAy = { ax: babyjubPoint[0], ay: babyjubPoint[1] };
      const ids = await this.props.handleGetIds(operator, babyjubAxAy, babyjubjub);
      return ids;
    }

    nextModal = async () => {
      const { babyJubReceiver } = this.state;
      const idsSender = await this.getIds(this.props.babyjub);
      let idsReceiver = [];
      if (this.props.activeItem !== 'send0') {
        idsReceiver = await this.getIds(babyJubReceiver);
      }
      const tokenId = Number(this.tokenIdRef.current.value);
      this.setState({
        tokenId, idsSender, idsReceiver,
      });
      this.toggleModalChange();
    }

    handleClick = async () => {
      const {
        config, desWallet, pendingOffchain, babyjub,
      } = this.props;
      const {
        idTo, idFrom, tokenId, babyJubReceiver, amount, fee,
      } = this.state;
      const idToNumber = Number(idTo);
      const idFromNumber = Number(idFrom);
      const amountWei = getWei(amount);
      const feeWei = getWei(fee);
      this.closeModal();
      const res = await this.props.handleSendSend(config.operator, idToNumber, amountWei, desWallet,
        tokenId, feeWei, idFromNumber);

      if (res.nonce || res.nonce === 0) {
        this.props.handleStateSend(res, idFromNumber, config.operator, amountWei, feeWei,
          babyJubReceiver, pendingOffchain, idToNumber, babyjub);
      }
    }

    checkForm = () => {
      const { amount, fee, babyJubReceiver } = this.state;
      if (parseInt(amount, 10) && parseInt(fee, 10) && babyJubReceiver !== '') {
        this.setState({ nextDisabled: false });
      } else {
        this.setState({ nextDisabled: true });
      }
    }

    setAmount = (event) => {
      this.setState({ amount: event.target.value }, () => { this.checkForm(); });
    }

    setFee = (event) => {
      this.setState({ fee: event.target.value }, () => { this.checkForm(); });
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

    handleChangeFrom = (e, { value }) => {
      this.setState(
        { idFrom: value },
        () => {
          if ((this.state.idFrom && this.state.idTo) || this.props.activeItem === 'send0') {
            this.setState({ sendDisabled: false });
          }
        },
      );
    }

    idsFrom = () => {
      const { idsSender, amount, fee } = this.state;
      const amountWei = getWei(amount);
      const feeWei = getWei(fee);
      let dropdown;
      if (idsSender.length === 0) {
        dropdown = (<Dropdown placeholder="idFrom" />);
      } else {
        const ids = idsSender.filter(
          (id) => BigInt(id.amount) >= (BigInt(amountWei) + BigInt(feeWei)),
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

    handleChangeTo = (e, { value }) => {
      this.setState(
        { idTo: value },
        () => {
          if (this.state.idFrom && this.state.idTo) {
            this.setState({ sendDisabled: false });
          }
        },
      );
    }

    idsTo = () => {
      const { idTo, idsReceiver } = this.state;
      const { activeItem } = this.props;
      let dropdown;
      if (activeItem === 'send0') {
        dropdown = (
          <Form.Field>
            <label htmlFor="babyjub-to">
              <input
                type="text"
                id="receiver"
                value={idTo}
                disabled />
            </label>
          </Form.Field>
        );
      } else if (idsReceiver.length === 0) {
        dropdown = (<Dropdown placeholder="idTo" />);
      } else {
        dropdown = (
          <Dropdown
            placeholder="idTo"
            options={idsReceiver}
            onChange={this.handleChangeTo}
            scrolling />
        );
      }
      return dropdown;
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
                    <input
                      type="text"
                      ref={this.amountRef}
                      id="amount"
                      onChange={this.setAmount}
                      value={this.state.amount} />
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
                    <input type="text" ref={this.feeRef} id="fee" onChange={this.setFee} value={this.state.fee} />
                  </label>
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button color="blue" onClick={this.nextModal} disabled={this.state.nextDisabled}>
                <Icon name="share" />
                Next
              </Button>
              <Button color="grey" basic onClick={this.closeInitModal}>
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
            <Button color="blue" onClick={this.previousModal}>
              <Icon name="arrow left" />
              Previous
            </Button>
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
