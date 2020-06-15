const process = require('child_process');
const path = require('path');

const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, '../wallet-test.json');
const pass = 'foo';

describe('WITHDRAW', async function () {
    this.timeout(50000);

    it('Should Withdraw', (done) => {
        const outBid = process.exec(`node cli-pob.js bid -w ${walletTest} -a 1 -s 10 -u localhost`);
        outBid.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                outBid.stdin.write(`${pass}\n`);
            }
            if (data.toString().includes('Transaction')) {
                const outBid2 = process.exec(`node cli-pob.js bid -w ${walletTest} -a 2 -s 10 -u localhost`);
                outBid2.stdout.on('data', (data2) => {
                    if ((data2.toString()).includes('Password:')) {
                        outBid2.stdin.write(`${pass}\n`);
                    }
                    if (data2.toString().includes('Transaction')) {
                        const outBalance = process.exec(`node cli-pob.js balance -w ${walletTest}`);
                        outBalance.stdout.on('data', (balanceRes) => {
                            if ((balanceRes.toString()).includes('Password:')) {
                                outBalance.stdin.write(`${pass}\n`);
                            }
                            const balance = balanceRes.toString();
                            if (Number(balance)) {
                                const out = process.exec(`node cli-pob.js withdraw -w ${walletTest}`);
                                out.stdout.on('data', (data3) => {
                                    if ((data3.toString()).includes('Password:')) {
                                        out.stdin.write(`${pass}\n`);
                                    }
                                    if (data3.toString().includes('Transaction')) {
                                        const outBalance2 = process.exec(`node cli-pob.js balance -w ${walletTest}`);
                                        outBalance2.stdout.on('data', (balance2Res) => {
                                            if ((balance2Res.toString()).includes('Password:')) {
                                                outBalance2.stdin.write(`${pass}\n`);
                                            }
                                            const balance2 = balance2Res.toString();
                                            if (Number(balance2)) {
                                                expect((Number(balance2) - Number(balance)).toFixed()).to.be.equal('1');
                                                done();
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    it('No double withdraw', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w ${walletTest}`);
        out.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                out.stdin.write(`${pass}\n`);
            }
        });
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });

    it('Withdraw invalid command', (done) => {
        const out = process.exec(`node cli-pob.js withdra -w ${walletTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Withdraw invalid path', (done) => {
        const out = process.exec('node cli-pob.js withdraw -w wallet-no.json');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Withdraw invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w ${walletTest}`);
        out.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                out.stdin.write('fii\n');
            }
        });
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it('Withdraw no config file', (done) => {
        const out = process.exec(`mv config.json config-test.json; node cli-pob.js withdraw -w ${walletTest}`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });
});
