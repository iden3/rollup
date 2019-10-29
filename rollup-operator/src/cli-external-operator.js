const axios = require("axios");
const { stringifyBigInts } = require("snarkjs");

class CliExternalOperator {

    constructor(url) {
        this.url = url;
    }

    getInfoByIdx(id) {
        return axios.get(`${this.url}/info/id/${id}`);
    }

    getInfoByAxAy(ax, ay) {
        return axios.get(`${this.url}/info/axay/${ax}/${ay}`);
    }

    getInfoByEthAddr(ethAddress) {
        return axios.get(`${this.url}/info/ethaddress/${ethAddress}`);
    }

    state() {
        return axios.get(`${this.url}/state`);
    }

    getGeneralInfo() {
        return axios.get(`${this.url}/info/general`);
    }

    getOperatorsList() {
        return axios.get(`${this.url}/info/operators`);
    }

    getExitInfo(numBatch, id) {
        return axios.get(`${this.url}/info/exit/${numBatch}/${id}`);
    }

    sendOffChainTx(tx) {
        return axios.post(`${this.url}/offchain/send`, { tx: stringifyBigInts(tx) });
    }
}

module.exports = CliExternalOperator;
