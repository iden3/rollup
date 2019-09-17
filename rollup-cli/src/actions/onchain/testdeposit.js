const chai = require('chai');
const deposit= require('./deposit.js');
const walletEthPathDefault="../../ethWallet.json"
const { expect } = chai;
const fs = require('fs');
//var rollupabi = require ('./rollupabi.js');

describe('Deposit', async () => {

    const url = "http://localhost:7545"; //test
    const addressSC ="0x9A0c51633998CCF75Ea5fF27Bb18827BDd992a3F";
    const balance = 10;
    const tokenId = 0;
    const walletEth = JSON.parse(fs.readFileSync(walletEthPathDefault, "utf8"));
    const password = "123";
    const Ax = BigInt(30890499764467592830739030727222305800976141688008169211302);
    const Ay = BigInt(19826930437678088398923647454327426275321075228766562806246);
    const babyjubpublic = [Ax.toString(), Ay.toString()];
    const abi = [
        {
          "constant": true,
          "inputs": [
            {
              "name": "msgHash",
              "type": "bytes32"
            },
            {
              "name": "rsv",
              "type": "bytes"
            }
          ],
          "name": "checkSig",
          "outputs": [
            {
              "name": "",
              "type": "address"
            }
          ],
          "payable": false,
          "stateMutability": "pure",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "owner",
          "outputs": [
            {
              "name": "",
              "type": "address"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "isOwner",
          "outputs": [
            {
              "name": "",
              "type": "bool"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "name": "_verifier",
              "type": "address"
            },
            {
              "name": "_poseidon",
              "type": "address"
            }
          ],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "name": "idBalanceTree",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "depositAmount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "tokenId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "Ax",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "Ay",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "withdrawAddress",
              "type": "address"
            }
          ],
          "name": "Deposit",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "name": "batchNumber",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "offChainTx",
              "type": "bytes"
            }
          ],
          "name": "ForgeBatch",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "name": "idBalanceTree",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "amount",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "tokenId",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "Ax",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "Ay",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "withdrawAddress",
              "type": "address"
            },
            {
              "indexed": false,
              "name": "nonce",
              "type": "uint256"
            }
          ],
          "name": "ForceFullWithdraw",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "name": "idBalanceTree",
              "type": "uint256"
            },
            {
              "indexed": false,
              "name": "amountDeposit",
              "type": "uint256"
            }
          ],
          "name": "DepositOnTop",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": false,
              "name": "tokenAddress",
              "type": "address"
            },
            {
              "indexed": false,
              "name": "tokenId",
              "type": "uint256"
            }
          ],
          "name": "AddToken",
          "type": "event"
        },
        {
          "anonymous": false,
          "inputs": [
            {
              "indexed": true,
              "name": "previousOwner",
              "type": "address"
            },
            {
              "indexed": true,
              "name": "newOwner",
              "type": "address"
            }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "forgeBatchMechanismAddress",
              "type": "address"
            }
          ],
          "name": "loadForgeBatchMechanism",
          "outputs": [],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "tokenAddress",
              "type": "address"
            }
          ],
          "name": "addToken",
          "outputs": [],
          "payable": true,
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "depositAmount",
              "type": "uint16"
            },
            {
              "name": "tokenId",
              "type": "uint16"
            },
            {
              "name": "babyPubKey",
              "type": "uint256[2]"
            },
            {
              "name": "withdrawAddress",
              "type": "address"
            }
          ],
          "name": "deposit",
          "outputs": [],
          "payable": true,
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "beneficiaryAddress",
              "type": "address"
            },
            {
              "name": "proofA",
              "type": "uint256[2]"
            },
            {
              "name": "proofB",
              "type": "uint256[2][2]"
            },
            {
              "name": "proofC",
              "type": "uint256[2]"
            },
            {
              "name": "input",
              "type": "uint256[8]"
            },
            {
              "name": "compressedTxs",
              "type": "bytes"
            }
          ],
          "name": "forgeBatch",
          "outputs": [],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "idBalanceTree",
              "type": "uint24"
            },
            {
              "name": "amount",
              "type": "uint16"
            },
            {
              "name": "tokenId",
              "type": "uint16"
            },
            {
              "name": "numExitRoot",
              "type": "uint256"
            },
            {
              "name": "siblings",
              "type": "uint256[]"
            }
          ],
          "name": "withdraw",
          "outputs": [],
          "payable": false,
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "idBalanceTree",
              "type": "uint24"
            },
            {
              "name": "amount",
              "type": "uint16"
            },
            {
              "name": "tokenId",
              "type": "uint16"
            },
            {
              "name": "nonce",
              "type": "uint32"
            },
            {
              "name": "babyPubKey",
              "type": "uint256[2]"
            },
            {
              "name": "siblings",
              "type": "uint256[]"
            }
          ],
          "name": "forceFullWithdraw",
          "outputs": [],
          "payable": true,
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "constant": false,
          "inputs": [
            {
              "name": "idBalanceTree",
              "type": "uint24"
            },
            {
              "name": "amount",
              "type": "uint16"
            },
            {
              "name": "tokenId",
              "type": "uint16"
            },
            {
              "name": "withdrawAddress",
              "type": "address"
            },
            {
              "name": "nonce",
              "type": "uint32"
            },
            {
              "name": "babyPubKey",
              "type": "uint256[2]"
            },
            {
              "name": "siblings",
              "type": "uint256[]"
            },
            {
              "name": "numStateRoot",
              "type": "uint256"
            },
            {
              "name": "amountDeposit",
              "type": "uint16"
            }
          ],
          "name": "depositOnTop",
          "outputs": [],
          "payable": true,
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [
            {
              "name": "numBatch",
              "type": "uint256"
            }
          ],
          "name": "getStateRoot",
          "outputs": [
            {
              "name": "",
              "type": "bytes32"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [],
          "name": "getStateDepth",
          "outputs": [
            {
              "name": "",
              "type": "uint256"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [
            {
              "name": "numBatch",
              "type": "uint256"
            }
          ],
          "name": "getExitRoot",
          "outputs": [
            {
              "name": "",
              "type": "bytes32"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        },
        {
          "constant": true,
          "inputs": [
            {
              "name": "tokenId",
              "type": "uint256"
            }
          ],
          "name": "getTokenAddress",
          "outputs": [
            {
              "name": "",
              "type": "address"
            }
          ],
          "payable": false,
          "stateMutability": "view",
          "type": "function"
        }
      ]//rollupabi.ABI

 
  it('Test deposit', () => {
    deposit.deposit(url, addressSC, balance, tokenId, walletEth, password, babyjubpublic, abi)
  });
});
