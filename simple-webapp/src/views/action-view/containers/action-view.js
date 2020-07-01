import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Header, Container, Divider } from 'semantic-ui-react';
import { Redirect } from 'react-router-dom';

import { handleGetTokens, handleApprove, handleInitStateTx } from '../../../state/tx/actions';
import { handleInfoAccount, handleLoadFiles, getCurrentBatch } from '../../../state/general/actions';
import { pointToCompress } from '../../../utils/utils';
import MenuActions from '../components/actions/menu-actions';
import MenuBack from '../components/information/menu';
import InfoWallet from '../components/information/info-wallet';
import InfoTx from '../components/information/info-tx';
import MessageTx from '../components/information/message-tx';
import ModalError from '../components/modals-info/modal-error';
import ModalDeposit from '../components/modals-actions/modal-deposit';
import ModalWithdraw from '../components/modals-actions/modal-withdraw';
import ModalSend from '../components/modals-actions/modal-send';
import ModalApprove from '../components/modals-actions/modal-approve';
import ModalGetTokens from '../components/modals-actions/modal-get-tokens';
import ModalForceExit from '../components/modals-actions/modal-force-exit';

class ActionView extends Component {
  static propTypes = {
    wallet: PropTypes.object.isRequired,
    metamaskWallet: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    abiTokens: PropTypes.array.isRequired,
    tokens: PropTypes.string,
    tokensList: PropTypes.array.isRequired,
    tokensArray: PropTypes.array,
    tokensR: PropTypes.string,
    tokensA: PropTypes.string,
    tokensAArray: PropTypes.array,
    tokensE: PropTypes.string,
    tokensTotal: PropTypes.string,
    balance: PropTypes.string,
    txs: PropTypes.array,
    txsExits: PropTypes.array,
    apiOperator: PropTypes.object.isRequired,
    handleInitStateTx: PropTypes.func.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
    handleInfoAccount: PropTypes.func.isRequired,
    handleLoadFiles: PropTypes.func.isRequired,
    getCurrentBatch: PropTypes.func.isRequired,
    errorFiles: PropTypes.string.isRequired,
    txTotal: PropTypes.array.isRequired,
  }

