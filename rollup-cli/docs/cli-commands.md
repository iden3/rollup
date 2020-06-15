# Rollup client

## Commands
```
rollup-cli <command> <options>

createkeys command
=============
  rollup-cli createkeys <option>
    create new wallet for rollup client
  -keytype or --kt [ethereum | babyjubjub | rollup]
    select type of wallet
  -path or --p <path>
    Path to store wallet
    Default: ./src/resources/
  -passphrase or --pass <passphrase string>
    Passphrase to encrypt private key
  -mnemonic or --mn <mnemonic>
    Mnemonic 12 words
  -import or --imp <walletPath>
    To import encrypt wallet

printkeys command
=============
  rollup-cli printkeys <options>
  Print public keys
  -path or --p <path>
    Path to JSON file
  -keytype [ethereum | babyjubjub | rollup]
    Define which wallet type needs to be readed
  -passphrase or --pass <passphrase string>
    Passphrase to decrypt keys

setparam command
=============
  rollup-cli setparam --param <parameter> --value <parameter value>
  --paramstx <parameter file>
  Default: ./config.json

offchainTx command
=============
  rollup-cli offchaintx <options>
  --type or -t [send]
    Defines which transaction should be done
  --pass or -passphrase <passphrase string>
    Passphrasse to decrypt wallet
  --to <recipient address>
    User identifier on balance tree which will receive the transaction
    Note: send to 0 makes a withdraw transaction
  --amount or -a <amount>
    Amount to send or withdraw
  --fee <fee>
    User fee in % of the amount send
  --paramstx <parameter file>
    Contains all necessary parameters to perform transacction
    Default: ./config.json
  --tokenid <token ID>

onchainTx command
=============
  rollup-cli onchaintx <options>
  --type or -t [deposit | depositontop | withdraw | forcewithdraw]
    Defines which transaction should be done
  --pass or -passphrase <passphrase string>
    Passphrasse to decrypt ethereum wallet
  --amount or -a <amount>
  --tokenid <token ID>
  --numexitroot <num exit root>
  --paramstx <parameter file>
    Contains all necessary parameters to perform transaction
    Default: ./config.json

info command
=============
  rollup-cli info <options>
  --type or -t [accounts | exits]
    get accounts information
    get batches where an account has been done an exit transaction 
  --filter or -f [babyjubjub | ethereum]
    only used on account information
```

## Configuration parameters
The following parameters can be configured in a json file in order to not manually write its content on any cli command:

- Rollup wallet
- Operator url
- Rollup smart contract address
- Ethereum node url
- Rollup smart contract abi
- Own account id

## On-chain parameters definition
- deposit
  - amount
  - token id
  - bayjubjub pubkey
  - ethereum address
- deposit on top
  - account id (receiver)
  - deposit amount
  - token id
- forcewithdraw
  - account id
  - amount
- withdraw
  - number exit batch
  - account id

## Off-chain parameters definition
- send
  - account id (receiver) 
  - amount
  - token id
  - fee
