const process = require('child_process');
const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = 'wallet-test.json';
const pass = 'foo';

describe('BID', async function () {
    this.timeout(10000);

    it('Should bid', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 2 -s 4 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should bid again', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 3 -s 4 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
                    done();
                });
            });
        });
    });

    it('Should bid with different beneficiary', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 2 -s 5 -u localhost 
            -b 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should bid relay', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 3 -s 5 -u localhost 
            -b 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF -f 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
                    done();
                });
            });
        });
    });

    it('Should bid relay and withdraw address', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 4 -s 5 -u localhost 
            -b 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF -f 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF -w 0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 4);
                    done();
                });
            });
        });
    });

    it('Should bid with gas limit and gas multipliers parameters', (done) => {
        const outBalance = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const gasLimit = 2000000;
            const gasMultiplier = 2;
            const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} `
                + `-p ${pass} -a 2 -s 6 -u localhost --gl ${gasLimit} --gm ${gasMultiplier}`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
                    done();
                });
            });
        });
    });

    it('Should bid with different config path', (done) => {
        const outBalance = process.exec(`cd ..; mv config.json config-test.json; node cli-pob.js balance -f config-test.json -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on('data', (balance) => {
            const out = process.exec(`cd ..; node cli-pob.js bid -f config-test.json -w ${walletTest} -p ${pass} -a 3 -s 6 -u localhost`);
            out.stdout.on('data', (data) => {
                expect(data.includes('Transaction hash: ')).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pob.js balance -f config-test.json -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on('data', (balance2) => {
                    expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
                    process.exec('cd ..; mv config-test.json config.json');
                    done();
                });
            });
        });
    });

    it('Register invalid command', (done) => {
        const out = process.exec(`cd ..; node cli-pob.js bi -w ${walletTest} -p ${pass} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Register invalid path', (done) => {
        const out = process.exec(`cd ..; node cli-pob.js bid -w wallet-no.json -p ${pass} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Register invalid param', (done) => {
        const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p ${pass} -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('Register invalid wallet or password', (done) => {
        const out = process.exec(`cd ..; node cli-pob.js bid -w ${walletTest} -p fii -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it('Register no config file', (done) => {
        const out = process.exec(`cd ..; mv config.json config-test.json; node cli-pob.js bid -w ${walletTest} -p ${pass} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('cd ..; mv config-test.json config.json');
            done();
        });
    });

    it('Should Withdraw', (done) => {
        const out = process.exec(`cd ..; node cli-pob.js withdraw -w ${walletTest} -p ${pass}`);
        out.stdout.on('data', (data) => {
            expect(data.includes('Transaction hash: ')).to.be.equal(true);
            done();
        });
    });
});
