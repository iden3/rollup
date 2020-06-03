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

### Create
- Creates folder and store circuit for `nTx` and `levels`:
  - folder: `rollup-nTx-levels`
  - circuit: `circuit-nTx-levels`

Example command: 
`node build-circuit.js create 16 24`

### Compile
- Compiles rollup circuit and store it into above folder:
  - `circuit-nTx-levels.r1cs`: circuit compiled
  - `circuit-nTx-levels.cpp`: calculate witness cpp

Example command: 
`node build-circuit.js compile 16 24`

### Setup
- Perform local setup to retrieve proving key and verification key:
  - `pk-nTx-levels.bin`
  - `vk-nTx-levels.json`

Example command:
`node build-circuit.js setup 16 24`

### Inputs
- Creates and stores an empty input for a circuit

Example command:
`node build-circuit.js input 16 24`

### Witness
- Compiles C witness program and creates an example witness given the inputs generated with `input command`
  - `circuit-nTx-levels`: executable to compute witness
  - `witness-nTx-levels.bin`: witness in binary format

## Config
- `config.json` file is loaded to load some configuration variables:
*only used on `setup` command
```
{
  "pathSrc":"/home/source",
  "pathCir":"/home/cir",
  "pathCircom":"/home/circom",
  "list": "0"
}
```