# Run CLI-PoB test
Commands are called from repository `rollup/cli-pob/test` directory

- Start local ethereum blockchain
`ganache-cli -b 1 --mnemonic "jaguar exhaust token lounge clerk gun metal vacant raven roast youth jealous" --defaultBalanceEther 100000`

- Run build-configs
`truffle test helpers/build-configs.test.js`

- Run Test Bid
`mocha bid.test.js`

- Run Test Withdraw
`mocha withdraw.test.js`