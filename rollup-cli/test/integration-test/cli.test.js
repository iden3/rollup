const fs = require('fs');
const process = require('child_process');
const { spawn } = require('child_process');
const { expect } = require('chai');
const path = require('path');

const { error } = require('../../helpers/list-errors');
const { deleteResources } = require('./config/build-resources');
const { Wallet } = require('../../src/utils/wallet');

const walletPathDefault = path.join(__dirname, '../../wallet.json');
const walletRollupTest = path.join(__dirname, './resources/wallet-rollup.json');
const walletMnemonic = path.join(__dirname, './resources/wallet-mnemonic.json');
const walletPathDefaultTest = path.join(__dirname, './resources/wallet-test.json');

const configTest = path.join(__dirname, './resources/config-test.json');
const pass = 'foo';


describe('CREATE KEYS RANDOM', function () {
    this.timeout(10000);

    it('createkeys random', (done) => {
        const command = spawn(`node cli.js createkeys -w ${walletRollupTest}`, {
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
        const command = spawn('node cli.js createkeys', {
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
        const command = spawn('node cli.js createkeys', {
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
        const command = spawn(`node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother" -w ${walletMnemonic}`, {
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
        const command = spawn('node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt brother"', {
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
        const command = spawn(`node cli.js createkeys --mnemonic obscure property tackle faculty fresh gas clerk order silver answer belt brother -w ${walletMnemonic}`, {
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
        const command = spawn(`node cli.js createkeys --mnemonic "obscure property tackle faculty fresh gas clerk order silver answer belt" -w ${walletMnemonic}`, {
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

describe('ONCHAINTX deposit', async function () {
    this.timeout(10000);

    it('setparam wallet', (done) => {
        process.exec(`node cli.js setparam --param wallet --value ${walletPathDefaultTest} -c ${configTest}`);
        process.exec(`node cli.js setparam --param wallet --value ${walletPathDefaultTest}`);
        done();
    });

    it('onchaintx deposit', (done) => {
        const command = spawn(`node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0 -c ${configTest}`, {
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
        const command = spawn('node cli.js onchaintx --type deposit --loadamount 2 --tokenid 0', {
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
        const command = spawn('node cli.js onchaintx --type deposit --tokenid 0', {
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
        const command = spawn('node cli.js onchaintx --type deposit --loadamount 2', {
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

    let recipient;
    before(async () => {
        const wallet = JSON.parse(fs.readFileSync(`${walletPathDefaultTest}`, 'utf-8'));
        const walletRollup = await Wallet.fromEncryptedJson(wallet, pass);
        recipient = walletRollup.babyjubWallet.publicKeyCompressed.toString('hex');
    });

    it('onchaintx depositontop', (done) => {
        const command = spawn(`node cli.js onchaintx --type depositontop --recipient ${recipient} --loadamount 2 --tokenid 0 -c ${configTest} `, {
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
        const command = spawn(`node cli.js onchaintx --type depositontop  -r ${recipient} --loadamount 2 --tokenid 0`, {
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
        const command = spawn(`node cli.js onchaintx --type depositontop -r ${recipient} --loadamount 2 --tokenid 0`, {
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
        const command = spawn(`node cli.js onchaintx --type depositontop -r ${recipient} --tokenid 0`, {
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
        const command = spawn(`node cli.js onchaintx --type depositontop --loadamount 2 --tokenid 0 -c ${configTest}`, {
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
        const command = spawn(`node cli.js onchaintx --type depositontop -r ${recipient} --loadamount 2`, {
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
        const command = spawn(`node cli.js onchaintx --type forceWithdraw --amount 2 --tokenid 0 -c ${configTest}`, {
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
        const command = spawn('node cli.js onchaintx --type forceWithdraw --amount 2 --tokenid 0', {
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

    it('onchaintx forcewithdraw error amount', (done) => {
        const command = spawn('node cli.js onchaintx --type forceWithdraw --tokenid 0', {
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
    this.timeout(20000);

    let recipient;
    before(async () => {
        const wallet = JSON.parse(fs.readFileSync(`${walletPathDefaultTest}`, 'utf-8'));
        const walletRollup = await Wallet.fromEncryptedJson(wallet, pass);
        recipient = walletRollup.babyjubWallet.publicKeyCompressed.toString('hex');
    });

    it('offchaintx send', (done) => {
        const command = spawn(`node cli.js offchaintx --type send --amount 2  -r ${recipient} --tokenid 0 --fee 10% -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Status: 200, Nonce: ')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('offchaintx withdraw', (done) => {
        const command = spawn(`node cli.js offchaintx --type withdrawOffChain --amount 2 --tokenid 0 --fee 50% -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Status: 200, Nonce: ')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('offchaintx deposit', (done) => {
        const ethAddr = '0x123456789ABCDEF123456789ABCDEF123456789A';
        const command = spawn(`node cli.js offchaintx --type depositOffChain --amount 2 -r ${recipient} --tokenid 0 --fee 50% -c ${configTest} --ethaddr ${ethAddr}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Status: 200, Nonce: ')) {
                done();
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('offchaintx send error pass', (done) => {
        const command = spawn(`node cli.js offchaintx --type send --amount 2  -r ${recipient} --tokenid 0 --fee 10% -c ${configTest}`, {
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
        const command = spawn(`node cli.js offchaintx --type send  -r ${recipient} --tokenid 0 --fee 10% -c ${configTest}`, {
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
        const command = spawn(`node cli.js offchaintx --type send --amount 2 --tokenid 0 --fee 10% -c ${configTest}`, {
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
        const command = spawn(`node cli.js offchaintx --type send --amount 2 -r ${recipient} --fee 50% -c ${configTest}`, {
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
        const command = spawn(`node cli.js offchaintx --type send --amount 2 --tokenid 0 -r ${recipient} -c ${configTest}`, {
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

    it('offchaintx send error no valid fee', (done) => {
        const command = spawn(`node cli.js offchaintx --type send --amount 2 --tokenid 0 -r ${recipient} --fee 30% -c ${configTest}`, {
            shell: true,
        });
        command.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_FEE);
            done();
        });
    });

    it('offchaintx send deposit ether address', (done) => {
        const command = spawn(`node cli.js offchaintx --type depositOffChain --amount 2 --tokenid 0 -r ${recipient} --fee 10% -c ${configTest}`, {
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
        const out = process.exec('node cli.js info --type accounts --filter babyjubjub');
        out.stdout.on('data', (data) => {
            // Returns array of accounts in string format on the stdout
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
            done();
        });
    });

    it('accounts ethereum', (done) => {
        const out = process.exec('node cli.js info --type accounts --filter ethereum');
        out.stdout.on('data', (data) => {
            // Returns array of accounts in string format on the stdout
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
            done();
        });
    });

    it('accounts tokenId', (done) => {
        const out = process.exec('node cli.js info --type accounts --filter tokenId --tk 1');
        out.stdout.on('data', (data) => {
            // Returns single state account in string format on the stdout
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
            done();
        });
    });

    it('exits', (done) => {
        const out = process.exec('node cli.js info --type exits --tk 1');
        out.stdout.on('data', (data) => {
            // Returns array containing all batches where the rollup account has en exit leaf
            expect(data).to.be.a('string');
        });
        out.on('exit', () => {
            done();
        });
    });

    it('error no type', (done) => {
        const out = process.exec('node cli.js info');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_TYPE);
            done();
        });
    });

    it('error invalid type', (done) => {
        const out = process.exec('node cli.js info --type random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_TYPE);
            done();
        });
    });

    it('error invalid filter', (done) => {
        const out = process.exec('node cli.js info --type accounts --filter random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_FILTER);
            done();
        });
    });

    it('error invalid command', (done) => {
        const out = process.exec('node cli.js random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('error missing filter parameter', (done) => {
        const out = process.exec('node cli.js info --type accounts');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
});

describe('General', async function () {
    this.timeout(10000);

    it('error invalid command', (done) => {
        const out = process.exec('node cli.js random');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('error invalid config path', (done) => {
        const command = spawn('node cli.js offchaintx --type send --amount 2 --to 12 --tokenid 0 --fee 10% -c ./resources/config-examplee.json', {
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
