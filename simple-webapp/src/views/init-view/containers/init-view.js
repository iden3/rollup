import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Container, Header, Divider, Button,
} from 'semantic-ui-react';
import { connect } from 'react-redux';
import { Redirect } from 'react-router-dom';

import ModalImport from '../components/modal-import';
import ModalCreate from '../components/modal-create';

import {
  handleLoadWallet, handleLoadFiles, handleLoadOperator, resetWallet, handleCreateWallet,
} from '../../../state/general/actions';
import { handleInitStateTx } from '../../../state/tx/actions';

const config = require('../../../utils/config.json');

class InitView extends Component {
  static propTypes = {
    wallet: PropTypes.object.isRequired,
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
    resetWallet: PropTypes.func.isRequired,
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
    };
  }

    componentDidMount = () => {
      this.props.resetWallet();
    }

    componentDidUpdate = () => {
      if (this.props.isLoadingWallet === false && Object.keys(this.props.wallet).length !== 0) {
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
        if (this.state.walletImport === '' || this.passwordRef.current.value === '') {
          throw new Error('Incorrect wallet or password');
        } else {
          this.props.handleInitStateTx();
          this.props.handleLoadWallet(this.state.walletImport, this.passwordRef.current.value, true);
          this.props.handleLoadFiles(config);
          this.props.handleLoadOperator(config);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err.message);
      }
    }

    handleClickCreate = async () => {
      try {
        const fileName = this.fileNameRef.current.value;
        const password = this.passwordRef.current.value;
        if (fileName === '' || password === '') {
          throw new Error('Incorrect wallet or password');
        } else {
          const encWallet = await this.props.handleCreateWallet(fileName, password);
          this.props.handleInitStateTx();
          this.props.handleLoadWallet(encWallet, password, false);
          this.props.handleLoadFiles(config);
          this.props.handleLoadOperator(config);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err.message);
      }
    }

    toggleModalImport = () => { this.setState((prev) => ({ modalImport: !prev.modalImport })); }

    toggleModalCreate = () => { this.setState((prev) => ({ modalCreate: !prev.modalCreate })); }

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
              content="Create New Rollup Wallet"
              icon="plus"
              size="massive"
              color="blue"
              onClick={this.toggleModalCreate} />
            <Divider />
            <Button
              content="Import Rollup Wallet"
              icon="upload"
              size="massive"
              color="violet"
              onClick={this.toggleModalImport} />
          </Button.Group>
          <ModalCreate
            modalCreate={this.state.modalCreate}
            toggleModalCreate={this.toggleModalCreate}
            handleChangeWallet={this.handleChangeWallet}
            handleClickCreate={this.handleClickCreate}
            fileNameRef={this.fileNameRef}
            passwordRef={this.passwordRef}
            isLoadingWallet={this.props.isLoadingWallet}
            isCreatingWallet={this.props.isCreatingWallet}
            errorCreateWallet={this.props.errorCreateWallet} />
          <ModalImport
            modalImport={this.state.modalImport}
            toggleModalImport={this.toggleModalImport}
            handleChangeWallet={this.handleChangeWallet}
            handleClickImport={this.handleClickImport}
            passwordRef={this.passwordRef}
            isLoadingWallet={this.props.isLoadingWallet}
            errorWallet={this.props.errorWallet} />
          {this.renderRedirect()}
        </Container>
      );
    }
}

const mapStateToProps = (state) => ({
  isLoadingWallet: state.general.isLoadingWallet,
  isCreatingWallet: state.general.isCreatingWallet,
  errorCreateWallet: state.general.errorCreateWallet,
  wallet: state.general.wallet,
  created: state.general.created,
  errorWallet: state.general.errorWallet,
});


export default connect(mapStateToProps, {
  handleLoadWallet, handleLoadFiles, handleLoadOperator, resetWallet, handleInitStateTx, handleCreateWallet,
})(InitView);
