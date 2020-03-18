# Run CLI-PoS test
Commands are called from repository `rollup/cli-pos/test` directory

- Start local ethereum blockchain
`ganache-cli -b 1 --mnemonic "jaguar exhaust token lounge clerk gun metal vacant raven roast youth jealous" --defaultBalanceEther 100000`

- Run build-configs
`truffle test helpers/build-configs.test.js`

- Run Test Register
`mocha register.test.js`

- Run Test Unregister
`mocha unregister.test.js`

- Move some eras
`truffle test helpers/add-blocks.js`

- Run Test Withdraw
`mocha withdraw.test.js`