  static defaultProps = {
    tokens: '0',
    tokensR: '0',
    tokensE: '0',
    balance: '0',
    txs: [],
    txsExits: [],
    tokensArray: [],
    tokensAArray: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      modalDeposit: false,
      modalWithdraw: false,
      modalForceExit: false,
      modalSend: false,
      modalApprove: false,
      modalGetTokens: false,
      modalError: false,
      error: '',
      activeItem: '',
      noImported: false,
      babyjub: '0x0000000000000000000000000000000000000000',
      lengthTx: 0,
    };
  }

  componentDidMount = async () => {
    this.getInfoAccount();
    this.infoOperator();
    if (this.props.errorFiles !== '') {
      this.setState({ noImported: true });
    } else {
      this.setState({
        babyjub: pointToCompress(this.props.desWallet.babyjubWallet.publicKey),
        lengthTx: this.props.txTotal.length,
      });
    }
  }

  componentDidUpdate = () => {
    if (this.props.txTotal.length > this.state.lengthTx) {
      this.setState({ lengthTx: this.props.txTotal.length });
      this.getInfoAccount();
    }
  }

  changeNode = async (currentNode) => {
    const { config } = this.props;
    this.props.handleInitStateTx();
    config.nodeEth = currentNode;
    const nodeLoad = await this.props.handleLoadFiles(config);
    await this.getInfoAccount();
    if (!nodeLoad) {
      this.setState({ noImported: true });
    } else {
      this.setState({
        babyjub: pointToCompress(this.props.desWallet.babyjubWallet.publicKey),
      });
      this.setState({ noImported: false });
    }
  }

  infoOperator = () => {
    this.props.getCurrentBatch(this.props.config.operator);
    setTimeout(this.infoOperator, 30000);
  }

  getInfoAccount = async () => {
    await this.props.handleInfoAccount(this.props.config.nodeEth, this.props.abiTokens, this.props.wallet,
      this.props.config.operator, this.props.config.address, this.props.config.abiRollup);
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
    } else if (name === 'approve') {
      this.setState({ modalApprove: true });
    } else if (name === 'getTokens') {
      this.setState({ modalGetTokens: true });
    } else if (name === 'forcexit') {
      this.setState({ modalForceExit: true });
    }
  }

  toggleModalDeposit = () => { this.setState((prev) => ({ modalDeposit: !prev.modalDeposit })); }

  toggleModalWithdraw = () => { this.setState((prev) => ({ modalWithdraw: !prev.modalWithdraw })); }

  toggleModalForceExit = () => { this.setState((prev) => ({ modalForceExit: !prev.modalForceExit })); }

  toggleModalSend = () => { this.setState((prev) => ({ modalSend: !prev.modalSend })); }

  toggleModalApprove = () => { this.setState((prev) => ({ modalApprove: !prev.modalApprove })); }

  toggleModalGetTokens = () => { this.setState((prev) => ({ modalGetTokens: !prev.modalGetTokens })); }

  toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

  redirectInitView = () => {
    if (Object.keys(this.props.desWallet).length === 0) {
      return <Redirect to="/" />;
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
          balance={this.props.balance}
          tokens={this.props.tokens}
          tokensR={this.props.tokensR}
          tokensE={this.props.tokensE}
          tokensA={this.props.tokensA}
          tokensArray={this.props.tokensArray}
          tokensAArray={this.props.tokensAArray}
          tokensTotal={this.props.tokensTotal}
          isLoadingInfoAccount={this.props.isLoadingInfoAccount}
          getInfoAccount={this.getInfoAccount}
          txs={this.props.txs}
          txsExits={this.props.txsExits}
          noImported={this.state.noImported} />
        <br />
        <InfoTx
          desWallet={this.props.desWallet} />
        <ModalDeposit
          balance={this.props.balance}
          tokensList={this.props.tokensList}
          tokensA={this.props.tokensA}
          modalDeposit={this.state.modalDeposit}
          toggleModalDeposit={this.toggleModalDeposit} />
        <ModalWithdraw
          desWallet={this.props.desWallet}
          modalWithdraw={this.state.modalWithdraw}
          toggleModalWithdraw={this.toggleModalWithdraw} />
        <ModalForceExit
          tokensList={this.props.tokensList}
          desWallet={this.props.desWallet}
          babyjub={this.state.babyjub}
          modalForceExit={this.state.modalForceExit}
          toggleModalForceExit={this.toggleModalForceExit} />
        <ModalSend
          tokensRArray={this.props.tokensRArray}
          babyjub={this.state.babyjub}
          apiOperator={this.props.apiOperator}
          modalSend={this.state.modalSend}
          toggleModalSend={this.toggleModalSend}
          activeItem={this.state.activeItem} />
        <ModalApprove
          balance={this.props.balance}
          modalApprove={this.state.modalApprove}
          toggleModalApprove={this.toggleModalApprove}
          tokensA={this.props.tokensA} />
        <ModalGetTokens
          balance={this.props.balance}
          modalGetTokens={this.state.modalGetTokens}
          toggleModalGetTokens={this.toggleModalGetTokens} />
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
  metamaskWallet: state.general.metamaskWallet,
  apiOperator: state.general.apiOperator,
  abiTokens: state.general.abiTokens,
  config: state.general.config,
  password: state.general.password,
  balance: state.general.balance,
  tokensList: state.general.tokensList,
  tokens: state.general.tokens,
  tokensArray: state.general.tokensArray,
  tokensR: state.general.tokensR,
  tokensA: state.general.tokensA,
  tokensAArray: state.general.tokensAArray,
  tokensRArray: state.general.tokensRArray,
  tokensE: state.general.tokensE,
  tokensTotal: state.general.tokensTotal,
  txs: state.general.txs,
  txsExits: state.general.txsExits,
  isLoadingInfoAccount: state.general.isLoadingInfoAccount,
  errorFiles: state.general.errorFiles,
  txTotal: state.txState.txTotal,
});

export default connect(mapStateToProps, {
  handleGetTokens,
  handleApprove,
  handleInfoAccount,
  handleLoadFiles,
  handleInitStateTx,
  getCurrentBatch,
})(ActionView);
