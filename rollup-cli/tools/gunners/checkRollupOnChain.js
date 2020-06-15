/* eslint-disable no-console */
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const { Scalar } = require('ffjavascript');

const urlNodeEth = 'https://goerli.infura.io/v3/135e56bb9eaa42c59e73481fcb0f9b4a';
const provider = new ethers.providers.JsonRpcProvider(urlNodeEth);

const configParamsPath = path.join(__dirname, 'config/params.json');


const actualConfig = JSON.parse(fs.readFileSync(configParamsPath, 'utf8'));

const contractRollup = new ethers.Contract(actualConfig.rollupAddress, actualConfig.abiRollup, provider);


async function checkRollup() {
    const getStateDepth = await contractRollup.getStateDepth();
    const stateDepthScalar = Scalar.e(getStateDepth._hex);
    console.log({ stateDepthScalar });

    const fillingInfo = await contractRollup.fillingMap(stateDepthScalar.toString());
    const currenOnchanTx = Scalar.e(fillingInfo.currentOnChainTx._hex);
    console.log({ currenOnchanTx });


    const fillingInfoPlusOne = await contractRollup.fillingMap((Scalar.add(stateDepthScalar, 1)).toString());
    const currenOnchanTxPlusOne = Scalar.e(fillingInfoPlusOne.currentOnChainTx._hex);
    console.log({ currenOnchanTxPlusOne });

    const fillingInfoPlusTwo = await contractRollup.fillingMap((Scalar.add(stateDepthScalar, 2)).toString());
    const currenOnchanTxPlusTwo = Scalar.e(fillingInfoPlusTwo.currentOnChainTx._hex);
    console.log({ currenOnchanTxPlusTwo });
}
checkRollup();
