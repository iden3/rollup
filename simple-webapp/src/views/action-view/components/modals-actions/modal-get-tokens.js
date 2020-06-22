import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button, Modal, Form, Icon,
} from 'semantic-ui-react';

import ModalError from '../modals-info/modal-error';
import ButtonGM from './gm-buttons';
import { handleGetTokens } from '../../../../state/tx/actions';

class ModalGetTokens extends Component {
    static propTypes = {
      config: PropTypes.object.isRequired,
      desWallet: PropTypes.object.isRequired,
      modalGetTokens: PropTypes.bool.isRequired,
      toggleModalGetTokens: PropTypes.func.isRequired,
      handleGetTokens: PropTypes.func.isRequired,
    }

    constructor(props) {
      super(props);
      this.state = {
        modalError: false,
        error: '',
      };
    }

    toggleModalError = () => { this.setState((prev) => ({ modalError: !prev.modalError })); }

    handleClickGetTokens = async () => {
      const { config, desWallet } = this.props;
      this.props.toggleModalGetTokens();
      const res = await this.props.handleGetTokens(config.nodeEth, config.tokensAddress, desWallet);
      if (res.message !== undefined) {
        if (res.message.includes('insufficient funds')) {
          this.setState({ error: '1' });
          this.toggleModalError();
        }
      }
    }

    render() {
      return (
        <div>
          <ModalError
            error={this.state.error}
            modalError={this.state.modalError}
            toggleModalError={this.toggleModalError} />
          <Modal open={this.props.modalGetTokens}>
            <Modal.Header>Get Tokens</Modal.Header>
            <Modal.Content>
              <Form>
                <Form.Field>
                  <b>
                    Amount Tokens:
                  </b>
                  <p>1000</p>
                </Form.Field>
                <Form.Field>
                  <label htmlFor="addressTokens">
                    Address SC Tokens:
                    <input
                      type="text"
                      disabled
                      placeholder="0x0000000000000000000000000000000000000000"
                      ref={this.addressTokensRef}
                      defaultValue={this.props.config.tokensAddress}
                      size="40" />
                  </label>
                </Form.Field>
                <Form.Field>
                  <ButtonGM />
                </Form.Field>
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={this.handleClickGetTokens} color="blue">
                <Icon name="ethereum" />
                  GET TOKENS
              </Button>
              <Button color="grey" basic onClick={this.props.toggleModalGetTokens}>
                <Icon name="close" />
                Close
              </Button>
            </Modal.Actions>
          </Modal>
        </div>
      );
    }
}

const mapStateToProps = (state) => ({
  config: state.general.config,
  desWallet: state.general.desWallet,
  gasMultiplier: state.general.gasMultiplier,
});

export default connect(mapStateToProps, { handleGetTokens })(ModalGetTokens);
