# Run server test
Commands are called from repository `rollup` root directory

- Start local ethereum blockchain
`ganache-cli -a 100 --defaultBalanceEther 10000`

- Deploy contracts and build configuration files
  - Memory database 
    `truffle test ./rollup-operator/test/server/build-configs-memDb.test.js`
  - Level Db database
    `truffle test ./rollup-operator/test/server/build-configs-levelDb.test.js`

- Run servers
  - Proof-generator: `node ./rollup-operator/src/server-proof.js`
  - Operator: `node ./rollup-operator/src/server/operator.js`
    - operator needs configuration file `config.env` in its path
    - example can be found in `rollup/rollup-operator/test/config/config-example.env`
    - *It should be noted that this file should be where the `operator.js` is invoked and its name should be `config.env` 

- Run test #2
  - test all functions
    - test one operator registers to rollupPoS
    - get operators list
    - several deposit on-chain
    - get general information
    - set conversion table for tx-pool
    - send and forge off-chain transaction
    - get balance tree information 
`truffle test ./rollup-operator/test/server/operator-server.test.js`