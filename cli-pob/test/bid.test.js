const process = require('child_process');
const fs = require('fs');
const path = require('path');

const { expect } = require('chai');
const { error } = require('../src/list-errors');

const walletTest = path.join(__dirname, '../wallet-test.json');
const pass = 'foo';
const auxAccount = '0xe1b2676bD69A76c3E689D7D584f050fCfd17DcaF';


describe('BID', function () {
    this.timeout(10000);

    it('Should bid', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 2 -s 4 -u localhost`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
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

    it('Should bid again', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 3 -s 4 -u localhost`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
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

    it('Should bid with different beneficiary', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 2 -s 5 -u localhost -b ${auxAccount}`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
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

    it('Should bid relay', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 3 -s 5 -u localhost -b ${auxAccount} -f ${auxAccount}`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
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

    it('Should bid relay and withdraw address', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 4 -s 5 -u localhost -b ${auxAccount} -f ${auxAccount} --wd ${auxAccount}`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 4);
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

    it('Should bid with gas limit and gas multipliers parameters', (done) => {
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const gasLimit = 2000000;
                const gasMultiplier = 2;
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} `
                + `-a 2 -s 6 -u localhost --gl ${gasLimit} --gm ${gasMultiplier}`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 2);
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

    it('Should bid with different config path', (done) => {
        const command = process.exec(`mv config.json config-test.json; node cli-pob.js balance -c config-test.json -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -c config-test.json -w ${walletTest} -a 3 -s 6 -u localhost`);
                out.stdout.on('data', (data) => {
                    if ((data.toString()).includes('Password:')) {
                        out.stdin.write(`${pass}\n`);
                    }
                    if (data.toString().includes('Transaction')) {
                        const outBalance2 = process.exec(`node cli-pob.js balance -c config-test.json -w ${walletTest}`);
                        outBalance2.stdout.on('data', (balance2Res) => {
                            if ((balance2Res.toString()).includes('Password:')) {
                                outBalance2.stdin.write(`${pass}\n`);
                            }
                            const balance2 = balance2Res.toString();
                            if (Number(balance2)) {
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 3);
                                process.exec('mv config-test.json config.json');
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

    it('Should bid relay and withdraw address and bonusAddress', (done) => {
        const wallet = JSON.parse(fs.readFileSync(walletTest, 'utf8'));
        const bonusAddress = `0x${wallet.address}`;
        const command = process.exec(`node cli-pob.js balance -w ${walletTest}`);
        command.stdout.on('data', (balanceRes) => {
            if ((balanceRes.toString()).includes('Password:')) {
                command.stdin.write(`${pass}\n`);
            }
            const balance = balanceRes.toString();
            if (Number(balance)) {
                const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 4 -s 6 -u localhost -b ${auxAccount} -f ${auxAccount} --wd ${auxAccount} --bo ${bonusAddress} --ub ${true}`);
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
                                expect(parseInt(balance, 10)).to.be.equal(parseInt(balance2, 10) + 4);
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
        const out = process.exec(`node cli-pob.js bi -w ${walletTest} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it('Register invalid path', (done) => {
        const out = process.exec('node cli-pob.js bid -w wallet-no.json -a 4 -s 6 -u localhost');
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it('Register invalid param', (done) => {
        const out = process.exec(`node cli-pob.js bid -w ${walletTest} -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it('Register invalid wallet or password', (done) => {
        const out = process.exec(`node cli-pob.js bid -w ${walletTest} -a 4 -s 6 -u localhost`);
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
        const out = process.exec(`mv config.json config-test.json; node cli-pob.js bid -w ${walletTest} -a 4 -s 6 -u localhost`);
        out.on('exit', (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec('mv config-test.json config.json');
            done();
        });
    });

    it('Should Withdraw', (done) => {
        const out = process.exec(`node cli-pob.js withdraw -w ${walletTest}`);
        out.stdout.on('data', (data) => {
            if ((data.toString()).includes('Password:')) {
                out.stdin.write(`${pass}\n`);
            }
            if (data.includes('Transaction')) { done(); }
        });
        out.on('exit', (code) => {
            expect(code).to.be.equal(0);
        });
    });
});
