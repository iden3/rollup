const ethers = require('ethers');

const { getGasPrice } = require('./utils');

/**
 * approve tokens to be spent by rollup smart contract, also
 * if the tokens address match the goerli faucet WEENUS, get tokens from it.
 * @param {String} nodeEth - URL of the ethereum node
 * @param {String} addressTokens - ERC20 Smart contract
 * @param {String} amount - amount to approve
 * @param {Number} spender - rollup address
 * @param {Object} walletRollup - ethAddress and babyPubKey together
 * @param {String} abi - abi of ERC20 contract
 * @param {Number} gasLimit - transaction gas limit
 * @param {Number} gasMultiplier - multiply gas price
 * @returns {Promise} - promise will resolve when the Tx is sent, and return the Tx itself with the Tx Hash.
*/
async function approve(nodeEth, addressTokens, amount, spender, walletRollup,
    abi, gasLimit = 5000000, gasMultiplier = 1) {
    addressTokens = addressTokens || '0xaFF4481D10270F50f203E0763e2597776068CBc5'; // test token already added in goerli Rollup
    let walletEth = walletRollup.ethWallet.wallet;
    const provider = new ethers.providers.JsonRpcProvider(nodeEth);
    walletEth = walletEth.connect(provider);
    const contractWithSigner = new ethers.Contract(addressTokens, abi, walletEth);

    const overrides = {
        gasLimit,
        gasPrice: await getGasPrice(gasMultiplier, provider),
    };

    if (addressTokens === '0xaFF4481D10270F50f203E0763e2597776068CBc5') { // get test ERC20 tokens form goerli ERC20 faucet.
        const tx = {
            to: addressTokens,
            value: ethers.utils.parseEther('0'),
        };
        await walletEth.sendTransaction(tx);
    }

    try {
        return await contractWithSigner.approve(spender, amount, overrides);
    } catch (error) {
        throw new Error(`Message error: ${error.message}`);
    }
}

module.exports = {
    approve,
};
