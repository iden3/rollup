# Operator server
The aim of this document is to briefly describe all the entities that form a rollup operator. 
>Further information can be found [here](https://github.com/iden3/rollup/blob/master/rollup-operator/README.md)

Operator server has two main goals:
  - Synchronize rollup state
    - account tree state
    - track PoB information
  - Manager actions
    - check when operator has to forge

## Table of contents

- 1. [API](#1)
- 2. [Coordinator](#2)
- 3. [Transaction pool](#3)
- 4. [Synchronizers](#4)
  - 4.1 [Rollup state](#4.1)
  - 4.2 [Proof-of-burn state](#4.2)
- 5. [Interface proof-of-burn](#5)
- 6. [Client proof-server](#6)


## Api<a id="1"></a>
Api details can be found in:
https://hackmd.io/X5WCYhjHQ-qjFhRQjwBLxQ

## Coordinator<a id="2"></a>
It does all the heavy work by processing the data available by the `synchronizers` and determines in which state the operator server has to be. It also depends on the operator running mode:
- synchronizer mode
- forger mode

If it is started in synchronizer mode, it acts as a `rollup-node` just synchronizing the rollup state and providing its information.

If it is started in forger mode, it acts as an automatically forge batch builder.
Once node is running, the following steps are automatically triggered:
- Track PoB winners and check if it is our turn to forge a batch
- Wait until our turn is reached
- Build batch with current pool transactions
- Send `rollup zk-circuit` inputs to `proof-server`
- Poll `proof-server` to get `proof` once it is calculated
- Setup forge batch ethereum transaction and send it
- Start over again

Please be aware that this would be a very simple version of an `operator-forging` mechanism, just to demonstrate `rollup` functionalities.
It could be heavily customized in order to improve batch forging.

## Transaction pool<a id="3"></a>
It accumulates all the off-chain transactions which has been sent to this operator by `rollup-clients`.
It sorts the transactions and optimize them in order to get the best profit. Once the transactions are selected, they are used to fill a batch asked by the operator.

## Synchronizers<a id="4"></a>
### Rollup state<a id="4.1"></a>
Operator service keeps tracking of `Rollup` and `RollupPoB` to maintain last state of the rollup account tree.
In order to do so, module has to detect:
- which on-chain events has been triggered
- which off-chain data has been commited
- which blocks are forged

State synchronizer also provides key data from the account tree:
  - `getStateFromBatch()`
  - `getLastSynchBlock()`
  - `getLastBatch()`
  - `getBatchInfo(numBatch)`
  - `getStateById(id)`
  - `getStateByAccount(coin, ax, ay)`
  - `getStateByAxAy(ax, ay)`
  - `getStateByEthAddr(ethAddress)`
  - `getExitTreeInfo(numBatch, coin, ax, ay)`
  - `getExitsBatchById(coin, ax, ay)`
  - `getSynchPercentage()`
  - `getBatchBulider()`
  - `getCurrentStateRoot()`
  - `getFeeDepOffChain()`
  - `getFeeOnChainTx()`
  - `getStaticData()`
  - `isSynched()`

### PoB state<a id="4.2"></a>
It maintains a list of all active operators which has been bid into PoB.
The operators list is updated each `slot` according to:
  - `newBestBid` event
and it provides information for `current` slot until `current slot + 9` 

PoB synchronizer provides the following functions to retrieve information:
  - `getLastSynchSlot()`
  - `getCurrentSlot()`
  - `getWinners()`
  - `getOperatorsWinners()`
  - `getCurrentWinners()`
  - `getSlotWinners()`
  - `getCurrentBids()`
  - `getBlockBySlot(numSlot)`
  - `getSlotByBlock(numSlot)`
  - `getCurrentBlock()`
  - `isSynched()`
  - `getSynchPercentage()`
  - `getSlotDeadline()`
  - `getFullFilledSlot()`
  - `getDefaultOperator()`
  - `getMaxTx()`
  - `getMinBid()`
  - `getStaticData()`

## Interface PoB<a id="5"></a>
It acts as an interface between the `RollupPoB` contract and the operator.
It provide support to load an ethereum wallet through an encrypted json file (`ether.js` is used)

The next functionalities are available once the wallet is loaded:
  - `getTxBid(slot, url, bidValue)`
  - `getTxBidWithDifferentBeneficiary(slot, url, bidValue, beneficiaryAddress)`
  - `getTxBidRelay(slot, url, bidValue, beneficiaryAddress, forgerAddress)`
  - `getTxBidRelayAndWithdrawAddress(slot, url, bidValue, beneficiaryAddress, forgerAddress, withdrawAddress)`
  - `getTxBidWithDifferentAddresses(slot, url, bidValue, beneficiaryAddress, forgerAddress, withdrawAddress, bonusAddress, useBonus)`
  - `getTxWithdraw()`
  - `getTxCommitAndForge(compressedTx, proofA, proofB, proofC, input, compressedOnChainTx, value)`
  - `getTxCommitAndForgeDeadline(compressedTx, proofA, proofB, proofC, input, compressedOnChainTx, value)`
        

## Client proof-server<a id="6"></a>
Layer to load `proof-server` url and interact with the server.
It simply does the http calls to the `proof-server`:
  - `getStatus()`
  - `setInput(input)`
  - `cancel()`