const fs = require('fs');
const process = require('child_process');
const chai = require('chai');
const path = require('path');
const { error } = require('../src/list-errors');
const { deleteResources } = require('./config/build-resources');

const walletPathDefault = path.join(__dirname, '../wallet.json');
const walletRollup = path.join(__dirname, './resources/wallet-rollup.json');
const walletRollupTest = './test/resources/wallet-rollup.json';
const walletMnemonic = path.join(__dirname, './resources/wallet-mnemonic.json');
const walletMnemonicTest = './test/resources/wallet-mnemonic.json';
const walletImport = path.join(__dirname, './resources/wallet-import.json');
const walletImportTest = './test/resources/wallet-import.json';

const configTest = './test/resources/config-test.json';
const pass = 'foo';
let ethAddress;

const { expect } = chai;

describe('CREATE KEYS RANDOM', async function () {
    this.timeout(10000);

    it('createkeys random', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --pass ${pass} --path ${walletRollupTest}`, () => {
            const readWallet = fs.readFileSync(`${walletRollup}`, 'utf-8');
            expect(readWallet).to.not.be.equal(undefined);
            process.exec(`rm ${walletRollup}`);
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
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --path ${walletRollupTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --pass ${pass} --path ${walletRollupTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('CREATE KEYS MNEMONIC', async function () {
    this.timeout(10000);
    it('createkeys mnemonic', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass} --path ${walletMnemonicTest}`, () => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletMnemonic}`);
            done();
        });
    });

    it('createkeys mnemonic default path', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass}`, () => {
            const readWalletMnemonic = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletPathDefault}`);
            done();
        });
    });

    it('createkeys mnemonic error', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic obscure property tackle faculty fresh gas clerk order silver answer belt brother --pass ${pass} --path ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });

    it('createkeys mnemonic error 2', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt" --pass ${pass} --path ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });

    it('createkeys mnemonic error password', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --path ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys mnemonic error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass} --path ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('CREATE KEYS IMPORT', async function () {
    this.timeout(10000);
    it('create wallet to import', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" --pass ${pass} --path ${walletMnemonicTest}`, () => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            done();
        });
    });

    it('createkeys import', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ${walletMnemonicTest} --pass ${pass} --path ${walletImportTest}`, () => {
            const readWalletImport = fs.readFileSync(`${walletImport}`, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletImport}`);
            done();
        });
    });

    it('createkeys import default path', (done) => {
        process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ${walletMnemonicTest} --pass ${pass}`, () => {
            const readWalletImport = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            done();
        });
    });

    it('createkeys import error', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ./no-wallet.json --pass ${pass} --path ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('createkeys import error password', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --keytype rollup --import ${walletMnemonicTest} --path ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys import error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --import ${walletMnemonicTest} --pass ${pass} --path ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('ONCHAINTX deposit', async function () {
    this.timeout(10000);

    it('setparam wallet', (done) => {
        process.exec(`cd ..; node cli.js setparam --param wallet --value ./test/resources/wallet-test.json --paramstx ${configTest}`);
        process.exec('cd ..; node cli.js setparam --param wallet --value ./test/resources/wallet-test.json');
        done();
    });

    it('onchaintx deposit', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2 --tokenid 0 --paramstx ${configTest}`);
        out.stdout.on('data', (data) => {
            ethAddress = JSON.parse(data).args.ethAddress;
            expect(JSON.parse(data).args.loadAmount._hex).to.be.equal('0x02');
            done();
        });
    });

    it('onchaintx deposit default config.json', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2 --tokenid 0`);
        out.stdout.on('data', (data) => {
            ethAddress = JSON.parse(data).args.ethAddress;
            expect(JSON.parse(data).args.loadAmount._hex).to.be.equal('0x02');
            done();
        });
    });

    it('onchaintx deposit error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type deposit --amount 2 --tokenid 0');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx deposit error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --tokenid 0`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx deposit error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit --pass ${pass} --amount 2`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX depositOnTop', async function () {
    this.timeout(10000);

    it('onchaintx depositontop', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${pass} --amount 2 --tokenid 0 --paramstx ${configTest} `);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data).args.loadAmount._hex).to.be.equal('0x02');
            done();
        });
    });

    it('onchaintx depositontop default config.json', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${pass} --amount 2 --tokenid 0`);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data).args.loadAmount._hex).to.be.equal('0x02');
            done();
        });
    });

    it('onchaintx depositontop error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type depositontop --amount 2 --tokenid 0');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${pass} --tokenid 0`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop --pass ${pass} --amount 2`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX forceWithdraw', async function () {
    this.timeout(10000);
    it('onchaintx forcewithdraw', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw --pass ${pass} --amount 2 --tokenid 0 --paramstx ${configTest}`);
        out.stdout.on('data', (data) => {
            expect(ethAddress).to.be.equal(JSON.parse(data).args.ethAddress);
            done();
        });
    });

    it('onchaintx forcewithdraw error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type forceWithdraw --amount 2');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx forcewithdraw error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw --pass ${pass}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('OFFCHAINTX', async function () {
    this.timeout(10000);
    it('offchaintx send', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --to 12 --tokenid 0 --fee 1 --paramstx ${configTest}`);
        out.stdout.on('data', (data) => {
            expect('200\n').to.be.equal(data);
            done();
        });
    });

    it('offchaintx send error pass', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 --to 12 --tokenid 0 --fee 1 --paramstx ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --to 12 --tokenid 0 --fee 1 --paramstx ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error recipient', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 --pass ${pass} --tokenid 0 --fee 1 --paramstx ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 --pass ${pass} --to 12 --fee 1 --paramstx ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error fee', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 --pass ${pass} --tokenid 0 --to 12 --paramstx ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it(' offchaintx send error config file', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --pass ${pass} --amount 2 --to 12 --tokenid 0 --fee 1 --paramstx ./resources/config-examplee.json`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAMS_FILE);
            done();
        });
    });

    after(async () => {
        await deleteResources();
    });
});
