# Glossary
Describe most used words and its meaning regarding Rollup environment

## Vocabulary
`rollup`: a method of aggregating multiple signatures and/or Merkle tree updates inside a SNARK
`operator`: a party who aggregates many signatures into a single SNARK proof
`circuit`: the code that defines what the SNARK allows
`balance tree`: the Merkle tree that stores a mapping between accounts and balances
`balance tree depth (24)`: the number of layers in the balance tree
`block`: Ethereum block
`batch`: state transition of the balance tree ( a collection of off-chain rollup transactions forged on-chain. It can be viewed as an off-chain block )
`forge batch`: operator action to commit a new batch on-chain
`proof`: a single SNARK proof of a state transition which proves a batch
`(Ax, Ay)`: public key babyJub
`withdraw address`: Allowed address to perform `withdraw` on-chain transaction

## On-chain transactions

- `deposit`: Insert new leaf into the balance tree wit the following parameters: `Key = IdBalanceTree`, `Value = Hash(balance, coin, Ax, Ay, withdrawAddress, nonce)`. This action will allow to do an off-chain transaction.

- `transferOnTop`: increase balance of a given `IdBalanceTree`

- `withdraw`: Action required to withdraw balance. It requires two steps: 1 - Off-chain transaction, 2 - On-chain transaction
  - On-chain: requires merkle tree proof to make the withdraw

- `forceWithdrawFull`: Force exit to balance tree. All the amount will be refunded.

## Off-chain transactions

- `transaction`: Standard off-chain trasaction signed by `idBalanceTree` with `ecdsa`. Allows to send - `amount` to a `destinity` balance tree id.

- `withdraw`: Action required to withdraw balance. It requires two steps: 1 - Off-chain transaction, 2 - On-chain transaction
  - Off-chain: send `amount` to withdraw to `idBalanceTree` = 0

