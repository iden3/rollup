# zkRollup  <img style="float: right;" src="https://i.imgur.com/dGCTo2B.png" width="100">

## Table of Contents

1. [Description](#1)
2. [Tutorial](#2)<br>
  2.0. [Initial Considerations](#2_0)<br>
  2.1. [Clone the rollup repository](#2_1)<br>
  2.2. [Create a wallet](#2_2)<br>
  2.3. [Get ether](#2_3)<br>
  2.4. [Get tokens](#2_4)<br>
  2.5. [Deposit onchain](#2_5)<br>
  2.6. [Get your rollup ID](#2_6)<br>
  2.7. [Send a rollup transaction to an operator](#2_7)<br>
  2.8. [Initiliaze withdrawal offchain](#2_8)<br>
  2.9. [Get exit transactions](#2_9)<br>
  2.10. [Complete withdrawal onchain](#2_10)<br>
  2.11. [Final notes](#2_11)<br>

## 1. Description<a id="1"></a>
zKRollup is a layer 2 technology whose main purpose is to scale Ethereum. For more on its potential to help scale ethereum, see [here](https://blog.iden3.io/istanbul-zkrollup-ethereum-throughput-limits-analysis.html).

To make it work we need an operator -- a node in the rollup side-chain -- and some smart contracts to interact with Ethereum.

The operator compresses **ERC20** token transactions with [zkSNARKs](https://github.com/iden3/circom) and forges rollup blocks, called batches. 

> **Definition:** Forging refers to the creation of a batch (off-chain) and the subsequent (on-chain) verification of the attached zkSnark.

We've currently deployed an operator and the contracts in the Goerli Testnet:

1. Rollup.sol: manages the rollup itself https://goerli.etherscan.io/address/0xE0C17C3a4f06b859124Df351Ca83864e6de46AB2
2. RollupPoS.sol: manages the consensus of the side-chain, in this case a PoS https://goerli.etherscan.io/address/0x60B6b593c381E5D31EC9a7b74a4cc1F2C5235EeB


This tutorial gives an overview of how zkRollup works on the  client side using our currently deployed infrastructure.

Please remember that rollup is still in an early stage of development.

Any feedback is welcome in our [telegram group](https://t.me/joinchat/G89XThj_TdahM0HASZEHwg), either if you find a problem or if you have successfully completed the tutorial. Do not hesitate to ask us or just make us any suggestion.

Also feel free to checkout our [github repository](https://github.com/iden3/rollup).

---

## 2. Tutorial<a id="2"></a>

### 2.0. Initial considerations<a id="2_0"></a>
Each batch takes around 45 seconds to 1 minute to be forged.

On-chain transactions take 2 forged batches to be included, and off-chain transactions take between 1 and 2 batches.

Rollup state could be checked on:
https://zkrollup.iden3.net/state

### 2.1. Clone the rollup repository<a id="2_1"></a>
The first step is to clone the rollup repository: 

```bash=
git clone https://github.com/iden3/rollup.git
cd rollup
git checkout testnet
```

Next, install dependencies inside the relevant folders:
```bash=
npm i
cd rollup-cli
npm i
```

> Note: the remainder of the operations in this tutorial will be performed from the `/rollup/rollup-cli` directory.

### 2.2. Create a wallet<a id="2_2"></a>
Create a rollup wallet with:

```bash=
node cli.js createkeys --keytype rollup
```

### 2.3. Get ether<a id="2_3"></a>
 To print your ethereum address, execute:

```bash=
node cli.js printkeys --keytype rollup --configpath config-example.json
```

You should see a message with the following stucture:

```bash=
The following keys have been found:
  Ethereum key:
    Address:
  Babyjub Key: 
    Public Key:
    Public Key Compressed:
```

Before we interact with the rollup contract, you’ll need to make sure you have some ether stored in the ethereum address you printed in the above command. The best way to do this is by using the goerli faucet.

Copy the ethereum address and go to the [goerli faucet](https://goerli-faucet.slock.it/).

If everything goes fine, the balance should be reflected in:
[https://goerli.etherscan.io/address/](https://goerli.etherscan.io/){yourEthereumAddress}]

### 2.4. Get tokens<a id="2_4"></a>
Get and approve [ERC20 Weenus tokens](https://github.com/bokkypoobah/WeenusTokenFaucet) with:

```bash=
node cli.js onchaintx --type approve --amount <amount> --configpath config-example.json
```

Note that `<amount>` must be a value within `0 <= amount <= 10^21.`

The transaction hash will be returned in the console.

Use this link to track the transaction: 
[https://goerli.etherscan.io/tx/](https://goerli.etherscan.io/){transactionHash}

>Note: you'll need to wait until the above transaction has been forged by an operator before you can move onto the next step. This must be done for all the on-chain transactions.

### 2.5. Deposit onchain<a id="2_5"></a>
Create an account on rollup:
```bash=
node cli.js onchaintx --type deposit --loadamount <amount> --tokenid 0 --configpath config-example.json
```
The total amount should be less than the amount approved in the last step.

Got to the next step in order to get detail of your rollup account and please note that you will need to wait about 2 minutes for the deposits to be forged. Once they're forged, this will be reflected in the operator API. 

### 2.6. Get your rollup ID<a id="2_6"></a>
Rollup addresses are simply Merkle tree leaf IDs. To find out what your rollup ID is, use either one of the following commands:
```bash=
node cli.js info --type accounts --filter ethereum -c config-example.json
```
Or
```bash=
node cli.js info --type accounts --filter babyjubjub -c config-example.json
```

You will find your rollup ID under the field `idx`

You can check your balance by your rollup ID as well:
[https://zkrollup.iden3.net/accounts/](https://zkrollup.iden3.net/accounts/1){your rollup ID}

### 2.7. Send a rollup transaction to an operator<a id="2_7"></a>
Use the following command send a rollup transaction:

```bash=
node cli.js offchaintx --type send --sender <rollup ID> --recipient <rollup ID> --amount <amount> --fee <fee> --tokenid 0 -c config-example.json
```
Transaction could be done to an existent rollup ID, such as 1: `--recipient 1`

The minimum fee for a rollup transactions is 1 wei token (this fee is needed in order to incentivize the operator to forge your transaction).

Offchain transactions should take anywhere between 30 seconds and 1 min to forge.

### 2.8. Initiliaze withdrawal offchain<a id="2_8"></a>
For offchain withdrawals, use the following command:
```bash=
node cli.js offchaintx --type withdrawoffchain --sender <rollup ID> --amount <amount> --fee <fee> --tokenid 0 -c config-example.json
```

This effectively transfer tokens to the Exit tree. From there, they can be withdrawn using the on-chain contract.

### 2.9. Get exit transactions<a id="2_9"></a>
Once the previous transaction has been forged, a new entry in the exit tree will be created. You can check for this entry by using the following command:

```bash=
node cli.js info --type exits --id <rollup ID> -c config-example.json
```

You should receive a response with the following structure:

```bash=
Number exits batch found:
X
```
You'll need this batch number in the next step.

### 2.10. Complete withdrawal onchain<a id="2_10"></a>
We're now ready to withdraw the tokens from the rollup chain to our wallet.

To do this, execute the following command:

```bash=
node cli.js onchaintx --type withdraw --id <rollup ID> --numexitbatch <numexitbatch> -c config-example.json
```

Note that you'll need to replace `<numexitbatch>` with the batch number you obtained in the previous step.

### 2.11. Final notes<a id="2_11"></a>
For further information you can visit the complete usage of the rollup-client on the following [link](https://github.com/iden3/rollup/blob/testnet/rollup-cli/README.md).

Any feedback is welcome in our [telegram group](https://t.me/joinchat/G89XThj_TdahM0HASZEHwg), either if you find a problem or if you have successfully completed the tutorial. Do not hesitate to ask us or just make us any suggestion.

Also feel free to checkout our [github repository](https://github.com/iden3/rollup).
