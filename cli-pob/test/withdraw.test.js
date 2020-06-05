const process = require('child_process');
const path = require('path');

const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, '../wallet-test.json');
const pass = 'foo';

describe('WITHDRAW', async function () {
    this.timeout(50000);

    it('Should Withdraw', (done) => {
        const outBid = process.exec(`node cli-pob.js bid -w ${walletTest} -p ${pass} -a 1 -s 10 -u localhost`);
        outBid.stdout.on('data', (data) => {
            expect(data.includes('Transaction hash: ')).to.be.equal(true);
            const outBid2 = process.exec(`node cli-pob.js bid -w ${walletTest} -p ${pass} -a 2 -s 10 -u localhost`);
            outBid2.stdout.on('data', (data2) => {
                expect(data2.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance = process.exec(`node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance.stdout.on('data', (balance) => {
                    const out = process.exec(`node cli-pob.js withdraw -w ${walletTest} -p ${pass}`);
                    out.stdout.on('data', (data3) => {
                        expect(data3.includes('Transaction hash: ')).to.be.equal(true);
                        const outBalance2 = process.exec(`node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                        outBalance2.stdout.on('data', (balance2) => {
                            expect(Math.floor(parseFloat(balance2) - parseFloat(balance))).to.be.equal(1);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('No double withdraw', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w ${walletTest} -p ${pass}`);
        out.stdout.on('data', (data) => {
            expect(data.includes('Transaction hash: ')).to.be.equal(true);
        });
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });

    it('Withdraw invalid command', (done) => {
        const out = process.exec(`node cli-pob.js withdra -w ${walletTest} -p ${pass}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Withdraw invalid path', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w wallet-no.json -p ${pass}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Withdraw invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w ${walletTest} -p fii`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it('Withdraw no config file', (done) => {
        const out = process.exec(`mv config.json config-test.json; node cli-pob.js withdraw -w ${walletTest} -p ${pass}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });
});
