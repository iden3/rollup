## circuits
`circom` zero-knowledge circuits

## contracts
smart contracts:
- Rollup.sol: main `rollup` functionalities
- StakeManager.sol: implements proof of stake to select operator to forge a `rollup` batch

## rollup-cli
light client to interact with `rollup`. It includes:
- manage ethereum keys
- manage babyjub keys
- send off-chain transactions
- send on-chain transactions
- get generic information

## rollup-operator
daemon to be a `rollup` staker. It involves:
- synchronizer
- pool off-chain tranasactions
- block forger
  - block builder
  - stake manager