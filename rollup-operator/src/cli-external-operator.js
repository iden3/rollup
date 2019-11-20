const axios = require("axios");
const { stringifyBigInts } = require("snarkjs");

class CliExternalOperator {

    constructor(url) {
        this.url = url;
    }

    getAccountByIdx(id) {
        return axios.get(`${this.url}/accounts/${id}`);
    }

    getAccounts(filters) {
        const axParam = filters.ax ? `ax=${filters.ax}&` : ""; 
        const ayParam = filters.ay ? `ay=${filters.ay}&` : "";
        const ethAddrParam = filters.ethAddr ? `ethAddr=${filters.ethAddr}&` : "";

        let urlParams = "?".concat(axParam, ayParam, ethAddrParam);
        urlParams = urlParams.substring(0, urlParams.length - 1);
        
        return axios.get(`${this.url}/accounts${urlParams}`);
    }

    getState() {
        return axios.get(`${this.url}/state`);
    }

    getOperators() {
        return axios.get(`${this.url}/operators`);
    }

    getExitInfo(id, numBatch) {
        return axios.get(`${this.url}/exits/${id}/${numBatch}`);
    }

    getExits(id) {
        return axios.get(`${this.url}/exits/${id}`);
    }

    sendTx(tx) {
        return axios.post(`${this.url}/pool`, stringifyBigInts(tx));
    }
}

module.exports = CliExternalOperator;
