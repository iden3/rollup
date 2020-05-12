# Test

### Ethereum Wallet test
`npx mocha rollup-cli/test/ethereum-wallet.test.js`

### Wallet test
`npx mocha rollup-cli/test/wallet.test.js`

### DB test
`npx mocha rollup-cli/test/db.test.js`

## TX Test
Next test should have running dummy `operator` server in `http://127.0.0.1:9000`

This server can be found in `rollup-cli/test/helpers/api-client.js`

- Go to `rollup-cli` folder:
  - Run server by typing `npm run operator-dummy`

### Offchain TX test
Run test by typing `npx mocha rollup-cli/test/send.test.js`

### Onchain TX test
Run ganache testnet: `ganache-cli`

Run onchain TX test by typing: `npx truffle test rollup-cli/test/onchain.test.js`

### CLI Test
Run ganache testnet: `ganache-cli`

- Run test:
  - Run `npx truffle test rollup-cli/test/config/setup-cli.test.js`
This command will create all the needed configuration to trigger test
  - Go to `rollup-cli/test`
  - Run `npx mocha cli.test.js`
