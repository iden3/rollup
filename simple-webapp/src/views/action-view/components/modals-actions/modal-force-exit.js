/* global BigInt */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import ModalError from '../modals-info/modal-error';
import ButtonGM from './gm-buttons';
import { handleSendForceExit, handleGetIds } from '../../../../state/tx/actions';
import { handleStateForceExit } from '../../../../state/tx-state/actions';
import { hexToPoint, getWei } from '../../../../utils/utils';

class ModalForceExit extends Component {
    static propTypes = {
      handleGetIds: PropTypes.func.isRequired,
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
      this.idFromRef = React.createRef();
      this.amountRef = React.createRef();
      this.state = {
        initModal: true,
        idsSender: [],
        idFrom: 0,
        amount: '',
        modalError: false,
        sendDisabled: true,
        nextDisabled: true,
        error: '',
      };
    }

    getInitState = () => {
      this.setState({
        initModal: true,
        idsSender: [],
        idFrom: 0,
        amount: '',
        sendDisabled: true,
        nextDisabled: true,
      });
    }

    toggleModalChange = () => this.setState((prev) => ({ initModal: !prev.initModal }));

    closeInitModal = () => {
      this.props.toggleModalForceExit();
      this.getInitState();
    }

    previousModal = () => {
      this.setState({ sendDisabled: true });
      this.toggleModalChange();
    }

    closeModal = () => {
      this.props.toggleModalForceExit();
      this.toggleModalChange();
      this.getInitState();
    }

    toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

    checkAmount = (e) => {
      e.preventDefault();
      if (parseInt(e.target.value, 10)) {
        this.setState({ nextDisabled: false, amount: e.target.value });
      } else {
        this.setState({ nextDisabled: true });
      }
    }

    handleClick = async () => {
      const { config, desWallet, gasMultiplier } = this.props;
      const idFrom = Number(this.state.idFrom);
      const amountWei = getWei(this.state.amount);
      this.closeModal();
      const res = await this.props.handleSendForceExit(config.nodeEth, config.address, amountWei, desWallet,
        config.abiRollup, config.operator, idFrom, gasMultiplier);
      if (res.message !== undefined) {
        if (res.message.includes('insufficient funds')) {
          this.setState({ error: '1' });
          this.toggleModalError();
        }
      }
      if (res.res) {
        this.props.handleStateForceExit(res, config.operator, idFrom, amountWei);
      }
    }

    getIDs = async () => {
      const { operator } = this.props.config;
      const senderBabyjubPoint = hexToPoint(this.props.babyjub);
      const sender = { ax: senderBabyjubPoint[0], ay: senderBabyjubPoint[1] };
      const idsSender = await this.props.handleGetIds(operator, sender, this.props.babyjub);
      this.setState({ idsSender });
      this.toggleModalChange();
    }

    handleChangeFrom = (e, { value }) => {
      this.setState({ idFrom: value, sendDisabled: false });
    }

    idsFrom = () => {
      const amountWei = getWei(this.state.amount);
      let dropdown;
      if (this.state.idsSender.length === 0) {
        dropdown = (<Dropdown placeholder="idFrom" />);
      } else {
        const ids = this.state.idsSender.filter(
          (id) => BigInt(id.amount) >= BigInt(amountWei),
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

    modal = () => {
      if (this.state.initModal === true) {
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
                      onChange={this.checkAmount}
                      value={this.state.amount} />
                  </label>
                </Form.Field>
                <Form.Field>
                  <ButtonGM />
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button color="blue" onClick={this.getIDs} disabled={this.state.nextDisabled}>
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
        <Modal open={this.props.modalForceExit}>
          <Modal.Header>Send</Modal.Header>
          <Modal.Content>
            <Form>
              <p><b>ID Sender</b></p>
              {this.idsFrom()}
              <p><b>ID Receiver</b></p>
              <Form.Field>
                <label htmlFor="babyjub-to">
                  <input
                    type="text"
                    id="receiver"
                    value={0}
                    disabled />
                </label>
              </Form.Field>
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.previousModal}>
              <Icon name="arrow left" />
              Previous
            </Button>
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
