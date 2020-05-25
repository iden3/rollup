const path = require('path');
const process = require('child_process');
const { expect } = require('chai');

const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, 'wallet-test.json');
const pass = 'foo';

describe('UNREGISTER', async function () {
    this.timeout(10000);

    it('Should unregister', (done) => {
        const register = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost`);
        register.stdout.on('data', () => {
            const out = process.exec(`node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 2`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                done();
            });
        });
    });

    it('Should unregister with different config path', (done) => {
        const register = process.exec(`mv config.json config-test.json; node cli-pos.js register -f config-test.json -w ${walletTest} -p ${pass} -s 2 -u localhost`);
        register.stdout.on('data', () => {
            const out = process.exec(`node cli-pos.js unregister -f config-test.json -w ${walletTest} -p ${pass} -i 3`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                process.exec('mv config-test.json config.json');
                done();
            });
        });
    });

    it('No double unregister', (done) => {
        const out = process.exec(`node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 2`);
        out.stdout.on('data', (data) => {
            expect(data.includes('Transaction hash: ')).to.be.equal(true);
        });
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });

    it('Unregister invalid command', (done) => {
        const out = process.exec(`node cli-pos.js unregiste -w ${walletTest} -p ${pass} -i 1`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Unregister invalid path', (done) => {
        const out = process.exec(`node cli-pos.js unregister -w wallet-no.json -p ${pass} -i 1`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Unregister invalid param', (done) => {
        const out = process.exec(`node cli-pos.js unregister -w ${walletTest} -p ${pass}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('Unregister invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pos.js unregister -w ${walletTest} -p fii -i 1`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it('Unregister no config file', (done) => {
        const out = process.exec(`mv config.json config-test.json; node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 1`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });
});
