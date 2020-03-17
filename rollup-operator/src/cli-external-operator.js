const axios = require("axios");
const { stringifyBigInts } = require("snarkjs");

/**
 * Client to interact with operator API
 */
class CliExternalOperator {

    /**
     * Initilaize client
     * @param {String} url - operator url 
     */
    constructor(url) {
        this.url = url;
    }

    /**
     * Get account state
     * @param {Number} id - rollup identifier
     * @returns {Object} - http response 
     */
    getAccountByIdx(id) {
        return axios.get(`${this.url}/accounts/${id}`);
    }

    /**
     * Get array of accounts depending on filters provided
     * @param {Object} filters
     * @returns {Object} - http response 
     */
    getAccounts(filters) {
        const axParam = filters.ax ? `ax=${filters.ax}&` : ""; 
        const ayParam = filters.ay ? `ay=${filters.ay}&` : "";
        const ethAddrParam = filters.ethAddr ? `ethAddr=${filters.ethAddr}&` : "";

        let urlParams = "?".concat(axParam, ayParam, ethAddrParam);
        urlParams = urlParams.substring(0, urlParams.length - 1);
        
        return axios.get(`${this.url}/accounts${urlParams}`);
    }

    /**
     * Get general operator status
     * @returns {Object} - http response
     */
    getState() {
        return axios.get(`${this.url}/state`);
    }

    /**
     * Get list of active operators
     * @returns {Object} - http response
     */
    getOperators() {
        return axios.get(`${this.url}/operators`);
    }

    /**
     * Get exit information for a rollup account
     * Useful to make a withdraw afterwards
     * @param {Number} id - rollup identifier
     * @param {Number} numBatch - rollup batch number
     * @returns {Object} - http response
     */
    getExitInfo(id, numBatch) {
        return axios.get(`${this.url}/exits/${id}/${numBatch}`);
    }

    /**
     * Get array of batch numbers where rollup identifier
     * has performed a withdraw from rollup
     * @param {Number} id - rollup identifier
     * @returns {Object} - http response
     */
    getExits(id) {
        return axios.get(`${this.url}/exits/${id}`);
    }

    /**
     * Send off-chain transaction to the operator
     * @param {Object} tx - rollup transaction
     * @returns {Object} - http response 
     */
    sendTx(tx) {
        return axios.post(`${this.url}/pool`, stringifyBigInts(tx));
    }
}

module.exports = CliExternalOperator;
