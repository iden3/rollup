# Build Rollup circuit

Rollup circuit needs two inputs:
- `nTx`: number maximum of transactions accepted by the circuit
- `levels`: balance tree levels ( 2**levels accounts would be possible to create )

This tool is intended to be used to:
- `compile`
- `setup`

General command line:
`node build-circuit.js "actions" "nT" "levels"`

## Commands

### Compile
- Creates folder for given inputs such as: `rollup-nTx-levels`
- Compiles rollup circuit and store it into above folder:
  - `rollup-nTx-levels.circom`: circom circuit description
  - `rollup-nTx-levels.json`: circuit compiled

Example command: 
`node --max-old-space-size=4096 build-circuit.js compile 1 4`

### Setup
- Load rollup circuit stored on `rollup-nTx-levels`
- Do setup retrieveing proving key and verification key:
  - `pk-nTx-levels`
  - `vk-nTx-levels`

Example command:
`node --max-old-space-size=4096 build-circuit.js setup 1 4`