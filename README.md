# zkRollup PoC <img style="float: right;" src="https://i.imgur.com/dGCTo2B.png" width="100">

## Disclosure
zkRollup PoC is no longer operative.

Work done in this zkRollup PoC is being followed on Hermez project. 

You can find further details about Hermez network project in [hermez.io](https://hermez.io/) and [@hermez_network](https://twitter.com/hermez_network). Please feel free to join us in our [telegram group](https://t.me/joinchat/G89XThj_TdahM0HASZEHwg).

## Table of Contents

1. [Description](#1)
2. [Tutorial](#2)<br>
  2.0. [Initial considerations](#2_0)<br>
  2.1. [Clone the rollup repository](#2_1)<br>
  2.2. [Create a wallet](#2_2)<br>
  2.3. [Get ether](#2_3)<br>
  2.4. [Get tokens](#2_4)<br>
  2.5. [Deposit on-chain](#2_5)<br>
  2.6. [Get your rollup id](#2_6)<br>
  2.7. [Send a rollup transaction to an operator](#2_7)<br>
  2.8. [Initiliaze withdrawal off-chain](#2_8)<br>
  2.9. [Find exit transaction](#2_9)<br>
  2.10. [Complete withdrawal on-chain](#2_10)<br>
  2.11. [Bonus: create rollup account with an off-chain transaction](#2_11)<br>
  2.12. [Resources](#2_12)<br>

## 1. Description<a id="1"></a>
In a nutshell, zkRollup is a layer 2 construction  -- similar to Plasma  --  which uses the ethereum blockchain for data storage instead of computation. 

In other words, zkRollup does computation off-chain and handles data availability on-chain.

All funds are held by a smart contract on the main-chain. For every [batch](https://docs.iden3.io/#/rollup/glossary?id=batch) (a rollup block), a zkSnark is generated off-chain and verified by this contract. This snark proves the validity of every transaction in the batch.

To make this work we need an operator -- a node in the rollup side-chain (or rollup block producer).

The operator job is to compress **ERC20** token transactions with [zkSNARKs](https://github.com/iden3/circom) and forge batches.

> **Definition:** Forging refers to the creation of a batch (off-chain) and the subsequent (on-chain) verification of the attached zkSnark.

For more on zkRollup checkout our docs [here](https://docs.iden3.io/#/rollup/rollup). For more on its potential to help scale ethereum, see [here](https://blog.iden3.io/istanbul-zkrollup-ethereum-throughput-limits-analysis.html).

### Testnet details
We've currently deployed an operator and the relevant contracts to the Goerli Testnet:

1. **[Rollup.sol](https://github.com/iden3/rollup/blob/master/contracts/Rollup.sol)** manages the rollup itself: https://goerli.etherscan.io/address/0xbC0fd0Bd2e5B5CC7FE947A829067D207381E03FA
2. **[RollupPoB.sol](https://github.com/iden3/rollup/blob/master/contracts/RollupPoB.sol)** manages the consensus mechanism; in this case PoB: https://goerli.etherscan.io/address/0x4F0b91B8117b1Ac65ceE31efAbeafbBBEFeDcC38

This testnet is purely for transfers (not arbitrary smart contracts), and fully supports ERC20 tokens.

And while it’s just a command line interface for now, all the moving parts are in place!

Going forward, we’ll be focusing on optimizing the individual parts as much as possible. In particular, reducing the most important bottleneck: proof-generation.

The tutorial below gives an overview of how zkRollup works on the  client side using our currently deployed infrastructure.

Please remember that rollup is still in its early stages.

If you’d like to offer feedback, come across any problems, or have any questions at all, please feel free to reach out to us in our [telegram group](https://t.me/joinchat/G89XThj_TdahM0HASZEHwg). suggestion.

## 2. Tutorial<a id="2"></a>

### 2.0. Initial considerations<a id="2_0"></a>

>A **batch** is a rollup block

>An **operator** is a batch producer

> **rollup address** is the compressed format of the babyjubjub public key

> **Forging** refers to the creation of a batch (off-chain) and the subsequent (on-chain) verification of the attached zkSnark.

Each batch takes around 45 seconds to 1 minute to be forged by an operator. 

> note: while in the current implementation batches can't be forged in parallel, we plan to make it possible to parallelise this step.

On-chain transactions (transactions sent to the rollup contract) take 2 batches to affect the rollup account balance tree, while off-chain transactions (transactions sent to the operator) take between 1 and 2 batches. This makes off-chain transactions slightly faster to execute.

To keep track of the latest rollup state see [here](https://zkrollup.iden3.net/state).

### 2.1. Clone the rollup repository<a id="2_1"></a>

The first step is to clone the rollup repository and move to the testnet branch: 

```bash=
git clone https://github.com/iden3/rollup.git
cd rollup
```

Next, install the required dependencies inside the relevant folders:
```bash=
npm i
cd rollup-cli
npm i
```

The remainder of the operations in this tutorial will be performed from the `/rollup/rollup-cli` directory.

### 2.2. Create a wallet<a id="2_2"></a>
Create a rollup wallet with:

```bash=
node cli.js createkeys
```

You'll be prompted to enter a password:

```bash=
Password: 
```

> Remeber you'll need to enter this password every time you perform a rollup transaction.

You'll be prompted the keys you have just generated.

### 2.3. Get ether<a id="2_3"></a>
 When you created the wallet in the previous step, you were also assigned an ethereum address. To print your address, execute:

```bash=
node cli.js printkeys --configpath config-example.json
```

You should see a message with the following stucture:

```bash=
Ethereum public key:
  Address:

Rollup public key: 
  Rollup address:
  Babyjubjub points:
      Ax:
      Ay:
```

Before we interact with the rollup contract, you’ll need to make sure you have some ether stored in your `Ethereum address` (this is to pay for the network transaction fees in the next step). The best way to do this is by using the goerli faucet.

Copy your ethereum address and visit the [faucet](https://goerli-faucet.slock.it/) to request test ether.

One you've done this, visit [https://goerli.etherscan.io](https://goerli.etherscan.io/) and input your address. You should see that your balance has been updated.


### 2.4. Get tokens<a id="2_4"></a>
The next step is to acquire some [ERC20 Weenus tokens](https://github.com/bokkypoobah/WeenusTokenFaucet). To do this, execute the following command:

> Note that you must replace `<amount>` with a value of your choice between `0` and `10^21.`

```bash=
node cli.js onchaintx --type approve --amount <amount> --configpath config-example.json
```
This will return a transaction hash -- a uniquely attributable id for the transaction.  It should look something like this:

`0x717d0bf6b6567c2d0f207e409f0fd428bd3cb8d2851d5000f49f9b7e08871da6`

Visit https://goerli.etherscan.io/ and input your transaction's hash to track its progress.


>Note: as this is an on-chain transaction, you'll need to wait until the above transaction has been both processed on the ethereum chain and forged on the rollup side chain before you can move onto the next step. This may take a couple of minutes.

### 2.5. Deposit on-chain<a id="2_5"></a>

To make your first on-chain deposit -- and create your rollup account -- execute the following command:

> As before, you must replace `<amount>` with a value of your choice. But this value must be less than the amount you specified in the previous step.

```bash=
node cli.js onchaintx --type deposit --loadamount <amount> --tokenid 0 --configpath config-example.json
```

Note that deposits may take 2 minutes to be forged. 

As before, you should see a transaction hash. You can use this hash to [track its progress](https://goerli.etherscan.io/).

### 2.6. Get your rollup account status<a id="2_6"></a>

To find out what your rollup account status is, use either one of the following commands:

```bash=
node cli.js info --type accounts --filter ethereum --configpath config-example.json
```

Or

```bash=
node cli.js info --type accounts --filter babyjubjub --configpath config-example.json
```

The return info will look like this:

```
Accounts found: 
 [
 {
  "coin": 0,
  "nonce": 0,
  "amount": "100",
  "ax": "195c8419ea4cf04556e7b23f72d29c17a5a6a47390f370f0559924646e6e8ac9",
  "ay": "2c96baa6bc55d876a9b50504424ac2d7ee358de9bc106555a66b988bc78ad409",
  "ethAddress": "0xaa942cfcd25ad4d90a62358b0dd84f33b398262a",
  "idx": 31
 }
]
```

Note that information retrieved prints all possible tokens attached to rollup account. If it is wanted to get information account for specific token, you can filter by token too:

```
node cli.js info --type accounts --filter tokenid --tokenid <token ID> --configpath config-example.json
```

Also you could visit the following link to check your account state:

https://zkrollup.iden3.net/accounts/:rollupaddress/:tokenid

### 2.7. Send a rollup transaction to an operator<a id="2_7"></a>
Now that you've created your rollup account, it's time to send your first rollup transaction!

To do this, execute the following command:

> You'll need to replace the first `<rollup address>`  with the rollup public key compressed of the intended recipient. You'll also need to replace `<amount>` with the amount you wish to send, and `<fee>` with an appropriate fee (`50%` as an example).

> If you do not know any fellow which holds a rollup account you can send a transaction to this rollup account: `0x861bea7cd14a6e9eb5514193cf8a3d3a5b827dc8c7ba6dbe2f0bd2bd7379c12b`

```bash=
node cli.js offchaintx --type send --recipient <rollup address> --amount <amount> --fee <fee> --tokenid 0 --configpath config-example.json
```

Congratulations on executing your first off-chain transaction! 🚀

> Remember that off-chain transactions need to be forged by an operator, which can take anywhere between 30 seconds and 1 min. So please wait a minute before moving onto the next step.

### 2.8. Initiliaze withdrawal offchain<a id="2_8"></a>

To avoid paying an on-chain withdrawal fee, you need to initialise your withdrawal off-chain.

> Note that although we are initializing the withdrawal off-chain in this tutorial, a user always has the option to bypass the operators and withdraw directly on-chain, albeit at an extra cost.

To do this, execute the following command:

> As before, you’ll need to replace `<amount>` with the amount you wish to send, and `<fee>` with an appropriate fee (`50%` as an example).


```bash=
node cli.js offchaintx --type withdrawoffchain --amount <amount> --fee <fee> --tokenid 0 --configpath config-example.json
```

This effectively transfers tokens to the **exit tree** -- a Merkle tree dedicated to keeping track of withdrawals. From there, they can be withdrawn using the on-chain contract.

### 2.9. Get exit transaction<a id="2_9"></a>

Once the previous transaction has been forged, a new entry in the exit tree is created. You can check for this entry by executing the following command:

```bash=
node cli.js info --type exits --tokenid 0 --configpath config-example.json
```

You'll receive a response that looks like this:

```bash=
Number exits batch found:
X
```

Where instead of `X` you should see a number. This number refers to the batch in which your withdrawal was processed. Note it down, as you'll need it in the next step.

### 2.10. Complete withdrawal on-chain<a id="2_10"></a>

We're now ready to withdraw the tokens from the rollup chain to our wallet.

To do this, execute the following command:

> Remember to replace `<numexitbatch>` with the batch number you obtained in the previous step.

```bash=
node cli.js onchaintx --type withdraw --tokenid 0 --numexitbatch <numexitbatch> --configpath config-example.json
```

Wait a couple of minutes and then visit [etherscan](https://goerli.etherscan.io/) to check that your transaction has gone through.

And voila! That's all there is to it :)

### 2.11. Bonus: create rollup account with an off-chain transaction<a id="2_11"></a>

We are going to creare a rollup account which does not exist on rollup ledger and send some funds to it. This means that a rollup account could be created without going on-chain and then does not require any ether in front.

Get a valid rollup account from client or ask for a rollup public key to some friend which does not exist on rollup :)
```bash=
node cli.js createkeys --walletpath wallet-offchain.json
```

Take `Rollup address` from previous wallet and perform the off-chain deposit ( you need to specify the ethereum address that will be linked to this rollup account as well :)
```bash=
node cli.js offchaintx --type depositoffchain --amount <amountToSend> --tokenid 0 --fee <feeToPay%> --ethereumaddress <address new rollup account> -r <rollup public key> --configpath config-example.json
```

Wait until the off-chain transaction has been forged and check the rollup accounts status in https://zkrollup.iden3.net/accounts/:rollupaddress/:tokenid to check that rollup account has been created succesfully 

> In order to perform this deposit off-chain transaction, the operator must pay for the creation of the rollup account. Transaction needs to cover this costs, otherwise operator will automatically reject the transaction. Current testnet implementation defines a `deposit fee = 0.0001 ether`. Taking into account that we consider `WEENUS token (18 decimals) = 1$`, that would mean that, assuming ether value is 230$, deposit fee would cost 0.023 $. Therefore, to perform a deposit off-chain, rollup user must pay fees that covers this deposit fees. As an example of a deposit off-chain could be an amount of: `1000000000000000000` with 50% fee that turns in `0.5 $` of fees.


### 2.12. Resources<a id="2_12"></a>

- Checkout our github repository [here](https://github.com/iden3/rollup).

- For more on how the rollup client works, see [here](https://github.com/iden3/rollup/blob/master/rollup-cli/README.md).

- If you’d like to offer feedback, come across any problems, or have any questions at all, please feel free to reach out to us in our [telegram group](https://t.me/joinchat/G89XThj_TdahM0HASZEHwg).
