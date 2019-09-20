const fs = require('fs');
const process = require('child_process');
const chai = require('chai');

const walletPathDefault = '../src/resources/wallet.json';
const pass = 'foo';

const { expect } = chai;

describe('PRINT KEYS', () => {
  it('printkeys command', (done) => {
    const out = process.exec('cd ..; node cli.js printkeys');
    out.stdout.on('data', (data) => {
      expect(data.toString()).to.be.equal('The following keys have been found:\n');
      done();
    });
  });
  it('printkeys command error', (done) => {
    const out = process.exec('cd ..; node cli.js printkeyss');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
});

describe('CREATE KEYS RANDOM', () => {
  it('createkeys random', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --pass ${pass} --path ./src/resources/walletRollup.json`, () => {
      const readWallet = fs.readFileSync('../src/resources/walletRollup.json', 'utf-8');
      expect(readWallet).to.not.be.equal(undefined);
      process.exec('rm ../src/resources/walletRollup.json');
      done();
    });
  });
  it('createkeys random default path', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --pass ${pass}`, () => {
      const readWallet = fs.readFileSync(walletPathDefault, 'utf8');
      expect(readWallet).to.not.be.equal(undefined);
      done();
    });
  });
  it('createkeys error password', (done) => {
    const out = process.exec('cd ..; node cli.js createkeys --keytype rollup --path ./src/resources/walletRollup.json');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys error keytype', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --pass ${pass} --path ./src/resources/walletRollup.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
});

describe('CREATE KEYS MNEMONIC', () => {
  it('createkeys mnemonic', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass} --path ./src/resources/walletRollupMnemonic.json`, () => {
      const readWalletMnemonic = fs.readFileSync('../src/resources/walletRollupMnemonic.json', 'utf8');
      expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
      process.exec('rm ../src/resources/walletRollupMnemonic.json');
      done();
    });
  });
  it('createkeys mnemonic default path', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass}`, () => {
      const readWalletMnemonic = fs.readFileSync(walletPathDefault, 'utf8');
      expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
      done();
    });
  });
  it('createkeys mnemonic error', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic obscure property tackle faculty fresh gas clerk order silver answer belt brother --pass ${pass} --path ./src/resources/walletRollupMnemonic.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys mnemonic error 2', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt" --pass ${pass} --path ./src/resources/walletRollupMnemonic.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys mnemonic error password', (done) => {
    const out = process.exec('cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --path ./src/resources/walletRollupMnemonic.json');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys mnemonic error keytype', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass} --path ./src/resources/walletRollupMnemonic.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
});

describe('CREATE KEYS IMPORT', () => {
  it('createkeys import', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ./src/resources/wallet-test.json --pass ${pass} --path ./src/resources/walletRollupImport.json`, () => {
      const readWalletImport = fs.readFileSync('../src/resources/walletRollupImport.json', 'utf8');
      expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
      process.exec('rm ../src/resources/walletRollupImport.json');
      done();
    });
  });
  it('createkeys import default path', (done) => {
    process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ./src/resources/wallet-test.json --pass ${pass}`, () => {
      const readWalletImport = fs.readFileSync(walletPathDefault, 'utf8');
      expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
      done();
    });
  });
  it('createkeys import error', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ./src/resources/wallet-testttt.json --pass ${pass} --path ./src/resources/walletRollupImport.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys import error password', (done) => {
    const out = process.exec('cd ..; node cli.js createkeys --keytype rollup --import ./src/resources/wallet-test.json --path ./src/resources/walletRollupImport.json');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('createkeys import error keytype', (done) => {
    const out = process.exec(`cd ..; node cli.js createkeys --import ./src/resources/wallet-test.json --pass ${pass} --path ./src/resources/walletRollupImport.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
});

describe('ONCHAINTX deposit', () => {
  it('onchaintx deposit default config.json', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2 --tokenid 0`);
    out.stdout.on('data', (data) => {
      expect(JSON.parse(data).depositAmount._hex).to.be.equal('0x02');
      expect(JSON.parse(data).tokenId._hex).to.be.equal('0x00');
      done();
    });
  });
  it('onchaintx deposit error pass', (done) => {
    const out = process.exec('cd ..; node cli.js onchaintx --type deposit --amount 2 --tokenid 0');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('onchaintx deposit error amount', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --tokenid 0`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('onchaintx deposit error token id', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  /* it('onchaintx deposit', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2 --tokenid 0 --paramsTx ./src/resources/config-example.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('onchaintx deposit error config file', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 10 --paramsTx ./src/resources/config-examplee.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  }); */
});

describe('ONCHAINTX depositOnTop', () => {
  it('onchaintx deposit default config.json', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${pass} --amount 2 --tokenid 0`);
    out.stdout.on('data', (data) => {
      expect(data).to.be.equal('depositOnTopTx\n');
      done();
    });
  });
});

describe('ONCHAINTX withdraw', () => {
  it('onchaintx deposit default config.json', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type withdraw --pass ${pass} --amount 2 --tokenid 0`);
    out.stdout.on('data', (data) => {
      expect(data).to.be.equal('withdrawTx\n');
      done();
    });
  });
});

describe('ONCHAINTX forceWithdraw', () => {
  it('onchaintx deposit default config.json', (done) => {
    const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw --pass ${pass} --amount 2 --tokenid 0`);
    out.stdout.on('data', (data) => {
      expect(data).to.be.equal('forceWithdrawTx\n');
      done();
    });
  });
});

describe('OFFCHAINTX', () => {
  it('offchaintx send', (done) => {
    const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --to 12 --paramsTx ./src/resources/config-example.json`);
    out.stdout.on('data', (data) => {
      expect('200\n').to.be.equal(data);
      done();
    });
  });
  it('offchaintx send default config.json', (done) => {
    const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --to 12`);
    out.stdout.on('data', (data) => {
      expect('200\n').to.be.equal(data);
      done();
    });
  });
  it('offchaintx send error pass', (done) => {
    const out = process.exec('cd ..; node cli.js offchaintx --type send --amount 2 --to 12 --paramsTx ./src/resources/config-example.json');
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it('offchaintx send error amount', (done) => {
    const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --to 12 --paramsTx ./src/resources/config-example.json`);
    out.on(' exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it(' offchaintx send error recipient', (done) => {
    const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --paramsTx ./src/resources/config-example.json`);
    out.on(' exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
  it(' offchaintx send error config file', (done) => {
    const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --to 12 --paramsTx ./src/resources/config-examplee.json`);
    out.on('exit', (code) => {
      expect(code).to.not.be.equal(0);
      done();
    });
  });
});
