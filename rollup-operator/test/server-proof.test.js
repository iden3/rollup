const axios = require("axios");
const chai = require("chai");
const { expect } = chai;
const { timeout } = require("../src/utils");
// This test assumes 'server-proof' is running locally on port 10001

describe("Server proof", async function () {
    // Set timeout to 10 seconds
    this.timeout(10000);

    const state = {
        IDLE: 0,
        ERROR: 1,
        PENDING: 2,
        FINISHED: 3,
    };

    const input = {
        key1: "value1",
        key2: "value2",
    };

    const port = 10001;

    it("Should get IDLE state", async () => {
        const res = await axios.get(`http://localhost:${port}/status`);
        expect(res.data.state).to.be.equal(state.IDLE);
    });

    it("Should post input", async () => {
        const res = await axios.post(`http://localhost:${port}/input`, input);
        expect(res.status).to.be.equal(200);
    });

    it("Should get PENDING state", async () => {
        const res = await axios.get(`http://localhost:${port}/status`);
        expect(res.data.state).to.be.equal(state.PENDING);
    });

    it("Should get FINISHED state and proof", async () => {
        // wait 5 seconds to server generate proof
        await timeout(6000);
        const res = await axios.get(`http://localhost:${port}/status`);
        expect(res.data.state).to.be.equal(state.FINISHED);
        expect(res.data.proof.input.key1).to.be.equal(input.key1);
        expect(res.data.proof.input.key2).to.be.equal(input.key2);
    });

    it("Should cancel server adn get IDLE state", async () => {
        const res = await axios.post(`http://localhost:${port}/cancel`);
        expect(res.status).to.be.equal(200);
        const res2 = await axios.get(`http://localhost:${port}/status`);
        expect(res2.data.state).to.be.equal(state.IDLE);
    });
});