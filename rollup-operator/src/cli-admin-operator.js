const axios = require("axios");

class CliAdminOperator {

    constructor(url) {
        this.url = url;
    }

    loadWallet(wallet, pass) {
        return axios.post(`${this.url}/loadwallet`, { wallet, pass });
    }

    register(stake, url, seed) {
        return axios.post(`${this.url}/register/${stake}`, { url, seed });
    }

    unregister(opId) {
        return axios.post(`${this.url}/unregister/${opId}`);
    }

    withdraw(opId) {
        return axios.post(`${this.url}/withdraw/${opId}`);
    }
    
    setConversion(conversion) {
        return axios.post(`${this.url}/pool/conversion`, { conversion });
    }
}

module.exports = CliAdminOperator;
