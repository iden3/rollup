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

const { expect } = chai;

describe('CREATE KEYS RANDOM', async function () {
    this.timeout(10000);

    it('createkeys random', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup -p ${pass} -w ${walletRollupTest}`, () => {
            const readWallet = fs.readFileSync(`${walletRollup}`, 'utf-8');
            expect(readWallet).to.not.be.equal(undefined);
            process.exec(`rm ${walletRollup}`);
            done();
        });
    });

    it('createkeys random default path', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup -p ${pass}`, () => {
            const readWallet = fs.readFileSync(walletPathDefault, 'utf8');
            expect(readWallet).to.not.be.equal(undefined);
            done();
        });
    });

    it('createkeys error password', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup -w ${walletRollupTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -p ${pass} -w ${walletRollupTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('CREATE KEYS MNEMONIC', async function () {
    this.timeout(10000);
    it('createkeys mnemonic', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -p ${pass} -w ${walletMnemonicTest}`, () => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletMnemonic}`);
            done();
        });
    });

    it('createkeys mnemonic default path', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -p ${pass}`, () => {
            const readWalletMnemonic = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletPathDefault}`);
            done();
        });
    });

    it('createkeys mnemonic error', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic obscure property tackle faculty fresh gas clerk order silver answer belt brother -p ${pass} -w ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });

    it('createkeys mnemonic error 2', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt" -p ${pass} -w ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });

    it('createkeys mnemonic error password', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -w ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys mnemonic error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -p ${pass} -w ${walletMnemonicTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('CREATE KEYS IMPORT', async function () {
    this.timeout(10000);
    it('create wallet to import', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -p ${pass} -w ${walletMnemonicTest}`, () => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            done();
        });
    });

    it('createkeys import', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup --import ${walletMnemonicTest} -p ${pass} -w ${walletImportTest}`, () => {
            const readWalletImport = fs.readFileSync(`${walletImport}`, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletImport}`);
            done();
        });
    });

    it('createkeys import default path', (done) => {
        process.exec(`cd ..; node cli.js createkeys -k rollup --import ${walletMnemonicTest} -p ${pass}`, () => {
            const readWalletImport = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            done();
        });
    });

    it('createkeys import error', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup --import ./no-wallet.json -p ${pass} -w ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('createkeys import error password', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys -k rollup --import ${walletMnemonicTest} -w ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PASS);
            done();
        });
    });

    it('createkeys import error keytype', (done) => {
        const out = process.exec(`cd ..; node cli.js createkeys --import ${walletMnemonicTest} -p ${pass} -w ${walletImportTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_KEY_TYPE);
            done();
        });
    });
});

describe('ONCHAINTX deposit', async function () {
    this.timeout(10000);

    it('setparam wallet', (done) => {
        process.exec(`cd ..; node cli.js setparam --param wallet --value ./test/resources/wallet-test.json -c ${configTest}`);
        process.exec('cd ..; node cli.js setparam --param wallet --value ./test/resources/wallet-test.json');
        done();
    });

    it('onchaintx deposit', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit -p ${pass} --loadamount 2 --tokenid 0 -c ${configTest}`);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data)['Transaction Hash']).to.be.a('string');
            done();
        });
    });

    it('onchaintx deposit default config.json', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit -p ${pass} --loadamount 2 --tokenid 0`);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data)['Transaction Hash']).to.be.a('string');
            done();
        });
    });

    it('onchaintx deposit error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx deposit error loadamount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit -p ${pass} --tokenid 0`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx deposit error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type deposit -p ${pass} --loadamount 2`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX depositOnTop', async function () {
    this.timeout(10000);

    it('onchaintx depositontop', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop -p ${pass} --recipient 1 --loadamount 2 --tokenid 0 -c ${configTest} `);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data)['Transaction Hash']).to.be.a('string');
            done();
        });
    });

    it('onchaintx depositontop default config.json', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop -p ${pass}  -r 1 --loadamount 2 --tokenid 0`);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data)['Transaction Hash']).to.be.a('string');
            done();
        });
    });

    it('onchaintx depositontop error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type depositontop -r 1 --loadamount 2 --tokenid 0');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error loadamount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop -p ${pass} -r 1 --tokenid 0`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error recipient', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop -p ${pass}--loadamount 2 --tokenid 0 -c ${configTest} `);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type depositontop -p ${pass} --loadamount 2`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX forceWithdraw', async function () {
    this.timeout(10000);
    it('onchaintx forcewithdraw', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw -p ${pass} --id 2 --amount 2 -c ${configTest}`);
        out.stdout.on('data', (data) => {
            expect(JSON.parse(data)['Transaction Hash']).to.be.a('string');
            done();
        });
    });

    it('onchaintx forcewithdraw error pass', (done) => {
        const out = process.exec('cd ..; node cli.js onchaintx --type forceWithdraw --amount 2 --id 2');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx forcewithdraw error id', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw -p ${pass} --amount 2 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx forcewithdraw error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js onchaintx --type forceWithdraw -p ${pass} --id 2`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('OFFCHAINTX', async function () {
    this.timeout(10000);
    it('offchaintx send', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send -p ${pass} --amount 2 --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`);
        out.stdout.on('data', (data) => {
            expect('200\n').to.be.equal(data);
            done();
        });
    });

    it('offchaintx send error pass', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error amount', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send -p ${pass} --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error sender', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 -p ${pass} --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error recipient', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 -p ${pass} --sender 2 --tokenid 0 --fee 1 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error token id', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 -p ${pass} --sender 2 --recipient 12 --fee 1 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error fee', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send --amount 2 -p ${pass} --tokenid 0 --sender 2 --recipient 12 -c ${configTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('INFO', async function () {
    this.timeout(10000);

    it('accounts babyjubjub', (done) => {
        const out = process.exec('cd ..; node cli.js info --type accounts --filter babyjubjub');
        out.stdout.on('data', (data) => {
            // Returns array of accounts in string format on the stdout
            expect(data).to.be.a('string');
            done();
        });
    });

    it('accounts ethereum', (done) => {
        const out = process.exec('cd ..; node cli.js info --type accounts --filter ethereum');
        out.stdout.on('data', (data) => {
            // Returns array of accounts in string format on the stdout
            expect(data).to.be.a('string');
            done();
        });
    });

    it('exits', (done) => {
        const out = process.exec('cd ..; node cli.js info --type exits --id 1');
        out.stdout.on('data', (data) => {
            // Returns array containing all batches where the id account has en exit leaf
            expect(data).to.be.a('string');
            done();
        });
    });

    it('error no type', (done) => {
        const out = process.exec('cd ..; node cli.js info');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_TYPE);
            done();
        });
    });

    it('error invalid type', (done) => {
        const out = process.exec('cd ..; node cli.js info --type random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_TYPE);
            done();
        });
    });

    it('error invalid filter', (done) => {
        const out = process.exec('cd ..; node cli.js info --type accounts --filter random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_FILTER);
            done();
        });
    });

    it('error invalid command', (done) => {
        const out = process.exec('cd ..; node cli.js random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('error missing filter parameter', (done) => {
        const out = process.exec('cd ..; node cli.js info --type accounts');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('General', async function () {
    this.timeout(10000);

    it('error invalid command', (done) => {
        const out = process.exec('cd ..; node cli.js random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('error invalid config path', (done) => {
        const out = process.exec(`cd ..; node cli.js offchaintx --type send -p ${pass} --amount 2 --to 12 --tokenid 0 --fee 1 -c ./resources/config-examplee.json`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAMS_FILE);
            done();
        });
    });

    after(async () => {
        await deleteResources();
    });
});
