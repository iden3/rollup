import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';

import { handleGetTokens, handleApprove } from '../../../state/tx/actions';
import { handleInfoAccount } from '../../../state/general/actions';
import MenuBack from '../components/menu';
import MenuActions from '../components/menu-actions';
import InfoWallet from '../components/info-wallet';
import ModalDeposit from '../components/modal-deposit';
import ModalWithdraw from '../components/modal-withdraw';
import ModalSend from '../components/modal-send';
import MessageTx from '../components/message-tx';

class ActionView extends Component {
  static propTypes = {
    wallet: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    password: PropTypes.string.isRequired,
    abiTokens: PropTypes.array.isRequired,
    tokens: PropTypes.string,
    tokensR: PropTypes.string,
    tokensA: PropTypes.string,
    balance: PropTypes.string,
    txs: PropTypes.array,
    apiOperator: PropTypes.object.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    handleInfoAccount: PropTypes.func.isRequired,
    handleGetTokens: PropTypes.func.isRequired,
    handleApprove: PropTypes.func.isRequired,
  }

  static defaultProps = {
    tokens: 0,
    tokensR: 0,
    balance: '0',
    txs: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      activeItem: '',
      modalDeposit: false,
      modalWithdraw: false,
      modalSend: false,
    };
  }

  componentDidMount = async () => {
    this.getInfoAccount();
  }


  getInfoAccount = () => {
    if (Object.keys(this.props.wallet).length !== 0) {
      this.props.handleInfoAccount(this.props.config.nodeEth, this.props.config.tokensAddress, this.props.abiTokens,
        this.props.wallet, this.props.password, this.props.config.operator, this.props.config.address);
    }
  }

  handleItemClick = (e, { name }) => {
    e.preventDefault();
    this.setState({ activeItem: name });
    if (name === 'deposit') {
      this.setState({ modalDeposit: true });
    } else if (name === 'withdraw') {
      this.setState({ modalWithdraw: true });
    } else if (name === 'send' || name === 'send0') {
      this.setState({ modalSend: true });
    }
  }

  toggleModalDeposit = () => { this.setState((prev) => ({ modalDeposit: !prev.modalDeposit })); }

  toggleModalWithdraw = () => { this.setState((prev) => ({ modalWithdraw: !prev.modalWithdraw })); }

  toggleModalSend = () => { this.setState((prev) => ({ modalSend: !prev.modalSend })); }

  handleClickGetTokens = () => {
    this.props.handleGetTokens(this.props.config.nodeEth, this.props.config.tokensAddress,
      this.props.wallet, this.props.password);
    this.getInfoAccount();
  }

  handleClickApprove = async (addressTokens, amountToken) => {
    const res = await this.props.handleApprove(addressTokens, this.props.abiTokens, this.props.wallet,
      amountToken, this.props.config.address, this.props.password, this.props.config.nodeEth);
    // eslint-disable-next-line no-console
    console.log(res);
  }

  render() {
    return (
      <Container textAlign="center">
        <MenuBack />
        <Header
          as="h1"
          style={{
            fontSize: '4em',
            fontWeight: 'normal',
            marginBottom: 0,
            marginTop: '1em',
          }}>
          Rollup Network
        </Header>
        <Divider />
        <MenuActions
          handleItemClick={this.handleItemClick} />
        <MessageTx />
        <InfoWallet
          wallet={this.props.wallet}
          apiOperator={this.props.apiOperator}
          handleClickApprove={this.handleClickApprove}
          addressTokensRef={this.addressTokensRef}
          amountTokensRef={this.amountTokensRef}
          handleClickGetTokens={this.handleClickGetTokens}
          balance={this.props.balance}
          tokens={this.props.tokens}
          tokensR={this.props.tokensR}
          tokensA={this.props.tokensA}
          isLoadingInfoAccount={this.props.isLoadingInfoAccount}
          getInfoAccount={this.getInfoAccount}
          txs={this.props.txs}
          tokensAddress={this.props.config.tokensAddress} />
        <ModalDeposit
          balance={this.props.balance}
          tokensA={this.props.tokensA}
          modalDeposit={this.state.modalDeposit}
          toggleModalDeposit={this.toggleModalDeposit}
          getInfoAccount={this.getInfoAccount} />
        <ModalWithdraw
          modalWithdraw={this.state.modalWithdraw}
          toggleModalWithdraw={this.toggleModalWithdraw}
          getInfoAccount={this.getInfoAccount} />
        <ModalSend
          modalSend={this.state.modalSend}
          toggleModalSend={this.toggleModalSend}
          activeItem={this.state.activeItem}
          getInfoAccount={this.getInfoAccount} />
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  wallet: state.general.wallet,
  apiOperator: state.general.apiOperator,
  abiTokens: state.general.abiTokens,
  config: state.general.config,
  password: state.general.password,
  balance: state.general.balance,
  tokens: state.general.tokens,
  tokensR: state.general.tokensR,
  tokensA: state.general.tokensA,
  txs: state.general.txs,
  isLoadingInfoAccount: state.general.isLoadingInfoAccount,
});

export default connect(mapStateToProps, { handleGetTokens, handleApprove, handleInfoAccount })(ActionView);
