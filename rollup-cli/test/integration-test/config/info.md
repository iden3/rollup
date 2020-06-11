# Test

### Ethereum Wallet test
`npx mocha rollup-cli/test/utils/ethereum-wallet.test.js`

### Wallet test
`npx mocha rollup-cli/test/utils/wallet.test.js`

### DB test
`npx mocha rollup-cli/test/utils/db.test.js`

## TX Test
Next test should have running dummy `operator` server in `http://127.0.0.1:9000`

This server can be found in `rollup-cli/test/helpers/api-client.js`

- Go to `rollup-cli` folder:
  - Run server by typing `npm run operator-dummy`

### Offchain TX test
Run test by typing `npx mocha rollup-cli/test/actions/send.test.js`

### Onchain TX test
Run ganache testnet: `ganache-cli`

Run onchain TX test by typing: `npx truffle test rollup-cli/test/actions/onchain.test.js`

### CLI Test
Run ganache testnet: `ganache-cli`

This command will create all the needed configuration to trigger test
  - Run `npx truffle test rollup-cli/test/integration-test/config/setup-cli.test.js`

- Run test:
Go to `rollup-cli` folder:
  - Run `npx mocha test/integration-test/cli.test.js`
