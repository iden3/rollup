#!/bin/bash
mkdir -p docker-webapp/config-webapp
mkdir -p docker-operator/operator/config-operator
mkdir -p docker-cli-pos/config-cli-pos
cp -R docker-contracts/config-contracts/*.json docker-webapp/config-webapp
cp -R docker-contracts/config-contracts/*.json docker-operator/operator/config-operator
cp -R docker-contracts/config-contracts/*.json docker-cli-pos/config-cli-pos
cp -R docker-contracts/config-contracts/*.json docker-cli-pob/config-cli-pob
cp docker-contracts/config-contracts/synch-config.json docker-operator/synch-pool/config-pool