# Run operator test
Commands are called from repository `rollup` root directory

In case some test doesn't work as expected, try to increase the `timeoutDelay` global variable

Start local ethereum blockchain
  - `ganache-cli -a 100 --defaultBalanceEther 10000`

## Unit test

Test Token synchronizer:
  - `truffle test ./rollup-operator/test/synch-tokens.test.js`

Test PoS synchronizer:
  - `truffle test ./rollup-operator/test/synch-pos.test.js`

Test pool synchronizer:
  - `truffle test ./rollup-operator/test/synch-pool.test.js`

Test Rollup synchronizer:
  - `truffle test ./rollup-operator/test/synch.test.js`

Test operator manager:
  - `truffle test ./rollup-operator/test/op-manager.test.js`

## Test server proof

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test `server-proof`:
  - `mocha ./rollup-operator/test/server-proof.test.js` 

## Test loop-manager

Start local ethereum blockchain
  - `ganache-cli -b 1 -a 100 --defaultBalanceEther 10000`

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test loop-manager:
  - `truffle test ./rollup-operator/test/loop-manager.test.js`