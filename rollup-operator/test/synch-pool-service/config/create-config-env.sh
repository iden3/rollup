#!/bin/bash

path_synch="$(pwd)/test/synch-pool-service/config/config-test.json"
path_env="$(pwd)/src/synch-pool-service/config.env"

echo "CONFIG_PATH = $path_synch
LOG_LEVEL = debug" > $path_env
 