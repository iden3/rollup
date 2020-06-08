const process = require('child_process');
const path = require('path');

const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, '../wallet-test.json');
const pass = 'foo';


describe('MULTIBID', async function () {
    this.timeout(10000);

    it('Should multibid', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js multibid -w ${walletTest} -a 1,2,3 -s 11-13,16-20,23-24 -u localhost`);
                out.stdout.on('data', (data) => {
                    if ((data.toString()).includes('Password:')) {
                        out.stdin.write(`${pass}\n`);
                    }
                    if (data.toString().includes('Transaction')) {
                        const outBalance2 = process.exec(`node cli-pob.js balance -w ${walletTest}`);
                        outBalance2.stdout.on('data', (balance2Res) => {
                            if ((balance2Res.toString()).includes('Password:')) {
                                outBalance2.stdin.write(`${pass}\n`);
                            }
                            const balance2 = balance2Res.toString();
                            if (Number(balance2)) {
                                expect((Number(balance) - Number(balance2)).toFixed()).to.be.equal('19');
                                done();
                            }
                        });
                        outBalance2.on('exit', (code) => {
                            expect(code).to.be.equal(0);
                        });
                    }
                });
                out.on('exit', (code) => {
                    expect(code).to.be.equal(0);
                });
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('Should multibid again', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js multibid -w ${walletTest} -a 1,2,3 -s 25,26-30,33-34 -u localhost`);
                out.stdout.on('data', (data) => {
                    if ((data.toString()).includes('Password:')) {
                        out.stdin.write(`${pass}\n`);
                    }
                    if (data.toString().includes('Transaction')) {
                        const outBalance2 = process.exec(`node cli-pob.js balance -w ${walletTest}`);
                        outBalance2.stdout.on('data', (balance2Res) => {
                            if ((balance2Res.toString()).includes('Password:')) {
                                outBalance2.stdin.write(`${pass}\n`);
                            }
                            const balance2 = balance2Res.toString();
                            if (Number(balance2)) {
                                expect((Number(balance) - Number(balance2)).toFixed()).to.be.equal('17');
                                done();
                            }
                        });
                        outBalance2.on('exit', (code) => {
                            expect(code).to.be.equal(0);
                        });
                    }
                });
                out.on('exit', (code) => {
                    expect(code).to.be.equal(0);
                });
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('Should multibid again', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js multibid -w ${walletTest} -a 3 -s 35-37 -u localhost`);
                out.stdout.on('data', (data) => {
                    if ((data.toString()).includes('Password:')) {
                        out.stdin.write(`${pass}\n`);
                    }
                    if (data.toString().includes('Transaction')) {
                        const outBalance2 = process.exec(`node cli-pob.js balance -w ${walletTest}`);
                        outBalance2.stdout.on('data', (balance2Res) => {
                            if ((balance2Res.toString()).includes('Password:')) {
                                outBalance2.stdin.write(`${pass}\n`);
                            }
                            const balance2 = balance2Res.toString();
                            if (Number(balance2)) {
                                expect((Number(balance) - Number(balance2)).toFixed()).to.be.equal('9');
                                done();
                            }
                        });
                        outBalance2.on('exit', (code) => {
                            expect(code).to.be.equal(0);
                        });
                    }
                });
                out.on('exit', (code) => {
                    expect(code).to.be.equal(0);
                });
            }
        });
        command.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });

    it('Register invalid command', (done) => {
        const out = process.exec(`node cli-pob.js multibi -w ${walletTest} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Register invalid path', (done) => {
        const out = process.exec('node cli-pob.js multibid -w wallet-no.json -a 4 -s 6 -u localhost');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Register invalid param', (done) => {
        const out = process.exec(`node cli-pob.js multibid -w ${walletTest} -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('Register invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pob.js multibid -w ${walletTest} -a 4 -s 6 -u localhost`);
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

    it('Register no config file', (done) => {
        const out = process.exec(`mv config.json config-test.json; node cli-pob.js multibid -w ${walletTest} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });
});
