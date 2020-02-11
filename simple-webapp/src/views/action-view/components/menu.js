/* eslint-disable react/no-unescaped-entities */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Menu, Icon, Modal, Button, Popup, Form,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';

class MenuBack extends Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
    changeNode: PropTypes.func.isRequired,
    isLoadingInfoAccount: PropTypes.bool.isRequired,
  }

  constructor(props) {
    super(props);
    this.nodeRef = React.createRef();
    this.state = {
      modalHelp: false,
      loading: false,
      changeNode: false,
      flagChange: false,
      viewChangeNode: false,
    };
  }

  componentDidUpdate = () => {
    if (this.props.isLoadingInfoAccount === true && this.state.changeNode === true && this.state.flagChange === false) {
      this.setState({ loading: true, flagChange: true });
    } else if (this.props.isLoadingInfoAccount === false && this.state.changeNode === true
      && this.state.flagChange === true) {
      this.setState({ loading: false, changeNode: false, flagChange: false });
    }
  }

  toggleModalHelp = () => { this.setState((prev) => ({ modalHelp: !prev.modalHelp })); }
  toggleChangeNode = () => { this.setState((prev) => ({ viewChangeNode: !prev.viewChangeNode })); }

  handleClickChangeNode = () => {
    const currentNode = this.nodeRef.current.value;
    this.setState({ changeNode: true });
    this.props.changeNode(currentNode);
  }

  loadingIcon = () => {
    if (this.state.loading) return <Icon name="circle notched" loading />;
  }

  render() {
    return (
      <Menu secondary size="large">
        <Menu.Menu position="left">
          <Menu.Item>
            <Popup
              position="bottom left"
              flowing
              on="click"
              trigger={<Button content="Change Node" icon="ethereum" basic />} >
              <Form>
                <label htmlFor="nodeEth">
                  <b>Url Node Ethereum: </b>
                  <input type="text" id="node" size="40" defaultValue={this.props.config.nodeEth} ref={this.nodeRef} />
                  <Button onClick={this.handleClickChangeNode}>Change Node</Button>
                  {this.loadingIcon()}
                </label>
              </Form>
            </Popup>
            <Button content="Help" icon="help" basic onClick={this.toggleModalHelp} />
          </Menu.Item>
         </Menu.Menu>
        <Menu.Menu position="right">
          <Link to="/">
            <Menu.Item name="initView">
              <Icon name="reply" />
              Back
            </Menu.Item>
          </Link>
        </Menu.Menu>
        <Modal open={this.state.modalHelp}>
          <Modal.Header>
            <Icon name="help circle" />
            Help
          </Modal.Header>
          <Modal.Content>
            <p>Transactions:</p>
            <p>
              <dd>
                <b> Ethereum</b>
                : we need ether to be able to do them
              </dd>
            </p>
            <p><dd>  - Deposit: put tokens within the rollup network</dd></p>
            <p><dd>  - Exit: take tokens from the rollup network, but you must make a withdraw before</dd></p>
            <p>
              <dd>
                <b> Rollup</b>
                : we need to have made a deposit and have tokens in the rollup network
              </dd>
            </p>
            <p><dd>  - Send: send tokens from one id to another</dd></p>
            <p><dd>  - Withdraw: prepare the tokens to be able to make an exit transaction</dd></p>
            <p>Tokens:</p>
            <p>
              <dd>- What are tokens for?</dd>
            </p>
            <p>
              <dd>They are the "coins" that you can use to interact with the rollup.</dd>
            </p>
            <p>
              <dd>
                - How can I get them?
              </dd>
            </p>
            <p>
              <dd>
                Sending a transaction with the "GET TOKENS" button.
                To send it, you need to have ETHER.
              </dd>
            </p>
            <p>
              <dd>
                - How can I get ether?
              </dd>
            </p>
            <p>
              <dd>
                By clicking the "GET ETHER" button and putting its ethereum address in the faucet.
              </dd>
            </p>
            <p>Approve:</p>
            <p>
              <dd>
                - What is the purpose of approving tokens?
              </dd>
            </p>
            <p>
              <dd>
                When you approve the tokens, you are giving permission to the ROLLUP contract
                to take the tokens indicated in the transaction when making a DEPOSIT.
              </dd>
            </p>
            <p>
              <dd>
                - How do I approve?
              </dd>
            </p>
            <p>
              <dd>
                Indicating the number of tokens you want to approve and clicking the "APPROVE"
                button. You will need ether, since you are sending a transaction.
              </dd>
            </p>
            <p>ID's:</p>
            <p>
              <dd>
                - What are the IDs?
              </dd>
            </p>
            <p>
              <dd>
                It is the identifier of each leaf in the rollup.
                Each time you make a deposit, a new ID will appear.
              </dd>
            </p>
            <p>
              <dd>
                - How should I use the ID?
              </dd>
            </p>
            <p>
              <dd>
                When you want to make a transfer
                you must choose the ID of the leaf from which you want to make the transfer.
                You must also indicate the ID of the receiving leaf.
              </dd>
            </p>
          </Modal.Content>
          <Modal.Actions>
            <Button color="blue" onClick={this.toggleModalHelp}>
              OK
            </Button>
          </Modal.Actions>
        </Modal>
      </Menu>
    );
  }
}

export default MenuBack;
