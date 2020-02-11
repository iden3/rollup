import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';

import { handleGetTokens, handleApprove, handleInitStateTx } from '../../../state/tx/actions';
import { handleInfoAccount, handleInfoOperator, handleLoadFiles } from '../../../state/general/actions';
import { pointToCompress } from '../../../utils/utils';
import MenuBack from '../components/menu';
import MenuActions from '../components/menu-actions';
import InfoWallet from '../components/info-wallet';
import ModalDeposit from '../components/modal-deposit';
import ModalWithdraw from '../components/modal-withdraw';
import ModalSend from '../components/modal-send';
import MessageTx from '../components/message-tx';
import ModalError from '../components/modal-error';
import InfoOp from '../components/info-operator';

class ActionView extends Component {
  static propTypes = {
    desWallet: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    abiTokens: PropTypes.array.isRequired,
    tokens: PropTypes.string,
    tokensR: PropTypes.string,
    tokensA: PropTypes.string,
    tokensE: PropTypes.string,
    balance: PropTypes.string,
    txs: PropTypes.array,
    txsExits: PropTypes.array,
    apiOperator: PropTypes.object.isRequired,
    handleInitStateTx: PropTypes.func.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    handleInfoAccount: PropTypes.func.isRequired,
    handleInfoOperator: PropTypes.func.isRequired,
    handleLoadFiles: PropTypes.func.isRequired,
    handleGetTokens: PropTypes.func.isRequired,
    handleApprove: PropTypes.func.isRequired,
    gasMultiplier: PropTypes.number.isRequired,
    errorFiles: PropTypes.string.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    tokensR: '0',
    tokensE: '0',
    balance: '0',
    txs: [],
    txsExits: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      modalDeposit: false,
      modalWithdraw: false,
      modalSend: false,
      modalError: false,
      error: '',
      activeItem: '',
      noImported: false,
      babyjub: '0x0000000000000000000000000000000000000000',
    };
  }

  componentDidMount = async () => {
    this.getInfoAccount();
    this.infoOperator();
    if (Object.keys(this.props.desWallet).length === 0 || this.props.errorFiles !== '') {
      this.setState({ noImported: true });
    } else {
      this.setState({
        babyjub: pointToCompress(this.props.desWallet.babyjubWallet.publicKey),
      });
    }
  }

  changeNode = async (currentNode) => {
    const { config } = this.props;
    this.props.handleInitStateTx();
    config.nodeEth = currentNode;
    const nodeLoad = await this.props.handleLoadFiles(config);
    await this.getInfoAccount();
    if (Object.keys(this.props.desWallet).length === 0 || !nodeLoad) {
      this.setState({ noImported: true });
    } else {
      this.setState({
        babyjub: pointToCompress(this.props.desWallet.babyjubWallet.publicKey),
      });
      this.setState({ noImported: false });
    }
  }

  infoOperator = () => {
    this.props.handleInfoOperator(this.props.config.operator);
    setTimeout(this.infoOperator, 30000);
  }

  getInfoAccount = async () => {
    if (Object.keys(this.props.desWallet).length !== 0) {
      await this.props.handleInfoAccount(this.props.config.nodeEth, this.props.config.tokensAddress,
        this.props.abiTokens, this.props.desWallet, this.props.config.operator, this.props.config.address,
        this.props.config.abiRollup);
      await this.props.handleInfoOperator(this.props.config.operator);
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

  toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

  redirectInitView = () => {
    if (Object.keys(this.props.desWallet).length === 0) {
      return <Redirect to="/" />;
    }
  }

  handleClickGetTokens = async () => {
    const res = await this.props.handleGetTokens(this.props.config.nodeEth, this.props.config.tokensAddress,
      this.props.desWallet);
    if (res.message !== undefined) {
      if (res.message.includes('insufficient funds')) {
        this.setState({ error: '1' });
        this.toggleModalError();
      }
    }
    this.getInfoAccount();
  }

  handleClickApprove = async (addressTokens, amountToken) => {
    const res = await this.props.handleApprove(addressTokens, this.props.abiTokens, this.props.desWallet,
      amountToken, this.props.config.address, this.props.config.nodeEth, this.props.gasMultiplier);
    if (res.message !== undefined) {
      if (res.message.includes('insufficient funds')) {
        this.setState({ error: '1' });
        this.toggleModalError();
      }
    }
  }

  render() {
    return (
      <Container textAlign="center">
        <MenuBack
          config={this.props.config}
          changeNode={this.changeNode}
          isLoadingInfoAccount={this.props.isLoadingInfoAccount} />
        <Header
          as="h1"
          style={{
            fontSize: '4em',
            fontWeight: 'normal',
            marginBottom: 0,
            marginTop: '1em',
          }}>
          Rollup Wallet
        </Header>
        <Divider />
        <MenuActions
          handleItemClick={this.handleItemClick}
          noImported={this.state.noImported} />
        <MessageTx />
        <InfoWallet
          desWallet={this.props.desWallet}
          handleClickApprove={this.handleClickApprove}
          addressTokensRef={this.addressTokensRef}
          amountTokensRef={this.amountTokensRef}
          handleClickGetTokens={this.handleClickGetTokens}
          balance={this.props.balance}
          tokens={this.props.tokens}
          tokensR={this.props.tokensR}
          tokensE={this.props.tokensE}
          tokensA={this.props.tokensA}
          isLoadingInfoAccount={this.props.isLoadingInfoAccount}
          getInfoAccount={this.getInfoAccount}
          txs={this.props.txs}
          txsExits={this.props.txsExits}
          tokensAddress={this.props.config.tokensAddress}
          noImported={this.state.noImported} />
        <Divider horizontal>ROLLUP INFORMATION</Divider>
        <InfoOp />
        <ModalDeposit
          balance={this.props.balance}
          tokensA={this.props.tokensA}
          modalDeposit={this.state.modalDeposit}
          toggleModalDeposit={this.toggleModalDeposit}
          gasMultiplier={this.props.gasMultiplier} />
        <ModalWithdraw
          desWallet={this.props.desWallet}
          modalWithdraw={this.state.modalWithdraw}
          toggleModalWithdraw={this.toggleModalWithdraw}
          gasMultiplier={this.props.gasMultiplier} />
        <ModalSend
          babyjub={this.state.babyjub}
          apiOperator={this.props.apiOperator}
          modalSend={this.state.modalSend}
          toggleModalSend={this.toggleModalSend}
          activeItem={this.state.activeItem} />
        <ModalError
          error={this.state.error}
          modalError={this.state.modalError}
          toggleModalError={this.toggleModalError} />
        {this.redirectInitView()}
        <br />
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  wallet: state.general.wallet,
  desWallet: state.general.desWallet,
  apiOperator: state.general.apiOperator,
  abiTokens: state.general.abiTokens,
  config: state.general.config,
  password: state.general.password,
  balance: state.general.balance,
  tokens: state.general.tokens,
  tokensR: state.general.tokensR,
  tokensA: state.general.tokensA,
  tokensE: state.general.tokensE,
  txs: state.general.txs,
  txsExits: state.general.txsExits,
  isLoadingInfoAccount: state.general.isLoadingInfoAccount,
  errorFiles: state.general.errorFiles,
  gasMultiplier: state.general.gasMultiplier,
});

export default connect(mapStateToProps, {
  handleGetTokens,
  handleApprove,
  handleInfoAccount,
  handleInfoOperator,
  handleLoadFiles,
  handleInitStateTx,
})(ActionView);
