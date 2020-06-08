# Run CLI-PoB test
Commands are called from repository `rollup/cli-pob` directory

- Start local ethereum blockchain
`ganache-cli -b 1 --mnemonic "jaguar exhaust token lounge clerk gun metal vacant raven roast youth jealous" --defaultBalanceEther 100000`

- Run build-configs
`npx truffle test test/helpers/build-configs.test.js`

- Run Test Bid
`npx mocha test/bid.test.js`

- Run Test Multibid
`npx mocha test/multibid.test.js`

- Run Test Withdraw
`npx mocha test/withdraw.test.js`