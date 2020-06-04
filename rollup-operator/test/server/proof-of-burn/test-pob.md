# Run server operator test
Commands are called from repository `rollup` root directory

Start local ethereum blockchain
  - `ganache-cli -a 100 --defaultBalanceEther 10000`

Deploy contracts and build configuration files
  - Memory database 
    `npx truffle test ./rollup-operator/test/server/proof-of-burn/build-configs-memDb-pob.test.js`
  - LevelDb database
    `npx truffle test ./rollup-operator/test/server/proof-of-burn/build-configs-levelDb-pob.test.js`

Open new terminal and run `server-proof` server
  - `cd ./rollup-operator`
  - `npm run server-proof`

Open new terminal and run `synch-pool-service` server
  - `cd ./rollup-operator`
  - `npm run service-synch-pool`
    - service needs configuration file `config.env` in its path
    - example can be found in `rollup/rollup-operator/test/synch-pool-service/config/config.env-example`
    - *It should be noted that this file should be where the `run-synch-pool.js` is invoked and its name should be `config.env`

Open new terminal and run operator service
  - `cd ./rollup-operator`
  - `npm run test:operator-pob`
    - password could be typed on console or by adding an environment variable:
      - `PASSWORD=passTest`
    - operator needs configuration file `config.env` in its path
    - example can be found in `rollup/rollup-operator/test/config/config-example.env`
    - *It should be noted that this file should be where the `operator.js` is invoked and its name should be `config.env` 

Run test 
  - `npx truffle test ./rollup-operator/test/server/proof-of-burn/operator-server-pob.test.js`
