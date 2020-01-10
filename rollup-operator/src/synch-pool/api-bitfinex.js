const axios = require("axios");

class ApiBitfinex {

    constructor(url="https://api-pub.bitfinex.com/v2/") {
        this.url = url;
    }

    async getToken(token, coin = "USD") {
        const param = `symbols=t${token}${coin}`;
        const res = await axios.get(`${this.url}/tickers?${param}`);
        return res.data[0];
    }

    getTokens(tokens) {
        const queryParams = `symbols=${tokens.join()}`; 
        return axios.get(`${this.url}/tickers?${queryParams}`);
    }


    getExchanges() {
        return axios.get(`${this.url}/conf/pub:list:pair:exchange`);
    }

}

module.exports = ApiBitfinex;
