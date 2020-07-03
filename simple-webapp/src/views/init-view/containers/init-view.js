import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Container, Header, Divider, Button,
} from 'semantic-ui-react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import {
  handleLoadWallet, handleLoadFiles, handleLoadOperator, resetWallet, handleCreateWallet, handleLoadMetamask
} from '../../../state/general/actions';
import { handleInitStateTx } from '../../../state/tx/actions';
import { handleResetTxs } from '../../../state/tx-state/actions';
import ethers from 'ethers';

const config = require('../../../utils/config.json');

class InitView extends Component {
  static propTypes = {
    isLoadingWallet: PropTypes.bool.isRequired,
    errorWallet: PropTypes.string.isRequired,
    isCreatingWallet: PropTypes.bool.isRequired,
    errorCreateWallet: PropTypes.string.isRequired,
    created: PropTypes.bool.isRequired,
    handleInitStateTx: PropTypes.func.isRequired,
    handleLoadWallet: PropTypes.func.isRequired,
    handleLoadFiles: PropTypes.func.isRequired,
    handleLoadOperator: PropTypes.func.isRequired,
    handleCreateWallet: PropTypes.func.isRequired,
    handleLoadMetamask: PropTypes.func.isRequired,
    resetWallet: PropTypes.func.isRequired,
    handleResetTxs: PropTypes.func.isRequired,
  }

  constructor(props) {
    super(props);
    this.passwordRef = React.createRef();
    this.fileNameRef = React.createRef();
    this.state = {
      isLoaded: false,
      modalImport: false,
      modalCreate: false,
      walletImport: '',
      nameWallet: '',
      step: 0,
      desc: '',
    };
  }

  componentDidMount = () => {
    this.props.resetWallet();
    window.ethers = ethers;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('node')) {
      const tokenInfura = urlParams.get('node');
      const node = `https://goerli.infura.io/v3/${tokenInfura}`;
      config.nodeEth = node;
    }
  }

  componentDidUpdate = () => {
    if (this.props.isLoadingWallet === false) {
      this.setState({ isLoaded: true, modalImport: false });
    }
    if (this.props.created === true && this.state.isLoaded === true && this.state.modalCreate === true) {
      this.setState({ modalCreate: false });
    }
  }

  handleChangeWallet = (e) => {
    e.preventDefault();
    const { files } = e.target;
    this.setState({ walletImport: files[0] });
  }

  handleClickImport = async () => {
    try {
      this.setState({ step: 0, desc: '' });
      if (this.state.walletImport === '' || this.passwordRef.current.value === '') {
        throw new Error('Incorrect wallet or password');
      } else {
        await this.props.handleInitStateTx();
        this.props.handleResetTxs();
        await this.props.handleLoadFiles(config);
        this.setState({ step: 1, desc: '1/3 Loading Operator' });
        await this.props.handleLoadOperator(config);
        this.setState({ step: 2, desc: '2/3 Loading Wallet' });
        await this.props.handleLoadWallet(this.state.walletImport, this.passwordRef.current.value, true);
      }
    } catch (err) {
      this.setState({
        walletImport: '',
      });
    }
  }

  handleClickCreate = async () => {
    try {
      this.setState({ step: 0, desc: '' });
      const fileName = this.fileNameRef.current.value;
      const password = this.passwordRef.current.value;
      if (fileName === '' || password === '') {
        throw new Error('Incorrect wallet or password');
      } else {
        this.setState({ step: 1, desc: '1/4 Creating Wallet' });
        const encWallet = await this.props.handleCreateWallet(fileName, password);
        await this.props.handleInitStateTx();
        await this.props.handleLoadFiles(config);
        this.setState({ step: 2, desc: '2/4 Loading Operator' });
        await this.props.handleLoadOperator(config);
        this.setState({ step: 3, desc: '3/4 Loading Wallet' });
        await this.props.handleLoadWallet(encWallet, password, false);
      }
    } catch (err) {
      this.props.handleInitStateTx();
    }
  }

  toggleModalImport = () => { this.setState((prev) => ({ modalImport: !prev.modalImport })); }

  toggleModalCreate = () => {
    const nameWallet = 'zkrollup-backup-';
    const date = new Date(Date.now());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const min = date.getMinutes();
    this.setState((prev) => ({
      modalCreate: !prev.modalCreate,
      nameWallet: `${nameWallet}${year}${month}${day}-${hour}${min}`,
    }));
  }

  checkMetamask = () => {
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  }

  signInMetamask = async () => {
    if (this.checkMetamask()) {
      try {
        await this.props.handleInitStateTx();
        await window.ethereum.enable();
        await this.props.handleLoadOperator(config);
        await this.props.handleLoadMetamask();
        this.setState({ isLoaded: true });
      } catch (error) {
        console.error(error);
      }
    }
  }

  renderRedirect = () => {
    if (this.state.isLoaded === true) {
      return <Redirect to="/actions" />;
    }
  }

  render() {
    return (
      <Container textAlign="center">
        <Header
          as="h1"
          style={{
            fontSize: '4em',
            fontWeight: 'normal',
            marginBottom: 0,
            marginTop: '3em',
          }}>
            Rollup
        </Header>
        <Divider />
        <Button.Group vertical>
          <Button
            content="Sign In Metamask"
            icon="plus"
            size="massive"
            color="blue"
            onClick={this.signInMetamask} />
        </Button.Group>
        {this.renderRedirect()}
      </Container>
    );
  }
}

const mapStateToProps = (state) => ({
  isLoadingWallet: state.general.isLoadingWallet,
  isCreatingWallet: state.general.isCreatingWallet,
  errorCreateWallet: state.general.errorCreateWallet,
  created: state.general.created,
  errorWallet: state.general.errorWallet,
});


export default connect(mapStateToProps, {
  handleLoadWallet,
  handleLoadFiles,
  handleLoadOperator,
  handleLoadMetamask,
  resetWallet,
  handleInitStateTx,
  handleCreateWallet,
  handleResetTxs,
})(InitView);
