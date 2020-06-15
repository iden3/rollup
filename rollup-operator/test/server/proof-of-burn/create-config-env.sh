#!/bin/bash

path_wallet="$(pwd)/test/config/wallet-pob-test.json"
path_synch="$(pwd)/test/config/synch-config-pob-test.json"
path_pool="$(pwd)/test/config/pool-config-pob-test.json"
path_env="$(pwd)/src/server/proof-of-burn/config.env"

echo "WALLET_PATH = $path_wallet
CONFIG_SYNCH = $path_synch
CONFIG_POOL = $path_pool
EXPOSE_API_SERVER = true
OPERATOR_PORT_EXTERNAL = 9000
URL_SERVER_PROOF = http://127.0.0.1:10001
LOG_LEVEL = info
OPERATOR_MODE = archive
GAS_MULTIPLIER = 1 
GAS_LIMIT = default
LAN=true
PASSWORD=passTest" > $path_env