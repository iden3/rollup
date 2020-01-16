# Run pool synchronizer test
Commands are called from repository `rollup` root directory

Start local ethereum blockchain
  - `ganache-cli -a 100 --defaultBalanceEther 10000`

## Unit test

Test api bitfinex
  - `mocha ./rollup-operator/test/synch-pool-service/api-bitfinex.test.js`

Test pool synchronizer
  - `truffle test ./rollup-operator/test/synch-pool-service/synch-pool-service.test.js`

## Service pool synchronizer

Build configuration files
  - `truffle test ./rollup-operator/test/synch-pool-service/build-configs.test.js`

Open new terminal and run service
  - `cd ./rollup-operator`
  - `npm run service-synch-pool`

Test service
  - `truffle test ./rollup-operator/test/synch-pool-service/run-synch-pool.test`