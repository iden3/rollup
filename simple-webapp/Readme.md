# Web Wallet

## Getting Started

You need 4 different terminals to end up running:

1. A fake blockchain
2. Server spoofing
3. A Rollup operator
4. The Web Wallet livecoding server

These are the steps:

1. `ganache-cli -a 100 --defaultBalanceEther 10000 -m "hard crop gallery regular neglect weekend fatal stamp eight flock inch doll"` Leave it running
2. `cd .. && truffle test ./rollup-operator/test/server/webapp-test/build-configs-UI.test.js`
3. `node ./rollup-operator/src/server-proof.js` Leave it running
4. `npm run build:webapp`
5. `cd simple-webapp/test && node build-config.js`
6. `cd ../.. && ./rollup-operator/test/server/webapp-test/create-config-env.sh`
7. `node rollup-operator/src/server/proof-of-burn/operator-pob.js -p passTest` Leave it running
8. `cd simple-webapp/test && truffle test add-blocks.js`
9. `cd .. && npm run start` Leave it running