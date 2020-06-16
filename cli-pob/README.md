# CLI Proof of Burn

## Table of Contents
1. [Install](#1)
2. [Usage](#2)
3. [API Operator](#3)

## Install <a id="1"></a>

This sections aims to show basic information regarding client which interacts with the proof-of-burn contract.

### Install the cli-pob

From the command line, type the following commands:
```
git clone https://github.com/iden3/rollup.git
git checkout testnet
cd rollup
npm i
cd cli-pob
npm i
```

### Create a config file
Next, create a file named config.json in the current directory with the following content:

```
{
"nodeUrl": "https://goerli.infura.io/v3/<your infura Token>"",
"pobAddress": "0x4F0b91B8117b1Ac65ceE31efAbeafbBBEFeDcC38",
"pobAbi": ["abi object"],
}
```

Make sure **you insert your own infura token in the nodeUrl parametmer** above.

If you don't want to add the configuration file path option, create it with the name `config.json` in the same`/cli-pop` folder.
If you save it with another name, always remember to add `--configpath <config path>` in the commands.

## Usage <a id="2"></a>

### Commands
- `bid`: Single bid to a specific slot
- `multibid`: Multibid to a specifics slots
- `withdraw`: Withdraw ether
- `balance`: Get operator balance

### Options
- wallet path `[-w | --wallet] <wallet path>`
- config path `[-c | --configpath] <config path>`
- bid value `[-a | --amount] <amount>`
- slot number `[-s | --slot] <slot number>`
- operator url `[-u | --url] <operator url>`
- beneficiary address `[-b | --beneficiary] <beneficiary address>`
- forger address `[-f | --forger] <forger address>`
- withdraw address `[--wd | --withdrawaddress] <withdraw address>`
- bonus address `[--bo | --bonusaddress] <bonus address>`
- use bonus `[--ub | --usebonus] <true | false>`
- gasLimit `[--gl | --gaslimit] <gas limit>`
- gasMultiplier `[--gm | --gasmultiplier] <gas multiplier>`

### Bid

Command to bid on the proof-of-burn contract.

#### Normal Bid

To bid as simple as possible.

`node cli-pob.js bid -s <slot> -a <bid> -u <url> -w <walletpath>`

#### Bid with different beneficiary address

To bid with a different beneficiary address.

`node cli-pob.js bid -s <slot> -a <bid> -u <url> -w <walletpath> -b <beneficiary address>`

#### Bid with different beneficiary & forger address

To bid with a different beneficiary address and a different forger.

`node cli-pob.js bid -s <slot> -a <bid> -u <url> -w <walletpath> -b <beneficiary address> -f <forger address>`

#### Bid with different beneficiary & forger & withdraw address

To bid with a different beneficiary address, a different forger, and a different withdraw address.

`node cli-pob.js bid -s <slot> -a <bid> -u <url> -w <walletpath> -b <beneficiary address> -f <forger address> --wd <withdraw address>`

#### Bid with different beneficiary & forger & withdraw & bonus address and if the bonus is going to be used 

To bid with a different payee address, a different forger, a different withdraw address, and a different address for the bonus. It is also decided whether the bonus is used or not.

`node cli-pob.js bid -s <slot> -a <bid> -u <url> -w <walletpath> -b <beneficiary address> -f <forger address> --wd <withdraw address> --bo <bonus address> --ub <use bonus (true | false)>`


### Multibid

To bid on different slots with different bid value at the same time in the same command.

`node cli-pob.js multibid -a X,Y,Z -s x1-x2,y1-y2,z1-z2 -u <url> -w <walletpath>`

### Withdraw

To withdraw the ether that is within the contract if you are outbid.

`node cli-pob.js withdraw -w <walletpath>`

### Balance

To get the balance of a wallet.

`node cli-pob.js balance -w <walletpath>`

## API operator <a id="3"></a>

### Get Operators

To get the winning operators: https://zkrollup.iden3.net/operators