# Run server test
Commands are called from `rollup` root directory

- Start local ethereum blockchain

`ganache-cli`

- Deploy contracts and build configuration files

`truffle test ./rollup-operator/test/server/buildConfigs.test.js`

- Run operator server

`node ./rollup-operator/src/server/operator.js`

- Run test

`truffle test ./rollup-operator/test/server/synch-server.test.js`