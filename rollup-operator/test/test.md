# Run operator test
Commands are called from repository `rollup` root directory

In case some test doesn't work as expected, try to increase the `timeoutDelay` global variable

Start local ethereum blockchain
  - `ganache-cli -a 100 --defaultBalanceEther 10000`

## Unit test

Test PoS synchronizer:
  - `truffle test ./rollup-operator/test/synch-pos.test.js`

Test pool synchronizer:
  - `truffle test ./rollup-operator/test/synch-pool.test.js`

Test Rollup synchronizer on `light` mode:
  - `truffle test ./rollup-operator/test/synch-light.test.js`

Test Rollup synchronizer on `full` mode:
  - `truffle test ./rollup-operator/test/synch-full.test.js`

Test Rollup synchronizer on `archive` mode:
  - `truffle test ./rollup-operator/test/synch-archive.test.js`

Test operator manager:
  - `truffle test ./rollup-operator/test/op-manager.test.js`

## Test server proof

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test `server-proof`:
  - `truffle test ./rollup-operator/test/server-proof.test.js` 

## Test loop-manager

Start local ethereum blockchain
  - `ganache-cli -b 1 -a 100 --defaultBalanceEther 10000`

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test loop-manager:
  - `truffle test ./rollup-operator/test/loop-manager.test.js`