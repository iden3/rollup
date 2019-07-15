#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
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
      `)
  .alias('p', 'path')
  .alias('pass', 'passphrase')
  .help('h')
  .alias('h', 'help')

  .epilogue('Rollup client cli tool');

const clientRollUp = require('./index.js');

const pathName = (argv.path) ? argv.path : __dirname;
const databaseType = (argv.database) ? argv.database : 'levelDb';
const passString = (argv.passphrase) ? argv.passphrase : 'nopassphrase';

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
  } else {
    throw new Error('Invalid Command');
  }
} catch (err) {
  console.log(err.stack);
  console.log(`ERROR: ${err}`);
  process.exit(1);
}
