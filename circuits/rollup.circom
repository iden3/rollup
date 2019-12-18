include "../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "decodetx.circom";
include "rolluptx.circom";
include "feeplandecoder.circom";


template Rollup(nTx, nLevels) {

    // Roots
    signal input oldStRoot;
    signal input feePlanCoins;
    signal input feePlanFees;
    signal output newStRoot;
    signal output newExitRoot;
    signal output onChainHash;
    signal output offChainHash;
    signal output countersOut;

    signal private input txData[nTx];
    signal private input rqTxData[nTx];
    signal private input s[nTx];
    signal private input r8x[nTx];
    signal private input r8y[nTx];
    signal private input loadAmount[nTx];
    signal private input ethAddr[nTx];
    signal private input ax[nTx];
    signal private input ay[nTx];
    signal private input step[nTx];

    // State 1
    signal private input ax1[nTx];
    signal private input ay1[nTx];
    signal private input amount1[nTx];
    signal private input nonce1[nTx];
    signal private input ethAddr1[nTx];
    signal private input siblings1[nTx][nLevels+1];
    // Required for inserts and delete
    signal private input isOld0_1[nTx];
    signal private input oldKey1[nTx];
    signal private input oldValue1[nTx];

    // State 2
    signal private input ax2[nTx];
    signal private input ay2[nTx];
    signal private input amount2[nTx];
    signal private input nonce2[nTx];
    signal private input ethAddr2[nTx];
    signal private input siblings2[nTx][nLevels+1];
    // Required for inserts and delete
    signal private input isOld0_2[nTx];
    signal private input oldKey2[nTx];
    signal private input oldValue2[nTx];


    signal feePlanCoin[16];
    signal feePlanFee[16];

    var i;
    var j;

    component feePlanDecoder = FeePlanDecoder();
    feePlanDecoder.feePlanCoins <== feePlanCoins;
    feePlanDecoder.feePlanFees <== feePlanFees;

    for (i=0; i<16; i++) {
        feePlanCoin[i] <== feePlanDecoder.feePlanCoin[i];
        feePlanFee[i] <== feePlanDecoder.feePlanFee[i];
    }

    var nDataAvailabilityBitsPerTx;
    nDataAvailabilityBitsPerTx = (nLevels*2+16);

    var nPad = nTx \ 8;
    var ceil = nTx % 8;
    if (ceil != 0){
        nPad = nPad + 1;
    }
    nPad = nPad * 8; // bytes to bits
    
    component offChainHasher = Sha256(nPad + nDataAvailabilityBitsPerTx*nTx);
    for (i=nTx; i<nPad; i++) {
        offChainHasher.in[i] <== 0;
    }

    component decodeTx[nTx];
    component Tx[nTx];

    // First decode the TX data

    for (i=0; i<nTx; i++) {
        decodeTx[i] = DecodeTx(nLevels);
        if (i==0) {
            decodeTx[i].oldOnChainHash <== 0;
            decodeTx[i].previousOnChain <== 0;
        } else {
            decodeTx[i].oldOnChainHash <== decodeTx[i-1].newOnChainHash;
            decodeTx[i].previousOnChain <== decodeTx[i-1].onChain;
        }
        decodeTx[i].txData <== txData[i];
        decodeTx[i].rqTxData <== rqTxData[i];
        decodeTx[i].loadAmount <== loadAmount[i];
        decodeTx[i].ethAddr <== ethAddr[i];
        decodeTx[i].ax <== ax[i];
        decodeTx[i].ay <== ay[i];
        for (j=0; j<nLevels*2+16; j++) {
            offChainHasher.in[nPad + i*nDataAvailabilityBitsPerTx+j] <== decodeTx[i].dataAvailabilityBits[j];
        }
        offChainHasher.in[i] <== step[i];

        // Ensure step is binary
        step[i]*(1-step[i]) === 0;
    }

    for (i=0; i<nTx; i++) {

        // Chaining part

        Tx[i] = RollupTx(nLevels);


        // Tx itself

        Tx[i].fromIdx <== decodeTx[i].fromIdx;
        Tx[i].toIdx <== decodeTx[i].toIdx;
        Tx[i].amount <== decodeTx[i].amount;
        Tx[i].coin <== decodeTx[i].coin;
        Tx[i].nonce <== decodeTx[i].nonce;
        Tx[i].userFee <== decodeTx[i].userFee;
        Tx[i].rqOffset <== decodeTx[i].rqOffset;
        Tx[i].onChain <== decodeTx[i].onChain;
        Tx[i].newAccount <== decodeTx[i].newAccount;

        Tx[i].offChainHash <== decodeTx[i].offChainHash;

        Tx[i].rqTxData <== rqTxData[i];
        Tx[i].s <== s[i];
        Tx[i].r8x <== r8x[i];
        Tx[i].r8y <== r8y[i];
        Tx[i].loadAmount <== loadAmount[i];
        Tx[i].ethAddr <== ethAddr[i];
        Tx[i].ax <== ax[i];
        Tx[i].ay <== ay[i];

        Tx[i].step <== step[i];

        // State 1
        Tx[i].ax1 <== ax1[i];
        Tx[i].ay1 <== ay1[i];
        Tx[i].amount1 <== amount1[i];
        Tx[i].nonce1 <== nonce1[i];
        Tx[i].ethAddr1 <== ethAddr1[i];
        for (j=0; j<nLevels+1; j++) {
            Tx[i].siblings1[j] <== siblings1[i][j]
        }
        Tx[i].isOld0_1 <== isOld0_1[i];
        Tx[i].oldKey1 <== oldKey1[i];
        Tx[i].oldValue1 <== oldValue1[i];


        // State 2
        Tx[i].ax2 <== ax2[i];
        Tx[i].ay2 <== ay2[i];
        Tx[i].amount2 <== amount2[i];
        Tx[i].nonce2 <== nonce2[i];
        Tx[i].ethAddr2 <== ethAddr2[i];
        for (j=0; j<nLevels+1; j++) {
            Tx[i].siblings2[j] <== siblings2[i][j]
        }
        Tx[i].isOld0_2 <== isOld0_2[i];
        Tx[i].oldKey2 <== oldKey2[i];
        Tx[i].oldValue2 <== oldValue2[i];

        for (j=0; j<16; j++) {
            Tx[i].feePlanCoin[j] <== feePlanCoin[j];
            Tx[i].feePlanFee[j] <== feePlanFee[j];
        }


        if (i==0) {
            Tx[0].oldStRoot <== oldStRoot;
            Tx[0].oldExitRoot <== 0;
            Tx[0].countersIn <== 0;
        } else {
            Tx[i].oldStRoot <== Tx[i-1].newStRoot;
            Tx[i].oldExitRoot <== Tx[i-1].newExitRoot;
            Tx[i].countersIn <== Tx[i-1].countersOut;
        }

        for (j=0; j<4; j++) {
            if (i-j-1 < -1/2) {
                Tx[i].pastTxData[j] <== txData[i-j-1];
            } else {
                Tx[i].pastTxData[j] <== 0;
            }
        }

        for (j=0; j<3; j++) {
            if (i+j+1 < nTx) {
                Tx[i].futureTxData[j] <== txData[i+j+1];
            } else {
                Tx[i].futureTxData[j] <== 0;
            }
        }
    }

    component n2bOffChainHash = Bits2Num(256);
    for (i=0; i<256; i++) {
        n2bOffChainHash.in[i] <== offChainHasher.out[255-i];
    }

    newStRoot <== Tx[nTx-1].newStRoot;
    newExitRoot <== Tx[nTx-1].newExitRoot;
    offChainHash <== n2bOffChainHash.out;
    onChainHash <== decodeTx[nTx-1].newOnChainHash;
    countersOut <== Tx[nTx-1].countersOut;
}
