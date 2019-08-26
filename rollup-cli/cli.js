#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { sendTx, depositTx } = require('./src/cli-utils');
const { version } = require('./package');
const { argv } = require('yargs') // eslint-disable-line
  .version(version)
  .usage(`

rollup-cli <command> <options>

create command
=============

  rollup-cli create <option>

  create new keys for rollup client

  -path or --p <path>

    Path to store key container

    Default: current path

  -passphrase or --pass <passphrase string>

    Passphrase to encrypt private key

printkeys command
=============

  rollup-cli printkeys <option>

  Print public keys stored on key container

  -path or --p <path>

    Path to key container

    Default: current path

offchainTx command
=============
    
  rollup-cli offchaintx <options>

  --type or -t <type>

  --wallet or -w <path json>

  --pass <passphrase string>

  -to <recipient address>

  --amount or -a <amount>

  --operator or -o <operator address>

onchainTx command
=============
      
  rollup-cli offchaintx <options>
  
  --type or -t <type>
  
  --wallet or -w <path json>
  
  --pass <passphrase>
  
  --amount or -a <amount>
      
      `)
  .alias('p', 'path')
  .alias('pass', 'passphrase')
  .help('h')
  .alias('h', 'help')
  .alias('t', 'type')
  .alias('w', 'wallet')
  .alias('a', 'amount')
  .alias('o', 'operator')
  .epilogue('Rollup client cli tool');

const clientRollUp = require('./index.js');

const pathName = (argv.path) ? argv.path : __dirname;
const databaseType = (argv.database) ? argv.database : 'levelDb';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';
const type = (argv.type) ? argv.type : 'notype';
const to = (argv.to) ? argv.to : 'norecipient';
const walletPath = (argv.wallet) ? argv.wallet : 'src/wallet-rollup-cli.json';
const amount = (argv.amount) ? argv.amount : '0';
const operator = (argv.operator) ? argv.operator : 'nooperator'

try {
  if (argv._[0].toUpperCase() === 'CREATE') {
    if (passString === 'nopassphrase') {
      console.log('Please provide a passphrase to encrypt keys by:\n\n');
      throw new Error('No passphrase was submitted');
    }

    // create keys from random seed, both ethereum and babyjujub
    // Store object with [keys - enc(privKey)]
    // save JSON file

    process.exit(0);
  } else if (argv._[0].toUpperCase() === 'PRINTKEYS') {
    // open JSON file
    // Read key values and print them
    // Read it and retrieve the two keys: ethereum public key and babyjub public key
    console.log('The following keys have been found:');
  } else if (argv._[0].toUpperCase() === 'OFFCHAINTX') {
    if (type === 'notype') {
      console.log('It is necessary to specify the type of action\n\n');
      throw new Error('No type was submitted');
    }else if (type === 'send') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase\n\n');
        throw new Error('No passphrase was submitted');
      } if (operator === 'nooperator') {
        console.log('Please provide a operator\n\n');
        throw new Error('No operator was submitted');
      } else {
        sendTx(walletPath, passString, to, amount, operator);
      }
    }else {
      throw new Error('Invalid type');
    }
  } else if (argv._[0].toUpperCase() === 'ONCHAINTX') {
    if (type === 'notype') {
      console.log('It is necessary to specify the type of action\n\n');
      throw new Error('No type was submitted');
    }else if (type === 'deposit') {
      if (passString === 'nopassphrase') {
        console.log('Please provide a passphrase to encrypt keys by:\n\n');
        throw new Error('No passphrase was submitted');
      } else {
        depositTx(walletPath, passString);
      }
    }else {
      throw new Error('Invalid type');
    }
  } else {
    throw new Error('Invalid Command');
  }
} catch (err) {
  console.log(err.stack);
  console.log(`ERROR: ${err}`);
  process.exit(1);
}
