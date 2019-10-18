# Run server test
Commands are called from repository `rollup` root directory

- Start local ethereum blockchain
`ganache-cli -a 100 --defaultBalanceEther 10000`

- Deploy contracts and build configuration files
`truffle test ./rollup-operator/test/server/buildConfigs.test.js`

- Run servers
  - Proof-generator: `node ./rollup-operator/src/server-proof.js`
  - Operator: `node ./rollup-operator/src/server/operator.js`

- Run test #1
  - test one operator registers to rollupPoS and forge a block
`truffle test ./rollup-operator/test/server/operator.test.js`

- Run test #2
  - test all api-external functions
`truffle test ./rollup-operator/test/server/op-external-api.test.js`