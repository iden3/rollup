const axios = require("axios");

/**
 * Client to interact with server-proof
 */
class CliProofServer {

    /**
     * Initialize client
     * @param {String} url - server proof url 
     */
    constructor(url) {
        this.url = url;
    }

    /**
     * Get server proof status
     * @returns {Object} - http response
     */
    async getStatus() {
        return axios.get(`${this.url}/status`);
    }

    /**
     * Send zkSnark inputs
     * @param {Object} input - zkSnark inputs
     * @returns {Object} - http response 
     */
    async setInput(input) {
        return axios.post(`${this.url}/input`, input);
    }

    /**
     * Send cancel action
     * @returns {Object} - http response
     */
    async cancel() {
        return axios.post(`${this.url}/cancel`);
    }
}

module.exports = CliProofServer;