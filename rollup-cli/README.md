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
    "addressRollup": "0xbC0fd0Bd2e5B5CC7FE947A829067D207381E03FA",
    "abiRollupPath": "./helpers/abis/RollupAbi.json",
    "controllerAddress": 0,
    "abiTokensPath": "./helpers/abis/ERC20Abi.json",
    "addressTokens": "0xaFF4481D10270F50f203E0763e2597776068CBc5",
    "wallet": "./wallet.json"
}
```

Make sure **you insert your own infura token in the `nodeEth` parameter** above.

### Create a wallet
From the command line, type the following commands.


```bash=
node cli.js createkeys
```

You'll be prompted to enter a password:

```bash=
Password: 
```
You'll need to enter this password every time you interact with your wallet.

### Get ether
```bash=
node cli.js printkeys --configpath config-example.json
```

You should see a message with the following stucture:

```bash=
Ethereum public key:
  Address:
Rollup public key: 
  Compressed:
    Points:
      Ax:
      Ay:
```

Copy your ethereum address and visit the [faucet](https://goerli-faucet.slock.it/) to request test ether.

### Interact with rollup

A command following `onchaintx` will take 2 minutes approx to be forged. 

A command following `offchaintx` will take 30 seg approx to be forged. 

From the command line, type the following commands (**remember wait the corresponding time**):

```bash=
# Approve tokens
# This transaction don't need to be forged in rollup
# Just in ethereum, so just wait until it's mined
node cli.js onchaintx --type approve --amount <amount> 
# Do a deposit
node cli.js onchaintx --type deposit  --loadamount <amount> --tokenid 0 
# Check your current IDs, probably have to wait about two minutes 
# Since the deposit was sent
node cli.js info --type accounts --filter ethereum
# Do rollup transactions
node cli.js offchaintx --type send --recipient <rollup address> --amount <amount> --fee <fee>  --tokenid 0 
# Transfer tokens to the Exit Tree, where can be withdrawed from the 
# Smart Contract. 
node cli.js offchaintx --type withdrawoffchain --amount <amount> --fee <fee>  --tokenid 0 
# Check leaf exit tree information. 
node cli.js info --type exits --tokenid 0 
# Withdraw your tokens from the rollup to your ethereum address, it's
# necessary the numExitRoot from the last command.
node cli.js onchaintx --type withdraw --tokenid 0 --numexitbatch <numexitbatch>  
```


For more especific information, follow our usage [from here](#2), or continue with our tutorial [here]( https://github.com/iden3/rollup)

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
- mnemonic `[-m | --mnemonic] <mnemonic 12 words>`
- walletpath `[-w | --walletpath] <path to save wallet>`
- configpath `[-c | --configpath] <path config file>`
- type `[-t | --type] [ approve | deposit | depositontop | depositoffchain | transfer | depositandtransfer | withdraw | forcewithdraw | send | accounts | exits]`
- amount `[-a | --amount] <amount>`
- loadamount `[-l | --loadamount] <loadamount>`
- token id `[--tk --tokenid] <token id>`
- fee `[-e | --fee] <user fee>`
- recipient `[-r | --recipient] <recipient ID>`
- params file `--configpath <path json to config params>`
- num exit batch `[-n | --numexitbatch] <num>`
- nonce `[--no | --nonce] <nonce>`
- accounts information filter `--filter [babyjubjub | ethereum | tokenid]`
- gasLimit `[--gl | --gaslimit] <gas limit>`
- gasMultiplier `[--gm | --gasmultiplier] <gas multiplier>`

### Create Keys
Create a random wallet in current path:

```bash=
node cli.js createkeys
```

or specify a path:

```bash=
node cli.js createkeys --walletpath wallet_test.json
```

#### or also import your wallet

```bash=
node cli.js createkeys --mnemonic <mnemonic,12 words>
```


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
    "addressRollup": "0xbC0fd0Bd2e5B5CC7FE947A829067D207381E03FA",
    "abiRollupPath": "./helpers/abis/RollupAbi.json",
    "controllerAddress": 0,
    "abiTokensPath": "./helpers/abis/ERC20Abi.json",
    "addressTokens": "0xaFF4481D10270F50f203E0763e2597776068CBc5",
    "wallet": "./wallet.json"
}
 ```


### Print Keys
Print the keys of the wallet with the `printkeys` command. If the wallet path is defined in the default configuration file, you may also use the following command:

```bash=
node cli.js printkeys
```

If it is in another configuration file:

```bash=
node cli.js printkeys --configpath <configpath>
```

In order to print the keys of another wallet, add the path of that wallet:

```bash=
node cli.js printkeys -w <wallet path>
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
node cli.js onchaintx --type depositontop --recipient <rollup address> --loadamount <loadamount> --tokenid <token ID>
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
node cli.js onchaintx --type withdraw --tokenid <token ID> --numexitbatch <numexitbatch>
```

To specify another path, use:

`--configpath <configpath>`

The `gasMultiplier` and the `gasLimit` can be set with:

`--gaslimit <gaslimit> --gasmultiplier <gasmultiplier>`

### OffChain Transactions

#### Send
You'll need the following parameters:

```bash=
node cli.js offchaintx --type send --recipient <rollup address> --amount <amount> --fee <fee> --tokenid <token ID>
```

To specify another path, use:
`--configpath <configpath>`

The Nonce can be hardcoded with:
`--nonce <nonce>`

The minimum fee is 1 token.

#### Withdraw offchain
You'll need the following parameters:

```bash=
node cli.js offchaintx --type withdrawOffchain --amount <amount> --fee <fee> --tokenid <token ID>
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

#### Get accounts by rollup Id:
```bash=
node cli.js info --type accounts --filter tokenId --tk <token ID>
```

#### Exits by ID
Get the batch number of the exit in order to be able to withdraw your tokens.

```bash=
node cli.js info --type exits --tk <token ID>
```

### API operator <a id="3"></a>

#### Url Operator: https://zkrollup.iden3.net

#### Get State
To get registered operators: https://zkrollup.iden3.net/state

#### Get Operators
To get registered operators: https://zkrollup.iden3.net/operators

#### Get Accounts
To obtain accounts information:

By ethereum address:
https://zkrollup.iden3.net/accounts/{ethereumAddress}/{coin}

By babyjubjub address
https://zkrollup.iden3.net/accounts/{AxBabyjubjub}/{AyBabyjubjub}/{coin}

By rollup address
https://zkrollup.iden3.net/accounts/{rollupAddress}/{coin}

By filters:
https://zkrollup.iden3.net/accounts?ethAddr={ethereumAddress}
https://zkrollup.iden3.net/accounts?ax={AxBabyjubjub}&ay={AyBabyjubjub}
https://zkrollup.iden3.net/accounts/{rollupAddress}

#### Get Exits
To get the num exits batch by ID:
https://zkrollup.iden3.net/exits/{ax}/{ay}/{coin}

#### Get Exit Information
To get information from a numexitbatch:
https://zkrollup.iden3.net/exits/{ax}/{ay}/{coin}/{numBatch}

#### Get Tokens
To get registered tokens: https://zkrollup.iden3.net/tokens
Get current fee to add a token into rollup: https://zkrollup.iden3.net/feetokens

#### Get Batch
Get transactions in an specific batch: https://zkrollup.iden3.net/batch/{batchID}