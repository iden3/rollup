# Operator server

Operator server has two main goals:
  - Synchronize rollup state
    - balance tree state
    - track PoS information such as operators and raffle winners
  - Manager PoS actions
    - load wallet
    - register stake to PoS
    - unregister stake to PoS
    - withdraw stake

Further information about modules are explained in next sections.
Also, it provides two api:
  - admin: can be called only internally on `localhost`
  - external: should be exposed externally

## Api administrator
- http POST `/loadWallet`
  - load wallet into PoS manager
- http POST `/register/:stake/:url`
  - register operator into PoS
- http POST `/unregister`
  - unregister from PoS
- http POST `/withdraw`
  - withdraw stake
- http POST `/pool/conversion`
  - set pool conversion parameters

## Api external
- http POST `/offchain/send`
  - sends off-chain transaction to operator pool

- http GET `/info/id/:id`
  - get current balance tree state of `id`
  
- http GET `/info/axay/:Ax/:Ay`
  - get current balance tree state of all entries with `Ax:Ay`

- http GET `/info/ethaddress/:ethAddress`
  - get current balance tree state of all entries with `ethAddress`

- http GET `/info/general`
  - get general information about the `operator`

- http GET `/info/operators`
  - get list of avaulable operators

- http GET `/state`
  - get full state of rollup database

# Modules in detail
## Operator Manager
It does all the heavy work by processing the data available by the `synchronizers` and determines in which state the operator server has to be. It also depends on the operator running mode:
- operator unregister
- operator register

If no operator is registered, it acts as a `rollup-node` just synchronizing the rollup state and provding its information.

If an operator is registered, it acts as an automatically forge builder.
Once the operator is registered, the following steps are automatically triggered:
- Get operator register event and get its `opId`
- Track PoS winners and check if it is our turn to forge a batch
- Wait until our turn is reached
- Build batch with current pool transactions
- Send `rollup zk-circuit` inputs to `proof-server`
- Poll `proof-server` to get `proof` once it is calculated
- Start again


Please be aware that this would be a very simple version of an `operator-forging` mechanism, just to demonstrate `rollup` functionalities. It could be heavily customized in order to improve batch forging.

## Tx-pool
It accumulates all the off-chain transactions which has been sent to this operator by `rollup-clients`.
It sorts the transactions and sets the operator fee to maximize operator winnings when the `operaror-manager` ask to fill the batch with off-chain transactions

## Synchronizers
### Balance tree state
Operator service keeps tracking of `Rollup` and `RollupPoS` to maintain last state of the
rollup balance tree.
In order to do so, module has to detect:
- which on-Chain events has been triggered
- which off-Chain data has been commited
- which blocks are forged

State synchronizer also provides key data from the balance tree:
  - getLastSynchBlock()
  - getLastBatch()
  - getState()
  - getStateById(id)
  - getStateByAxAy(ax, ay)
  - getStateByEthAddr(ethAddress)
  - getSynchPercentage()
  - getBatchBulider()
  - getOffChainTxByBatch(numBatch)
  - isSynched

### PoS state
It maintains a list of all active operators which has been registered into PoS.
The operators list is updated each `era` according to:
  - create operator event
  - remove operator event
  
Besides, it keeps tracking of PoS winners for current and next `era`

PoS synchronizer provides the following functions to retrieve information:
  - getLastSynchEra()
  - getCurrentSlot()
  - getCurrentEra()
  - getOperators()
  - getOperatorById(opId)
  - getRaffleWinners()
  - getSlotWinners()
  - getBlockBySlot(numSlot)
  - getCurrentBlock()
  - isSynched()

## Interfaces
### PoS Manager
It acts as an interface between the `RollupPoS` contract and the operator.
It provide support to load an ethereum wallet through an encrypted json file (`ether.js` is used)

The next functionalities are available once the wallet is loaded:
  - register(rndHash, stakeValue, url)
  - unregister(opId)
  - withdraw(opId)
  - commit(prevHash, compressedTx)
  - forge(proofA, proofB, proofC, input)
  - commitAndForge(prevHash, compressedTx, proofA, proofB, proofC, input)

### Client proof-server
Layer to load `proof-server` url and interact with the server.
It simply does the http calls to the `proof-server`:
  - getStatus()
  - setInput(input)
  - cancel()