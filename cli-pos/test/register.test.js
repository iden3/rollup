const path = require('path');
const process = require('child_process');
const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, 'wallet-test.json');
const pass = 'foo';

describe('REGISTER', async function () {
    this.timeout(10000);

    it('Should register', (done) => {
        const outBalance = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should register again', (done) => {
        const outBalance = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should register with different beneficiary', (done) => {
        const outBalance = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost 
            -b 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should register relay', (done) => {
        const outBalance = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost 
            -b 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF -c 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should register with gas limit and gas multipliers parameters', (done) => {
        const outBalance = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const gasLimit = 2000000;
            const gasMultiplier = 2;
            const out = process.exec(`node cli-pos.js register -w ${walletTest} `
                + `-p ${pass} -s 2 -u localhost --gl ${gasLimit} --gm ${gasMultiplier}`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should register with different config path', (done) => {
        const outBalance = process.exec(`mv config.json config-test.json; node cli-pos.js balance -f config-test.json -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`node cli-pos.js register -f config-test.json -w ${walletTest} -p ${pass} -s 2 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`node cli-pos.js balance -f config-test.json -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    process.exec('mv config-test.json config.json');
                    done();
                });
            });
        });
    });

    it('Register invalid command', (done) => {
        const out = process.exec(`node cli-pos.js registe -w ${walletTest} -p ${pass} -s 2 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Register invalid path', (done) => {
        const out = process.exec(`node cli-pos.js register -w wallet-no.json -p ${pass} -s 2 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Register invalid param', (done) => {
        const out = process.exec(`node cli-pos.js register -w ${walletTest} -p ${pass} -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('Register invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pos.js register -w ${walletTest} -p fii -s 2 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it('Register no config file', (done) => {
        const out = process.exec(`mv config.json config-test.json; node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });
});
