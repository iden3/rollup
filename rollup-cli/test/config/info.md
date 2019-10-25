# Test
Next test should have running an dummy `operator` server in `http://127.0.0.1:9000`
- `cli.test.js`
- `cliActionsOnChain.test.js`
- `onChain.test.js`
- `send.test.js`
- `setup.cli-deposit.test.js`


This server can be found in `rollup-cli/test/helpers/api-client.js`

Run server by typing `node api-client.js`

## Steps
### Run ganache
Run ganache testnet: `ganache-cli`

### Build configs
Go to `rollup-cli/test/config` and run `truffle test build-resources.test.js`

This command will create all the needed configuration to trigger test
