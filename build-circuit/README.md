# Build Rollup circuit

Rollup circuit needs two inputs:
- `nTx`: number maximum of transactions accepted by the circuit
- `levels`: balance tree levels ( 2^levels^ accounts would be possible to create )

This tool is intended to be used to:
- `compile`
- `setup`
- `input`

General command line:
`node build-circuit.js "actions" "nT" "levels"`

## Commands

### Compile
- Creates folder for given inputs such as: `rollup-nTx-levels`
- Compiles rollup circuit and store it into above folder:
  - `circuit-nTx-levels.circom`: circom circuit description
  - `circuit-nTx-levels.json`: circuit compiled

Example command: 
`node --max-old-space-size=4096 build-circuit.js compile 1 8`

### Setup
- Load rollup circuit stored on `rollup-nTx-levels`
- Do setup retrieveing proving key and verification key:
  - `pk-nTx-levels.json`
  - `vk-nTx-levels.json`

Example command:
`node --max-old-space-size=4096 build-circuit.js setup 1 8`

### Inputs
- Creates and stores an empty input for a circuit

Example command:
`node build-circuit.js input 1 8`

## Config
- `config.json` file is loaded to load some configuration variables:
*only used on `setup` command
```
{
  "pathSrc":"/home/source",
  "pathCir":"/home/cir",
  "list": "0"
}
```