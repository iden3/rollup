# zkRollup <img style="float: right;" src="https://i.imgur.com/dGCTo2B.png" width="100">

## Table of Contents
1. [QuickStart](#1)
2. [Usage](#2)
3. [API Operator](#3)

## Quickstart <a id="1"></a>

This section aims to show basic information regarding rollup-client commands. For further information, please go to the `Usage` section.

### Install the rollup cli
From the command line, type the following commands:
```bash=
git clone https://github.com/iden3/rollup.git
git checkout testnet
cd rollup
npm i
cd rollup-cli
npm i
```

### Create a config file
Next, create a file named `config.json`  in the current directory with the following content:
```json=
{
    "urlOperator": "https://zkrollup.iden3.net",
    "nodeEth": "https://goerli.infura.io/v3/<your infura Token>",
    "addressRollup": "0xE0C17C3a4f06b859124Df351Ca83864e6de46AB2s",
    "abiRollupPath": "./RollupAbi.json",
    "controllerAddress": 0,
    "abiTokensPath": "./ERC20Abi.json",
    "addressTokens": "0xaFF4481D10270F50f203E0763e2597776068CBc5",
    "wallet": "./wallet.json"
}
```

Make sure **you insert your own infura token in the `nodeEth` parameter** above.

### Create a wallet and print keys
From the command line, type the following commands.

```bash=
# Create Wallet
node cli.js createkeys --keytype rollup 
# Print keys
node cli.js printkeys --keytype rollup 
```

Before we interact with the rollup contract, you'll need to make sure you have some ether stored in the ethereum address you printed in the above command. The best way to do this is by using the [goerli faucet](https://goerli-faucet.slock.it/).

### Interact with rollup
Some of the commands we'll use below are on-chain transactions (`onchaintx`), which means they send actual ethereum transactions.

A command following an `onchaintx` can only be executed once the on-chain transaction has been processed on the ethereum chain and forged on the rollup side chain. **This may take a couple of minutes.** So please don't send all the transactions in one go.

Others are off-chain transactions (`offchainTx`). These are not immediate either, since they also need to be forged: **this can take anywhere between 30 seconds and one minute**.

From the command line, type the following commands (**remembering to type them in one by one**):

```bash=
# Approve tokens
node cli.js onchaintx --type approve --p foo --amount <amount> 
# Do a deposit
node cli.js onchaintx --type deposit  --loadamount <amount> --tokenid 0 
# Check your current IDs, probably have to wait about two minutes 
# Since the deposit was sent
node cli.js info --type accounts --filter ethereum
# Do rollup transactions
node cli.js offchaintx --type send --sender <sender ID> --recipient <recipient ID> --amount <amount> --fee <fee>  --tokenid 0 
# Transfer tokens to the Exit Tree, where can be withdrawed from the 
# Smart Contract. 
# The transactions should be reflected in 30 seg ~ 1 min
node cli.js offchaintx --type withdrawoffchain --sender <sender ID> --amount <amount> --fee <fee>  --tokenid 0 
# Check leaf exit tree information. 
node cli.js info --type exits --id <ID leaf> 
# Withdraw your tokens from the rollup to your ethereum address, it's
# necessary the numExitRoot from the last command.
node cli.js onchaintx --type withdraw --id <ID leaf> --numexitbatch <numexitbatch>  
```
For more information on what each individual command does, follow our main tutorial [from here](https://github.com/iden3/rollup/tree/testnet/rollup-cli).
 
 -----
 -----
 
## Usage <a id="2"></a>

### Commands
- `createkeys`: To create new wallet for rollup client
- `setparam`: To set parameters in a config file
- `onchaintx`: To make ON chain transactions
- `offchaintx`: To make OFF chain transactions
- `printkeys`: To print public keys on console
- `info`: To print info about accounts or exits

#### Options
- keytype `[-k | --keytype] [Ethereum | Babyjub | Rollup]`
- mnemonic `[-m | --mnemonic] <mnemonic 12 words>`
- import `[-i | --import] <path wallet to import>`
- walletpath `[-w | --walletpath] <path to save wallet>`
- configpath `[-c | --configpath] <path config file>`
- param & value `[--pm | --param] <parameter> [-v | --value] <value to parameter>`
- type `[-t | --type] [ deposit | depositontop | transfer | depositandtransfer | withdraw | forcewithdraw | send]`
- amount `[-a | --amount] <amount>`
- loadamount `[-l | --loadamount] <loadamount>`
- token id `--tokenid <token id>`
- fee `[-e | --fee] <user fee>`
- sender `[-s | --sender] <sender ID>`
- recipient `[-r | --recipient] <recipient ID>`
- params file `--configpath <path json to config params>`
- num exit batch `[-n | --numexitbatch] <num>`
- nonce `[--no | --nonce] <nonce>`
- ethereum address for deposit `--controllerAddress <address>`
- accounts information filter `--filter [babyjubjub | ethereum]`
- gasLimit `[--gl | --gaslimit] <gas limit>`
- gasMultiplier `[--gm | --gasmultiplier] <gas multiplier>`
- ID `--id <ID>`

### Create Keys
Create a random wallet in current path:

```bash=
node cli.js createkeys --keytype rollup
```

or specify a path:

```bash=
node cli.js createkeys --keytype rollup --walletpath wallet_test.json
```

#### or also import your wallet
`--mnemonic <mnemonic,12 words>`

### Set Parameters
Create a configuration file by setting each parameter one by one with the following commands, for example:

```bash=
node cli.js setparam --param <parameter> --value <value>
```

By default `./config.json` will be created/edited, also another file can be specified.

```bash=
node cli.js setparam --param <parameter> --value <value> --configpath <path>
```

The configuration file must contain the following fields:

```json=
{
    "urlOperator": "https://zkrollup.iden3.net",
    "nodeEth": "https://goerli.infura.io/v3/<your infura Token>",
    "addressRollup": "0xE0C17C3a4f06b859124Df351Ca83864e6de46AB2s",
    "abiRollupPath": "./RollupAbi.json",
    "controllerAddress": 0,
    "abiTokensPath": "./ERC20Abi.json",
    "addressTokens": "0xaFF4481D10270F50f203E0763e2597776068CBc5",
    "wallet": "./wallet.json"
}
 ```


### Print Keys
Print the keys of the wallet with the `printkeys` command. If the wallet path is defined in the default configuration file, you may also use the following command:

```bash=
node cli.js printkeys --keytype rollup
```

If it is in another configuration file:

```bash=
node cli.js printkeys --keytype rollup --configpath <configpath>
```

In order to print the keys of another wallet, add the path of that wallet:

```bash=
node cli.js printkeys --keytype rollup -w <wallet path>
```

### Approve
The default `tokenAddress` in `config-example.json` is an ERC20 token contract for testing and is itself a token faucet. If this address is specified, the approve function will get the ERC20 tokens and approve them to the Rollup address.

```bash=
node cli.js onchaintx --type approve --amount <amount>
```

If another address is specified, it's up to the user to earn the tokens herself and add it to the Rollup contract.

### On chain Transactions

#### Deposit
At least the following parameters are needed:

```bash=
node cli.js onchaintx --type deposit --loadamount <loadamount> --tokenid <token ID>
```

Another path can be specified:

`--configpath <configpath>`

The `gasMultiplier` and the `gasLimit` can be set with:

`--gaslimit <gaslimit> --gasmultiplier <gasmultiplier>`

#### Deposit On Top
You'll need the following parameters:

```bash=
node cli.js onchaintx --type depositontop --recipient <recipient ID> --loadamount <loadamount> --tokenid <token ID>
```

You can specify another path using:
`--configpath <configpath>`

The `gasMultiplier` and the `gasLimit` can be set with:

`--gaslimit <gaslimit> --gasmultiplier <gasmultiplier>`

#### Withdraw
To withdraw you must follow the following steps:

1. Send to id 0 (`withdrawOffchain`)
2. Use the command `node cli.js info --type exits --id <ID>` in order to get the batch number which the withdrawOffchain was forged (also called numExitRoot).
3. Withdraw onchain with this information. You'll need the following parameters are needed:

```bash=
node cli.js onchaintx --type withdraw --id <leaf ID> --numexitbatch <numexitbatch>
```

To specify another path, use:

`--configpath <configpath>`

The `gasMultiplier` and the `gasLimit` can be set with:

`--gaslimit <gaslimit> --gasmultiplier <gasmultiplier>`

### OffChain Transactions

#### Send
You'll need the following parameters:

```bash=
node cli.js offchaintx --type send --sender <sender ID> --recipient <recipient ID> --amount <amount> --fee <user Fee> --tokenid <token ID>
```

To specify another path, use:
`--configpath <configpath>`

The Nonce can be hardcoded with:
`--nonce <nonce>`

The minimum fee is 1 token.

#### Withdraw offchain
You'll need the following parameters:

```bash=
node cli.js offchaintx --type withdrawOffchain --sender <sender ID> --amount <amount> --fee <user Fee> --tokenid <token ID>
```

To specify another path, use:
`--configpath <configpath>`

The Nonce can be hardcoded with:
`--nonce <nonce>`

The minimum fee is 1 token.

### Get Information

#### Get accounts babyjub:
```bash=
node cli.js info --type accounts --filter babyjubjub
```

#### Get accounts ethereum:
```bash=
node cli.js info --type accounts --filter ethereum
```

#### Exits by ID
Get the batch number of the exit in order to be able to withdraw your tokens.

```bash=
node cli.js info --type exits --id <ID>
```

### API operator <a id="3"></a>

#### Url Operator: https://zkrollup.iden3.net

#### Get Operators
To get registered operators: https://zkrollup.iden3.net/operators

#### Get Account By Idx
To get information from an ID: https://zkrollup.iden3.net/accounts/{id}

#### Get Accounts
To obtain accounts information:

By ethereum address:
https://zkrollup.iden3.net/accounts?ethAddr={ethereumAddress}

By babyjubjub address
https://zkrollup.iden3.net/accounts?ax={AxBabyjubjub}&ay={AyBabyjubjub}

#### Get Exits
To get the num exits batch by ID:
https://zkrollup.iden3.net/exits/{id}

#### Get Exit Information
To get information from a numexitbatch:
https://zkrollup.iden3.net/accounts/{id}/{numBatch}