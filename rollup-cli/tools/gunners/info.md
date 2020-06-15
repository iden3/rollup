# Gunners

Automatic creation of deposits and off-chain transactions in order to stress the operator and get performance measures.

# Config files:

In order to use it are needed 2 config files

- `params.json` with the following content: 
    * `rollupAddress` : addres of the rollup smart contract
    * `abiRollup`: abi of the rollup
    * `abiTokens`: abi of ERC20 token
    * `mnenonic` : mnemonic wich the wallets will be created
- `wallet.json` A rollup wallet, an easy way to create one is using the CLI.

Change the  `Argument variables` at the start of both files before and just execute them with node.


