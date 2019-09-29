# Rollup client

## Commands
```
rollup-cli <command> <options>

createkeys command
=============

  rollup-cli createkeys <options>

  create new keys for rollup client,
  either ethereum wallet and babyjubjub wallet

  -path or --p <path>

    Path to store JSON encrypted wallet files

    Default: wallet-ethereum.json
             wallet-babyjubjub.json

  -passphrase or --pass <passphrase string>

    Passphrase to encrypt JSON files

printkeys command
=============

  rollup-cli printkeys <options>

  Print public keys

  -path or --p <path>

    Path to JSON file
    
  -keytype [ethereum | babyjubjub]

    Define which wallet type needs to be readed

offchainTx command
=============
    
  rollup-cli offchaintx <options>

  --operator or -o <operator url>
  
    Operator url to send the transaction
    
  --wallet or -w <path json>
      
    Path to babyjubjub wallet  
      
    Default: wallet-babyjubjub.json

  --pass <passphrase string>
  
    Passphrasse to decrypt babyjubjub wallet

  --to <recipient address>

    User identifier on balance tree which will receive the transaction
    
    Note: send to 0 makes a withdraw transaction

  --amount or -a <amount>

    Amount to send or withdraw

onchainTx command
=============
      
  rollup-cli onchaintx <options>
  
  --node or -n <node url>
  
    Provide ethereum node to send transaction
  
  --address <ethereum address>
  
    Rollup ethereum smart contract address
    
  --operator <operator url>
  
    Operator url to retrieve information about current balance tree state
  
  --type or -t [deposit | depositontop | withdraw | forcewithdraw]
  
    Defines which transaction should be done
    
  --paramsTx <parameter file>
  
    Contains all necessary parameters to perform transacction
    Parameters would be different depending on transaction type
    
    Default: params-tx.json
  
  --wallet or -w <path json>
      
    Path to ethereum wallet  
      
    Default: wallet-ethereum.json
  
  --pass <passphrase string>
  
    Passphrasse to decrypt ethereum wallet
  
```
## Configuration parameters
The following parameters can be configured in a json file in order to not manually write its content on any cli command:

- Ethereum wallet
- Babyjubjub wallet
- Ethereum node url 
- Rollup operator url
- Rollup Smart contract address

## On-chain parameters definition

- deposit
  - amount
  - token id
  - bayjubjub pubkey
  - withdraw address
- deposit on top
  - id (receiver)
  - deposit amount
  - token id
- withdraw
  - id exit tree
- forcewithdraw
  - id balance tree

## Off-chain parameters definition

- send
  - amount
  - id (receiver)
  - password
  - from
  - wallet
  - operator
