#!/bin/bash

node build-config.js

cd ../..
./rollup-operator/test/server/webapp-test/create-config-env.sh

gnome-terminal -e 'node rollup-operator/src/server/proof-of-burn/operator-pob.js -p passTest'

exit