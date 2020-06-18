# Rollup repository overview

## Core
### circuits
`./circuits`: contains all rollup circuits

### contracts
`./contracts`: all rollup smart contracts
  - `./Rollup.sol`: manages the rollup itself
  - `./RollupPoS.sol`: implements proof-of-stake as a forge batch mechanism
  - `./RollupPoB.sol`: implements proof-of-burn as a forge batch mechanism
  - `./lib`: helper contracts ans functionalities
  - `./test`: contracts for testing purposes
  - `./verifiers`: verifier rollup circuit

## Tooling

### cli-pob
`./cli-pob`: client to interact with proof-of-burn mechanism

### cli-pos
`./cli-pos`: client to interact with proof-of-stake mechanism

### docker
`./docker`: 

### js
`./js`: core rollup pieces implementation

### rollup-cli
`./rollup-cli`: command line client to interact with rollup

### rollup-operator
`./rollup-operator`: rollup node to synchronize and manage forging batches

### rollup-utils
`./rollup-utils`: rollup utils implementation

### tools
`./tools`: scripts helpers

## Documentation
`./doc`: gather rollup documentation

## Test
`.test`:
  - `./circuit`: test circuits
  - `./contracts`: test contracts
  - `./js`: test core rollup implementation
  - `./performance`: scripts to get performance data
  - `./rollup-utils`: test utils code implementation