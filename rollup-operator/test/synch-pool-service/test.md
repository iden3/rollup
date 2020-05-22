# Run pool synchronizer test
Commands are called from repository `rollup` root directory

Start local ethereum blockchain
  - `ganache-cli -a 10 --defaultBalanceEther 10000`

## Unit test

Test api bitfinex
  - `npx mocha ./rollup-operator/test/synch-pool-service/api-bitfinex.test.js`

Test pool synchronizer
  - `npx truffle test ./rollup-operator/test/synch-pool-service/synch-pool-service.test.js`

## Service pool synchronizer

Build configuration files:
  - Memory database
    - `npx truffle test ./rollup-operator/test/synch-pool-service/build-configs-memDb.test.js`
  - LevelDb database
    - `npx truffle test ./rollup-operator/test/synch-pool-service/build-configs-levelDb.test.js`

Open new terminal and run service
  - `cd ./rollup-operator`
  - `npm run service-synch-pool`
    - service needs configuration file `config.env` in its path
    - example can be found in `rollup/rollup-operator/test/synch-pool-service/config/config.env-example`
    - *It should be noted that this file should be where the `run-synch-pool.js` is invoked and its name should be `config.env`

Test service
  - `npx truffle test ./rollup-operator/test/synch-pool-service/run-synch-pool.test.js`