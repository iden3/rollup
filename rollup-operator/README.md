# Rollup operator

## Table of contents

1. [Description](#1)
2. [Schematic](#2)
3. [Configuration](#3)<br>
  3.1 [Environment variables](#3.1)<br>
  3.2 [Synchronizer](#3.2)<br>
  3.3 [Pool](#3.3)

## 1. Description <a id="1"></a>

This software acts as a rollup node to maintain rollup balance tree and allows the operator to register and forge batches. Hence, this node has two main purposes:
- synchronize rollup database tree state
- allow operator to forge batches

## 2. Schematic <a id="2"></a>
![](https://i.imgur.com/tQnczrd.png)

## 3. Configuration <a id="3"></a>

First layer configuration file: 
- `config.env`

Second layer configuration files:
- configuration synchronizer
  - balance tree
  - proof-of-stake
- configuration pool

### 3.1 Environment variables <a id="3.1"></a>
`congig.env` is loaded from directory where `operator.js` is executed. Fields are the following:

- `CONFIG_SYNCH`: Absolute path to `.json` file which defines configuration for synchronizer rollup and proof-of-stake
- `CONFIG_POOL`: Absolute path to `.json` file which defines pool configuration
- `OPERATOR_PORT_ADMIN`: port to expose admin-api (private)
- `OPERATOR_PORT_EXTERNAL`: port to expose external-api (public)
- `URL_SERVER_PROOF`: url for proof-server generator
- `LOG_LEVEL`: defines level for console logger. Levels are sort ascending from most important to least important (levels less importants includes above levels)
  - error
  - info
  - debug
- `OPERATOR_MODE`: defines which data is stored
  - light: full account balance tree
  - full: full account balance tree and exits account information
  - archive: full account balance tree, exits account information and all transactions per batch

See this [example](https://github.com/iden3/rollup/blob/master/rollup-operator/test/config/config.env-example) of `config.env` file

### 3.2 Synchronizer <a id="3.2"></a>
This file is in `.json` format. Parameters are described below:
- `rollup`: information of Rollup.sol smart contract
  - `synchDb`: path to rollup synchronizer database
  - `treeDb`: path to rollup state tree database
  - `address`: smart contract address
  - `abi`: smart contract abi interface
  - `creationHash`: smart contract creation hash
- `rollupPoS`: information of RollupPoS.sol smart contract
  - `synchDb`: path to rollup PoS synchronizer
  - `address`: smart contract address
  - `abi`: smart contract abi interface
  - `creationHash`: smart contract creation hash
- `ethNodeUrl`: ethereum node url
- `ethAddressCaller`: ethereum address from smart contract are called

See this [example](https://github.com/iden3/rollup/tree/master/rollup-operator/test/config/synch-config-example.json) of synchronizer config file

### 3.3 Pool <a id="3.3"></a>
This file is in `.json` format. Parameters are described below:

- maxSlots: absolute maximum number of transactions stored in the pool
- executableSlots: maximum number of executable transactions in the pool
- nonExecutableSlots: maximum number of non-executable transactions in tkhe pool
- timeout: miliseconds to keep a transaction on the pool

See this [example](https://github.com/iden3/rollup/blob/master/rollup-operator/test/config/pool-config-example.json) of pool config file
