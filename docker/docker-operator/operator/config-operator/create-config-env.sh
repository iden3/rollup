#!/bin/bash

path_synch="$(pwd)/rollup-operator/src/server/synch-config.json"
path_pool="$(pwd)/rollup-operator/src/server/pool-config.json"
path_wallet="$(pwd)/rollup-operator/src/server/wallet.json"

echo "WALLET_PATH = $path_wallet
CONFIG_SYNCH = $path_synch
CONFIG_POOL = $path_pool" > config.env 