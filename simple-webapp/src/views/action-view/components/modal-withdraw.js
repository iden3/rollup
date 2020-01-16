import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon, Dropdown,
} from 'semantic-ui-react';
import { handleSendWithdraw, handleGetExitRoot } from '../../../state/tx/actions';

class ModalWithdraw extends Component {
  static propTypes = {
    wallet: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    abiRollup: PropTypes.array.isRequired,
    password: PropTypes.string.isRequired,
    modalWithdraw: PropTypes.bool.isRequired,
    toggleModalWithdraw: PropTypes.func.isRequired,
    handleSendWithdraw: PropTypes.func.isRequired,
    getInfoAccount: PropTypes.func.isRequired,
    handleGetExitRoot: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      exitRoots: [],
      numExitRoot: -1,
      idFrom: -1,
      initModal: true,
    };
    this.idFromRef = React.createRef();
  }

    handleClick = async () => {
      try {
        const {
          wallet, config, abiRollup, password,
        } = this.props;

        const idFrom = this.state.idFrom;
        const numExitRoot = this.state.numExitRoot;
        const { nodeEth } = config;
        const addressSC = config.address;
        const { operator } = config;
        this.props.toggleModalWithdraw();
        const res = await this.props.handleSendWithdraw(nodeEth, addressSC, wallet, password,
          abiRollup, operator, idFrom, numExitRoot);
        this.props.getInfoAccount();
        // eslint-disable-next-line no-console
        console.log(res);
      } catch(err) {
        console.log(err);
      }
    }

    getExitRoot = async () => {
        const exitRoots = await this.props.handleGetExitRoot(this.props.config.operator, this.idFromRef.current.value);
        this.setState({ exitRoots, idFrom: this.idFromRef.current.value }, () => { this.toggleModalChange(); });
    }

    exitRoot = () => {
      if (this.state.exitRoots === []) {
        return <Dropdown placeholder='Num Exit Root'/>;
      } else {
        return (<Dropdown placeholder='Num Exit Root' options={this.state.exitRoots}
          onChange={this.handleChange}/>);
      }
    }

    handleChange = (e, { value }) => this.setState({ numExitRoot: value })

    modal = () => {
      if (this.state.initModal === true) {
        return (
          <Modal open={this.props.modalWithdraw}>
            <Modal.Header>Withdraw</Modal.Header>
            <Modal.Content>
              <Form>
                <Form.Field>
                  <label htmlFor="form-withdraw">
                    ID From
                    <input type="text" ref={this.idFromRef} id="form-withdraw" />
                  </label>
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button color="blue" onClick={this.getExitRoot}>
                <Icon name="arrow right" />
                Next
              </Button>
              <Button color="red" onClick={this.props.toggleModalWithdraw}>
                <Icon name="close" />
                Close
              </Button>
            </Modal.Actions>
          </Modal>
        );
      }
      return (
        <Modal open={this.props.modalWithdraw}>
          <Modal.Header>Withdraw</Modal.Header>
          <Modal.Content>
            <p><b>ID From</b></p>
            <p>{this.state.idFrom}</p>
            <p><b>Num Exit Root</b></p>
            {this.exitRoot()}
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.toggleModalChange}>
              <Icon name="arrow left" />
              Previous
            </Button>
            <Button color="blue" onClick={this.handleClick}>
              <Icon name="sign-out" />
              Withdraw
            </Button>
            <Button color="red" onClick={this.toogleCloseModal}>
              <Icon name="close" />
              Close
            </Button>
          </Modal.Actions>
        </Modal>
      );
    }

    toggleModalChange = () => { this.setState((prev) => ({ initModal: !prev.initModal })); }
    toogleCloseModal = () => { this.toggleModalChange(); this.props.toggleModalWithdraw()}

    render() {
      return (
        <div>
          {this.modal()}
        </div>
      );
    }
}

const mapStateToProps = (state) => ({
  wallet: state.general.wallet,
  config: state.general.config,
  abiRollup: state.general.abiRollup,
  password: state.general.password,
  exitRoot: state.general.exitRoot,
});

export default connect(mapStateToProps, { handleSendWithdraw, handleGetExitRoot })(ModalWithdraw);
