# Run operator test
Commands are called from repository `rollup` root directory

In case some test doesn't work as expected, try to increase the `timeoutDelay` global variable

Start local ethereum blockchain
  - `ganache-cli -a 20 --defaultBalanceEther 10000`

## Unit test

Test Token synchronizer:
  - `npx truffle test ./rollup-operator/test/synch-tokens.test.js`

Test PoS synchronizer:
  - `npx truffle test ./rollup-operator/test/proof-of-stake/synch-pos.test.js`

Test PoB synchronizer:
  - `npx truffle test ./rollup-operator/test/proof-of-burn/synch-pob.test.js`

Test pool synchronizer:
  - `npx truffle test ./rollup-operator/test/synch-pool.test.js`

Test Rollup synchronizer:
  - `npx truffle test ./rollup-operator/test/synch.test.js`

Test operator manager:
  - `npx truffle test ./rollup-operator/test/proof-of-stake/interface-pos.test.js`

Test interface PoB:
  - `npx truffle test ./rollup-operator/test/proof-of-burn/interface-pob.test.js`

All at once:
  - `npx truffle test ./rollup-operator/test/synch-tokens.test.js; npx truffle test ./rollup-operator/test/proof-of-stake/synch-pos.test.js; npx truffle test ./rollup-operator/test/proof-of-burn/synch-pob.test.js; npx truffle test ./rollup-operator/test/synch-pool.test.js; npx truffle test ./rollup-operator/test/synch.test.js; npx truffle test ./rollup-operator/test/proof-of-stake/interface-pos.test.js; npx truffle test ./rollup-operator/test/proof-of-burn/interface-pob.test.js`

## Test server proof

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test `server-proof`:
  - `npx mocha ./rollup-operator/test/server-proof.test.js` 

## Test loop-manager

Start local ethereum blockchain
  - `npx ganache-cli -b 1 -a 100 --defaultBalanceEther 10000`

Open new terminal and run server-proof service:
  - `cd ./rollup-operator`
  - `npm run server-proof`

Test loop-manager:
  - `npx truffle test ./rollup-operator/test/proof-of-stake/loop-manager-pos.test.js`

Test loop-manager PoB:
  - `npx truffle test ./rollup-operator/test/proof-of-burn/loop-manager-pob.test.js`
