# Glossary
Describe most used words and its meaning regarding Rollup environment

## Vocabulary
`rollup`: a method of aggregating multiple signatures and/or Merkle tree updates inside a SNARK

`operator`: a party who aggregates many signatures into a single SNARK proof

`circuit`: the code that defines what the SNARK allows

`account tree`: the Merkle tree that stores a mapping between accounts and balances

`account tree depth (24)`: the number of layers in the balance tree

`exit tree`: The tree if the exit balances of a given batch

`block`: Ethereum block

`batch`: state transition of the balance tree ( a collection of off-chain rollup transactions forged on-chain. It can be viewed as an off-chain block )

`forge batch`: operator action to commit a new batch on-chain

`proof`: a single SNARK proof of a state transition which proves a batch

`(Ax, Ay)`: public key babyJubJub

`Rollup address`: compressed public key babyjubjub

`ethereum address`: Allowed address to perform on-chain transaction

## On-chain transactions

- `deposit`: Insert new leaf into the rollup account tree

- `transferOnTop`: increase balance for a given rollup account

- `withdraw`: Action required to withdraw balance. It requires two steps: 
  - 1 - Off-chain transaction
  - 2 - On-chain transaction: requires merkle tree proof to make the withdraw

- `forceWithdraw`: Force exit from rollup account tree. All the amount will be refunded.

## Off-chain transactions

- `transaction`: Standard off-chain trasaction signed by `(Ax,Ay)` with `ecdsa` signature. Allows to send `amount` to a `recipient` rollup account.

- `withdraw`: Action required to withdraw balance. It requires two steps: 
  - 1 - Off-chain transaction: Off-chain: send `amount` to withdraw to `(Ax,Ay)` = 0
  - 2 - On-chain transaction

## Data availability
Data bases:
- `Account Tree`: Spare merkle tree where final node is as follows:
  - Key = IdBalanceTree
  - Value = H(balance, token, Ax, Ay, ethereumAddress, nonce)

- It is assumed that we can retrieve:
  - last state of a rollup account through `operator`
  - merkle tree proof to verify data received with current state (on-chain last balance tree state root)

# PoS
## Operator selector
Each block is an etherum block which is every 15 seconds. We then have an era which is 20 slots and a slot has 100 blocks. That means that an Era lasts 8.3 hours. Each slot has a single operator. 

At the begining of each era there is a raffle that assigns one operator to each slot for the upcoming era. This raffle is weighted by the effective stake. The effective stake is function of the ETH staked by each operator stakes in the system.

effectiveStake = ethStaked^(1.2)

The 1.2 exponent is because we need to incentivate concentrated operators with high stake. We don't want any operator have many virtual operators with low stake each. In that case, the operator would have the same odds to get selected but would risk much less. We also define the minimum stake as 10 ETH.

For the operators to start batching they need to first stake the ETH and wait for a full era to complete. So if we are in era 3, they will not start being included in the raffle until the begining of the era 5.

The same happen for stop batching.  Once the operator notifies an exit it will not be removed form the raffle until a full era is finished.  So if you are leaving during era 9, you will have to continue batching during the eras 9 and 10. In era 11, the operator will not be included again.

Assigned Operators have the obligation to generate at least one batch during each assigned block.  If an operator fails to do that, all his stake will be burned except for a 10% that go to who calls the `burn` function.

For doing the raffle we construct a special tree data structure where adding, removing and checking the winner functions are O(log(n))

## How the random works.

An operator, before registering for staking, will calculate h(0), h(1), h(2) to h(10000) where h0 is random and h(i) = h(h(i-1)). During the registration process, he sends h(10000)

There is a `seed` state variable that is updated the first time a batch is generated for a given operator in a slot. The operator must reveal h(i-1) and its hash must match with the last published commit h(i).

The seed state variable is updated seed = h(seed || h(i-1))

For the raffle, we use a snapshot of this seed at he begining of the era to calculate a random number for each slot.

rnd = h(seed || slot)

We use this rnd to navegate with the tree structure to find the assigned operator for that slot.

## The tree

The tree is composed of intermediate nodes and leafs.  Each staker is in a leaf. Each intermediate nodes has two values:
1.- A threshold.
2.- An increment.

To do th raffle, you start from the top wit a random number.  if rnd < threshold then continue by the left. I rnd >= threshold, add the increment value to the rand and continue to the right.

Do it until you arrive to a leaf that is the actual selected operator.

This tree has the advantage is that is not rebalanced and is well compensated.
The operations of adding an operator, removing it and calculating the raffle are all O(log(n)) where n is the total numbers of operators inserted in the whole history.

