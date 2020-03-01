const axios = require("axios");
const chai = require("chai");
const { expect } = chai;
const { timeout } = require("../src/utils");
const Client = require("../src/cli-proof-server");
// This test assumes 'server-proof' is running locally on port 10001

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
const url = `http://localhost:${port}`;

describe("Server proof", async function () {
    // Set timeout to 10 seconds
    this.timeout(10000);

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
        expect(res.data.proof.publicInputs).to.be.equal(undefined);
    });

    it("Should cancel server adn get IDLE state", async () => {
        const res = await axios.post(`http://localhost:${port}/cancel`);
        expect(res.status).to.be.equal(200);
        const res2 = await axios.get(`http://localhost:${port}/status`);
        expect(res2.data.state).to.be.equal(state.IDLE);
    });
});

describe("Server proof with client", async function () {
    // Set timeout to 10 seconds
    this.timeout(10000);

    const client = new Client(url);

    it("Should cancel server and get IDLE state", async () => {
        const res = await client.cancel();
        expect(res.status).to.be.equal(200);
        const res2 = await client.getStatus();
        expect(res2.data.state).to.be.equal(state.IDLE);
    });

    it("Should post input", async () => {
        const res = await client.setInput(input);
        expect(res.status).to.be.equal(200);
    });

    it("Should get PENDING state", async () => {
        const res = await client.getStatus();
        expect(res.data.state).to.be.equal(state.PENDING);
    });

    it("Should get FINISHED state and proof", async () => {
        // wait 5 seconds to server generate proof
        const timeoutWait = 6000;
        await timeout(timeoutWait);
        const res = await client.getStatus();
        expect(res.data.state).to.be.equal(state.FINISHED);
        expect(res.data.proof.publicInputs).to.be.equal(undefined);
    });

    it("Should post input and cancel while PENDING", async () => {
        const timeoutActions = 1000;
        await client.setInput(input);
        await timeout(timeoutActions);
        await client.cancel();
        await timeout(timeoutActions);
        const res = await client.getStatus();
        expect(res.data.state).to.be.equal(state.IDLE);
    });
});