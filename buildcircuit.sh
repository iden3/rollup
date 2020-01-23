#!/bin/bash
cd circuits
node --max-old-space-size=32000 ../../circom/cli.js rollup_main.circom -c -s -r -v -n "RollupTx|DecodeTx"
g++ rollup_main.cpp ../../circom/c/main.cpp ../../circom/c/calcwit.cpp ../../circom/c/fr.c ../../circom/c/fr.o ../../circom/c/utils.cpp -o rollup_main -I ../../circom/c -lgmp -std=c++11 -O3

