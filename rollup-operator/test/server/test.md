# Run server test
Commands are called from repository `rollup` root directory

- Start local ethereum blockchain
`ganache-cli -a 100 --defaultBalanceEther 10000`

- Deploy contracts and build configuration files
`truffle test ./rollup-operator/test/server/buildConfigs.test.js`

- Run servers
  - Proof-generator: `node ./rollup-operator/src/server-proof.js`
  - Operator: `node ./rollup-operator/src/server/operator.js`

- Run test
`truffle test ./rollup-operator/test/server/operator.test.js`