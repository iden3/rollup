# Rollup-cli Bot

Automatic creation of wallets with ethers and tokens, along with making transactions onchain and offchain

## Table of Contents

[TOC]

### Quick guide:

- Open ganache (in port 8545)

- In root project directory:

    - Start operator client, or use the fake client with:
        `node rollup-cli/test/helpers/api-client.js `

    - Then:
        ```
        truffle test rollup-cli/tools/helpers/build-resources-bot.test.js
        ``` 
        ```
        node rollup-cli/tools/bot.js doall
        ```
### Commands:
- createwallets: Create, fund and save the wallets in files with encrypted JSON format. 
- deposit: Every wallet does a deposit Tx
- send: Every wallet does a send Tx. Some Tx will be wrong randomly
- doall: Make the three options above


### Previous configuration:

In order to use the bot there's need some configuratoin files and a walletFunder with tokens and funds to distribute, dome contracts deployed...
There's a script to do it, go to /helpers directory and execute `truffle test build-resources-bot.test.js`
Then you should be able to use de bot properly

### Options:

- wallets `[-w | --wallets] <amount of wallets to create> `
Default: 4 
- mnemonic `[-mn | --mnemonic] <mnemonic 12 words>` 
If no mnemonic submitted the wallets will be create randomly
- deposit `[-d | --deposits] <amount of deposits every wallet will make>`
Default: 1
- send    `[-s | --sends] <amount of sends every wallet will make>`
Default: 1
- path `[-p | --path] <path to save or load the wallets>`
- ether `[-e | --ether] <amount to fund every wallet>`
Default: 2
- tokens `[-t | --tokens] <amount to fund every wallet>`
Default: 10
- tokenid `--tokenid <token id>`
Default: 0
- fee `--fee <user fee>` 
Default: 1

##  Examples

Create 5 wallets with a mnemonic: 
```
node bot.js createwallets --wallets 5 --mnemonic "radar blur cabbage chef fix engine embark joy scheme fiction master release"
```

Every wallet does 2 offchain send transactions:
```
node bot.js send --sends 2 
```

Every wallet does 2 onchain deposit transactions: 
```
node bot.js deposit --deposits 2 
```
