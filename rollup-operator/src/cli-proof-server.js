const axios = require("axios");

class CliProofServer {

    constructor(url) {
        this.url = url;
    }

    async getStatus() {
        return axios.get(`${this.url}/status`);
    }

    async setInput(input) {
        return axios.post(`${this.url}/input`, input);
    }

    async cancel() {
        return axios.post(`${this.url}/cancel`);
    }
}

module.exports = CliProofServer;