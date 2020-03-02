const ethers = require('ethers');
const { getGasPrice } = require('./utils');

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

    if (addressTokens === '0xaFF4481D10270F50f203E0763e2597776068CBc5') { // get test ERC20 tokens.
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
