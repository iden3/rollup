const process = require("child_process");
const chai = require("chai");
const { error } = require("../list-errors");

const { expect } = chai;

const walletTest = "wallet-test.json";
const pass = "foo";

describe("WITHDRAW", async function () {
    this.timeout(20000);

    it("Should Withdraw", (done) => {
        const outBalance = process.exec(`cd ..; node cli-pos.js balance -w ${walletTest} -p ${pass}`);
        outBalance.stdout.on("data", (balance) => {
            const out = process.exec(`cd ..; node cli-pos.js withdraw -w ${walletTest} -p ${pass} -i 2`);
            out.stdout.on("data", (data) => {
                expect(data.includes("Transaction hash: ")).to.be.equal(true);
                const outBalance2 = process.exec(`cd ..; node cli-pos.js balance -w ${walletTest} -p ${pass}`);
                outBalance2.stdout.on("data", (balance2) => {
                    expect(parseInt(balance2)).to.be.equal(parseInt(balance)+2);
                });
                done();
            }); 
        }); 
    });

    it("No double withdraw", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 2`);
        out.stdout.on("data", (data) => {
            expect(data.includes("Transaction hash: ")).to.be.equal(true);
        });
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });

    it("No withdraw without unregister", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js withdraw -w ${walletTest} -p ${pass} -i 1`);
        out.stdout.on("data", (data) => {
            expect(data.includes("Transaction hash: ")).to.be.equal(true);
        });
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });

    it("Withdraw invalid command", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js withdra -w ${walletTest} -p ${pass} -i 2`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });

    it("Withdraw invalid path", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js withdraw -w wallet-no.json -p ${pass} -i 2`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });

    it("Withdraw invalid param", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js withdraw -w ${walletTest} -p ${pass}`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });

    it("Withdraw invalid wallet or password", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js withdraw -w ${walletTest} -p fii -i 2`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });

    it("Withdraw no config file", (done) => {
        const out = process.exec(`cd ..; mv config.json config-test.json; node cli-pos.js withdraw -w ${walletTest} -p ${pass} -i 1`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec("cd ..; mv config-test.json config.json");
            done();
        });
    });
});