const process = require("child_process");
const chai = require("chai");
const { error } = require("../list-errors");

const { expect } = chai;

const walletTest = "wallet-test.json";
const pass = "foo";

describe("UNREGISTER", async function () {
    this.timeout(10000);

    it("Unregister OK", (done) => {
        const register = process.exec(`cd ..; node cli-pos.js register -w ${walletTest} -p ${pass} -s 2 -u localhost`);
        register.stdout.on("data", () => {
            const out = process.exec(`cd ..; node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 2`);
            out.stdout.on("data", (data) => {
                expect(data[0]).to.be.equal("0");
                expect(data[1]).to.be.equal("x");
                done();
            });
        });
    });
    it("No doble unregister", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 2`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.ERROR);
            done();
        });
    });
    it("Unregister invalid command", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregiste -w ${walletTest} -p ${pass} -i 1`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_COMMAND);
            done();
        });
    });
    it("Unregister invalid path", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregister -w wallet-no.json -p ${pass} -i 1`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_PATH);
            done();
        });
    });
    it("Unregister invalid param", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregister -w ${walletTest} -p ${pass}`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.NO_PARAM);
            done();
        });
    });
    it("Unregister invalid wallet or password", (done) => {
        const out = process.exec(`cd ..; node cli-pos.js unregister -w ${walletTest} -p fii -i 1`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.INVALID_WALLET);
            done();
        });
    });
    it("Unregister no config file", (done) => {
        const out = process.exec(`cd ..; mv config.json config-test.json; node cli-pos.js unregister -w ${walletTest} -p ${pass} -i 1`);
        out.on("exit", (code) => {
            expect(code).to.be.equal(error.NO_CONFIG_FILE);
            process.exec("cd ..; mv config-test.json config.json");
            done();
        });
    });
});