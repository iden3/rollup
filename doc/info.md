# Glossary
Describe most used words and its meaning regarding Rollup environment

## Vocabulary
`rollup`: a method of aggregating multiple signatures and/or Merkle tree updates inside a SNARK
`operator`: a party who aggregates many signatures into a single SNARK proof
`circuit`: the code that defines what the SNARK allows
`balance tree`: the Merkle tree that stores a mapping between accounts and balances
`balance tree depth (24)`: the number of layers in the balance tree
`exit tree`: The tree if the exit balances of a given batch.
`block`: Ethereum block
`batch`: state transition of the balance tree ( a collection of off-chain rollup transactions forged on-chain. It can be viewed as an off-chain block )
`forge batch`: operator action to commit a new batch on-chain
`proof`: a single SNARK proof of a state transition which proves a batch
`(Ax, Ay)`: public key babyJub
`withdraw address`: Allowed address to perform `withdraw` on-chain transaction

## On-chain transactions

- `deposit`: Insert new leaf into the balance tree wit the following parameters: `Key = IdBalanceTree`, `Value = Hash(balance, token, Ax, Ay, withdrawAddress, nonce)`. This action will allow to do an off-chain transaction.

- `transferOnTop`: increase balance of a given `IdBalanceTree`

- `withdraw`: Action required to withdraw balance. It requires two steps: 1 - Off-chain transaction, 2 - On-chain transaction
  - On-chain: requires merkle tree proof to make the withdraw

- `forceWithdrawFull`: Force exit to balance tree. All the amount will be refunded.

## Off-chain transactions

- `transaction`: Standard off-chain trasaction signed by `idBalanceTree` with `ecdsa`. Allows to send - `amount` to a `destinity` balance tree id.

- `withdraw`: Action required to withdraw balance. It requires two steps: 1 - Off-chain transaction, 2 - On-chain transaction
  - Off-chain: send `amount` to withdraw to `idBalanceTree` = 0

## Data availability
Data bases:
- `Balance Tree`: Spare merkle tree where final node is as follows:
  - Key = IdBalanceTree
  - Value = H(balance, token, Ax, Ay, withdrawAddress, nonce)
- `Balance Leafs`: Last sparse merkle tree step to retrieve Leaf given an `IdBalanceTree`
  - Key = H(balance, token, Ax, Ay, withdrawAddress, nonce)
  - Value = [balance, token, Ax, Ay, withdrawAddress, nonce]

- It is assumed that we can retrieve:
  - last state of `IdBalanceTree` through `operator`
  - merkle tree proof to verify data received with current state (on-chain last balance tree state root)

## Operator selector.

We divide the blocks of the blockchain in slots and eras.  An era has 20 slots and a slot has 100 blocks.

The way it works is that at the begining of each era there is a raffle that assigns one operator to each slot for the upcoming era. This is raffle is ponderated by the effective stake. The efective stake is function of the stake each operator stakes in the system.

efectiveStake = realState^(1.2)

The 1.2 exponent is because we need incentivate concentrated operators with high state. We don't want than an operator have many virtual operators with low stake each.

Rules, The operators, to stat batching they need to stake the ETH and wait for a full era to complete. So if we are in era 3, they will not start being included in the riffle until the begining of the era 5.

The same happen for stop batching.  You notify it now and the operator will be removed form the riffle aster the finish of a full era.  So if you are leaveng at block 9, you will have to continue batching during era 9 and 10.

Assigned Operators have the obligation to generate at least one batch during each assigned bloc.  If an operator misses to do that, all his stake will be burned except for a 10% that goues to who notifies it.

For the doing the riffle we construct a tree where adding, removing and checking the winner functions are O(log(n))

## How the random works.

An operator, before registering for staking will calculate h(0), h(1), h(2) to h(10000) where h0 is handom and h(i) = h(h(i-1)). During the registration process, he sends h(10000)

There is a `seed` state variable that is updated the first time a batch is generated for a given operator in a slot. The operator must reveal h(i-1) and it's hash must match with the last publishe commitment h(i).

The seed state variable is updated seed = h(seed || h(i-1))

For the rufle, we use a snapshot of this seed at he begining of the era to calculate a rnd for each slot.

rnd = h(seed || slot)

We use this rnd to navegate with the tree structure to find the assigned operator for that slot.

