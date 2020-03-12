module.exports = {
  client: require('ganache-cli'),
  providerOptions: {
    total_accounts: 100,
    default_balance_ether: 1000000,
  },
  skipFiles: [
    './contracts/Migrations.sol',
    './lib/Memory.sol',
    './lib/Poseidon.sol',
    './verifiers/Verifier_16_24.sol',
    './verifiers/Verifier_128_24.sol',
    './test/EventTest.sol',
    './test/TokenTest.sol',
  ]
}