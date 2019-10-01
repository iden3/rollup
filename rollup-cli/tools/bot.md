# Rollup-cli Bot

Automatice creation of wallets with ethers and tokens, along with doing transactions onchain and offchain


## Table of Contents

[TOC]

### Commands:
- createwallets: Create, fund and save the wallets in files with encripted JSON format. 
- deposit: Every wallet does a deposit Tx
- send: Every wallet does a send Tx. Some Tx will be unvalid randomly
- doall: Make the three options above


### Previous configuration:
It's necessari a configBot.json like this one:
```
{
 "walletFunder": "../tools/resourcesBot/walletFunder.json",
 "operator": "http://127.0.0.1:9000",
 "addressTokens": "0xF291d7c0b1220caf444FE9D154845c72717680CD",
 "nodeEth": "http://localhost:8545",
 "abiTokens": "../tools/resourcesBot/abiTokens.json",
 "addressRollup": "0x6F03069cE386F29BEE18a656B16b20700eAAF338",
 "abiRollup:": "../tools/resourcesBot/rollupabi.json"
}

The walletFunder must be an account with tokens and funds. 
In order to test this, the user can use the bot.test.js wich creates in ganache an account with funds and tokens.
```
### Options:

- wallets `[-w | --wallets] <amount of wallets to create> `
Default: 4 
- mnemonic `[-mn | --mnemonic] <mnemonic 12 words>` 
If no mnemonic submited the wallets will be create randomly
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

```
Create 5 wallets with a mnemonic: 
node bot.js createwallets --wallets 5 --mnemonic "radar blur cabbage chef fix engine embark joy scheme fiction master release"
```
```
Every wallet does 2 offchain send transactions: 
node bot.js send --sends 2 
```
```
Every wallet does 2 onchain deposit transactions: 
node bot.js send --deposits 2 
```
