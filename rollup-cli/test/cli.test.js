const fs = require('fs');
const process = require('child_process');
const chai = require('chai');
const path = require('path');
const { error } = require('../src/list-errors');
const { deleteResources } = require('./config/build-resources');

const walletPathDefault = path.join(__dirname, '../wallet.json');
const walletRollupTest = path.join(__dirname, './resources/wallet-rollup.json');
const walletMnemonic = path.join(__dirname, './resources/wallet-mnemonic.json');
const walletImport = path.join(__dirname, './resources/wallet-import.json');

const configTest = './test/resources/config-test.json';
const pass = 'foo';
const { spawn } = require('child_process');

const { expect } = chai;


describe('CREATE KEYS RANDOM', function () {
    this.timeout(10000);

    it('createkeys random', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys -w ${walletRollupTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWallet = fs.readFileSync(`${walletRollupTest}`, 'utf-8');
            expect(readWallet).to.not.be.equal(undefined);
            expect(code).to.be.equal(0);
            process.exec(`rm ${walletRollupTest}`);
            done();
        });
    });

    it('createkeys random default path', (done) => {
        const command = spawn('cd ..; node cli.js createkeys', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWallet = fs.readFileSync(walletPathDefault, 'utf8');
            expect(readWallet).to.not.be.equal(undefined);
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys error password', (done) => {
        let first = true;
        const command = spawn('cd ..; node cli.js createkeys', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                if (first) {
                    command.stdin.write(`${pass}\n`);
                    first = false;
                } else { command.stdin.write('nope\n'); }
            }
        });

        command.on('exit', (code) => {
            expect(code).to.be.equal(error.PASSWORD_NOT_MATCH);
            done();
        });
    });
});

describe('CREATE KEYS MNEMONIC', async function () {
    this.timeout(10000);
    it('createkeys mnemonic', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -w ${walletMnemonic}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });

        command.on('exit', (code) => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletMnemonic}`);
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys mnemonic default path', (done) => {
        const command = spawn('cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother"', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWalletMnemonic = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys mnemonic error', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --mnemonic obscure property tackle faculty fresh gas clerk order silver answer belt brother -w ${walletMnemonic}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });

    it('createkeys mnemonic error 2', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt" -w ${walletMnemonic}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_MNEMONIC);
            done();
        });
    });
});

describe('CREATE KEYS IMPORT', async function () {
    this.timeout(10000);
    it('create wallet to import', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -w ${walletMnemonic}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWalletMnemonic = fs.readFileSync(`${walletMnemonic}`, 'utf8');
            expect(JSON.parse(readWalletMnemonic).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys import', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --import ${walletMnemonic} -w ${walletImport}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWalletImport = fs.readFileSync(`${walletImport}`, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            process.exec(`rm ${walletImport}`);
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys import default path', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --import ${walletMnemonic}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            const readWalletImport = fs.readFileSync(walletPathDefault, 'utf8');
            expect(JSON.parse(readWalletImport).ethWallet.address).to.be.equal('ea7863f14d1a38db7a5e937178fdb7dfa9c96ed7');
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('createkeys import error', (done) => {
        const command = spawn(`cd ..; node cli.js createkeys --import ./no-wallet.json -w ${walletImport}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('createkeys import error password', (done) => {
        let first = true;
        const command = spawn(`cd ..; node cli.js createkeys --import ${walletMnemonic} -w ${walletImport}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                if (first) {
                    command.stdin.write(`${pass}\n`);
                    first = false;
                } else { command.stdin.write('nope\n'); }
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.PASSWORD_NOT_MATCH);
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
        const command = spawn(`cd ..; node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction Hash')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx deposit default config.json', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction Hash')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx deposit error pass', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write('nope\n');
            }
            if ((data.toString()).includes('invalid password')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx deposit error loadamount', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type deposit --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx deposit error token id', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type deposit --loadamount 2', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX depositOnTop', async function () {
    this.timeout(10000);

    it('onchaintx depositontop', (done) => {
        const command = spawn(`cd ..; node cli.js onchaintx --type depositontop --recipient 1 --loadamount 2 --tokenid 0 -c ${configTest} `, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction Hash')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx depositontop default config.json', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type depositontop  -r 1 --loadamount 2 --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction Hash')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx depositontop error pass', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type depositontop -r 1 --loadamount 2 --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write('nope\n');
            }
            if ((data.toString()).includes('invalid password')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx depositontop error loadamount', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type depositontop -r 1 --tokenid 0', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error recipient', (done) => {
        const command = spawn(`cd ..; node cli.js onchaintx --type depositontop --loadamount 2 --tokenid 0 -c ${configTest} `, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx depositontop error token id', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type depositontop --loadamount 2', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('ONCHAINTX forceWithdraw', async function () {
    this.timeout(10000);
    it('onchaintx forcewithdraw', (done) => {
        const command = spawn(`cd ..; node cli.js onchaintx --type forceWithdraw --id 2 --amount 2 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction Hash')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx forcewithdraw error pass', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type forceWithdraw --amount 2 --id 2', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write('nope\n');
            }
            if ((data.toString()).includes('invalid password')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('onchaintx forcewithdraw error id', (done) => {
        const command = spawn(`cd ..; node cli.js onchaintx --type forceWithdraw --amount 2 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('onchaintx forcewithdraw error amount', (done) => {
        const command = spawn('cd ..; node cli.js onchaintx --type forceWithdraw --id 2', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('OFFCHAINTX', async function () {
    this.timeout(10000);
    it('offchaintx send', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Status: 200, Nonce: 0')) { done(); }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
            done();
        });
    });

    it('offchaintx send error pass', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write('nope\n');
            }
            if ((data.toString()).includes('invalid password')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('offchaintx send error amount', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --sender 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error sender', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --recipient 12 --tokenid 0 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error recipient', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --sender 2 --tokenid 0 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error token id', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --sender 2 --recipient 12 --fee 1 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('offchaintx send error fee', (done) => {
        const command = spawn(`cd ..; node cli.js offchaintx --type send --amount 2 --tokenid 0 --sender 2 --recipient 12 -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
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
        });
        out.on('exit', () => {
            done();
        });
    });

    it('accounts ethereum', (done) => {
        const out = process.exec('cd ..; node cli.js info --type accounts --filter ethereum');
        out.stdout.on('data', (data) => {
            // Returns array of accounts in string format on the stdout
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
            done();
        });
    });

    it('exits', (done) => {
        const out = process.exec('cd ..; node cli.js info --type exits --id 1');
        out.stdout.on('data', (data) => {
            // Returns array containing all batches where the id account has en exit leaf
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
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
        const command = spawn('cd ..; node cli.js offchaintx --type send --amount 2 --to 12 --tokenid 0 --fee 1 -c ./resources/config-examplee.json', {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAMS_FILE);
            done();
        });
    });

    after(async () => {
        await deleteResources();
    });
});
