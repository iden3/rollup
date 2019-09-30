# Rollup-cli

## 1. Create Wallet
`rollup-cli createkeys --keytype rollup --pass password`

#### or also import wallet adding

`--mnemonic <mnemonic,12 words>`
or
`--import <path encrypted wallet>`

## 2. Configure parameters

Set a configuration file as the following: 
#### Config.json (example)
```
{
  "wallet": "./src/resources/wallet.json",
  "operator": "http://127.0.0.1:9000",
  "address": "0x3E03394a9d383312091a9c30BCe1354Eef737664",
  "nodeEth": "http://localhost:8545",
  "abi": "./src/resources/rollupabi.json"
 }
 ```
If a configuration file is not imported it will take **rollup-cli/src/resources/config.json** as default.

The user can modify the configuration file itself, or also, can do it with the following commands:

```
rollup-cli setparam --param <parameter> --value <parameter value>
```

To use a custom configuration file intead of the default one, add: 

`--paramstx <path file>`

In this case, remember to add this command in transactions too.

## 3. Transactions

Once the user has a wallet and a configuration file, is ready to use the following actions:


### Deposit
```
rollup-cli onchaintx --type deposit --pass <password> --amount <amount> --tokenid <token id>
```

### Send

```
rollup-cli offchaintx --type send --pass <password> --amount <amount> --to <recipient> --fee <user fee> --tokenid <token id>
```

### Deposit On Top 

```
rollup-cli onchaintx --type depositontop --pass <password> --amount <amount> --tokenid <token id>
```

### Force Withdraw 

```
rollup-cli onchaintx --type forceWithdraw --pass <password> --amount <amount>
```

### Withdraw 

```
rollup-cli onchaintx --type withdraw --pass <password> --amount <amount> --tokenid <token id>
```