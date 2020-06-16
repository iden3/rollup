# Rollup operator

## Table of contents

1. [Schematic](#1)
2. [Description](#2)
  2.1 [Synchronizer](#2.1)<br>
  2.2 [Operator manager](#2.2)<br>
3. [Configuration](#3)<br>
  3.1 [Command line options](#3.1)<br>
  3.2 [Config variables](#3.2)<br>
  3.3 [Synchronizer](#3.3)<br>
  3.4 [Pool](#3.4)

## 1. Schematic <a id="1"></a>
![](https://i.imgur.com/eweiSqr.png)

## 2. Description <a id="2"></a>

This software acts as a rollup node to synchronize and mantain rollup account tree. Also, allows the operator to forge batches. 
Hence, this node has two operating modes:
- `SYNCHRONYZER`
- `FORGER`

## 2.1 Synchronizer <a id="2.1"></a>
Synchronizer manages all the data coming from the blockchain.
Its main purpose is to monitor continously the `Rollup.sol` and `RollupPoB.sol` contracts in order to keep database updated to the very last state.

![](https://i.imgur.com/XIKKUDj.png)

Basic working flow is commented below an it is separated in two modules: `ROLLUP` and `PROOF-OF-BURN`

`ROLLUP`:
  - Check blockchain state: batch depth, account tree root and minning on-chain hash
  - If blockchain batch depth is greater than last batch depth saved
    - Get forge batch data: 
      - forge batch transaction
      - on-chain events
      - off-chain transaction data availability
      - deposit off-chain transaction data availability
    - Save forge batch data into database
    - Updates account rollup tree
  - Otherwise, continuous polling until new depth state is found on blockchain 

`PROOF-OF-BURN`:
  - Check blockhain state: slot numbers and operator winners information
  - When there is a transition between slots:
    - get new slot numbers
    - get all bids events
    - update deterministic operator winners (`current slot` and `currrent slot +1`)
    - update non-deterministic operator winners (`current slot + 2` and `currrent slot + 9`) 

## 2.2 Operator manager <a id="2.2"></a>
![](https://i.imgur.com/U5sf4is.png)


Standard work flow is as follows :
  - Check databases are fully synchronized by polling the synchronizer modules
  - Check if operator wallet loaded is the current winner
    - operator is the winner: wait for the beginning block where the operator has the rights to forge
    - operator is not the winner: wait for the deadline blocks where I can forge if the winner has not forge any batch
  - When time to forge comes, check again if databases are fully synch
  - Build batch to forge by requesting transaction to the pool module
  - Send zk-snark inputs to server-proof module in order to request the zk-proof
  - Get zk-proof and send forge transaction to contract
  - Monitor transaction to check if succeeds
  - Go to synchronize state

## 3. Configuration <a id="3"></a>

First level configuration file: 
- operator top level features 

Second level configuration files:
- synchronizers
- transaction pool

### 3.1 Command line options <a id="3.1"></a>
Operator software is started from command line:
```
operator <options>

options
=======
    operator <options>

    --clear or -c [true | false]
        Erase persistent databases
        Default: false

    --pathconfig or --pc <path>
        Path to configuration environment file
        Default: ./config.env

    --onlysynch [true | false]
        Start operator in synch mode
        Default: false


Options:
  --help     Show help                             
  --version  Show version number
```

All parameters will be configured in the `configuration file` and they are shown in the next section. 

### 3.2 Config variables <a id="3.2"></a>
Password could be configured as a configuration parameter. Otherwise, software would ask you to enter your wallet password:
  - `PASSWORD`: passphrasse to decryot wallet

Mandatory fields:
  - `CONFIG_SYNCH`: path of synchronizer configuration file
  - `CONFIG_POOL`: path of synchronizer pool file
  - `OPERATOR_PORT_EXTERNAL`: port to expose operator external API
  - `URL_SERVER_PROOF`: server proof url

Optional fields [`default option`]:
  - `LOG_LEVEL`[`info`]: defines level for console logger. Levels are sort ascending from most important to least important (levels less importants includes above levels)
    - `error`
    - `info`
    - `debug`
 - `EXPOSE_API_SERVER`[`true`]: expose api public data 
 - `OPERATOR_MODE`[`archive`]: defines which data is stored (only archive mode supported)
   - `light`: full account rollup tree
   - `full`: full account rollup tree and exits account information
   - `archive`: full account rollup tree, exits account information and all transactions per batch
  - `GAS_MULTIPLIER`[`1`]: multiplier average gas price when sending a transaction
  - `GAS LIMIT`[`default`]: set gas limit when sending a transaction or `estimateGas` functionality will be used by default
  - `LAN`[`false`]: expose operator port on Lan ip address
  - `POLLING_TIMEOUT`[`60`]: Maximum time to consider that a transaction has not been mined on ethereum blockchain. Transaction is re-send with higher gas price if this timeout is reached

See this [example](https://github.com/iden3/rollup/blob/master/rollup-operator/test/config/config.env-example) of `config.env` file

### 3.3 Synchronizer <a id="3.3"></a>
This file is in `.json` format. Parameters are described below:
- `rollup`: configuration rollup synchronizer
  - `synchDb`: path to rollup synchronizer database
  - `treeDb`: path to rollup account tree database
  - `address`: smart contract address
  - `abi`: smart contract abi interface
  - `creationHash`: smart contract creation hash
  - `timeouts`: defines synchronizer timeouts. Described below.
- `rollupPoB`: configuration proof-of-burn synchronizer
  - `synchDb`: path to rollup proof-of-burn synchronizer
  - `address`: smart contract address
  - `abi`: smart contract abi interface
  - `creationHash`: smart contract creation hash
  - `timeouts`: defines synchronizer proof-of-burn timeouts. Described below.
- `ethNodeUrl`: ethereum node url
- `ethAddressCaller`: ethereum address to perform views calls

See this [example](https://github.com/iden3/rollup/tree/master/rollup-operator/test/config/synch-config-example.json) of synchronizer config file.

Timeouts descriptions:
  - `ERROR`: time to wait when an error occurs
  - `NEXT_LOOP`: time to wait when a synchronization loop has been done succesfully
  - `LOGGER`: time among logger information prompts

### 3.4 Pool <a id="3.4"></a>
This file is in `.json` format. Parameters are described below [`default value`]:

- `maxSlots`[`64`]: absolute maximum number of transactions stored in the pool
- `maxDeposits`[`18`]: absolute maximum number of deposits off-chains accpeted inside one batch
- `executableSlots`[`16`]: maximum number of transactions in one batch
- `nonExecutableSlots`[`16`]: maximum number of stored transactions that can not be processed now
- `timeout`[`3 * 3600`]: miliseconds to keep a transaction on the pool before remove it
- `pathConversionTable`[`64`]: path to tokens and ethereum prices
- `feeDeposit`[`null`]: deposit off-chain cost in ethereum 
- `ethPrice`[`null`]: dollar price for ethereum

See this [example](https://github.com/iden3/rollup/blob/master/rollup-operator/test/config/pool-config-example.json) of pool config file