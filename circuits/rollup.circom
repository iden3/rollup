include "../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "decodetx.circom";
include "checkfees.circom";
include "rolluptx.circom";
include "feeplandecoder.circom";


template Rollup(nTx, nLevels) {

    // Incremental idx
    signal input initialIdx;
    signal output finalIdx;

    // Roots
    signal input oldStRoot;
    signal input feePlanCoins;
    signal input feeTotals; 
    signal output newStRoot;
    signal output newExitRoot;
    signal output onChainHash;
    signal output offChainHash;

    // Beneficiary Address
    signal input pubEthAddress;
    signal private input privEthAddress;

    // Intermediary States to parallelize the witness computation
    signal private input imStateRoot[nTx-1];
    signal private input imExitRoot[nTx-1];
    signal private input imOnChainHash[nTx-1];
    signal private input imOnChain[nTx-1];

    signal private input txData[nTx];
    signal private input fromIdx[nTx];
    signal private input toIdx[nTx];
    signal private input toAx[nTx];
    signal private input toAy[nTx];
    signal private input toEthAddr[nTx];
    signal private input rqTxData[nTx];
    signal private input s[nTx];
    signal private input r8x[nTx];
    signal private input r8y[nTx];
    
    // on-chain tx 
    signal private input loadAmount[nTx];
    signal private input fromEthAddr[nTx];
    signal private input fromAx[nTx];
    signal private input fromAy[nTx];

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

    var i;
    var j;

    component feePlanDecoder = FeePlanDecoder();
    feePlanDecoder.feePlanCoins <== feePlanCoins;

    for (i=0; i<16; i++) {
        feePlanCoin[i] <== feePlanDecoder.feePlanCoin[i];
    }

    var nDataAvailabilityBitsPerTx;

    var padding = 0;
    if ((nTx % 2) == 1){
        padding = 4;
    }

    // From + To + Amount + Fee
    nDataAvailabilityBitsPerTx = nLevels*2 + 16 + 4;
    
    component offChainHasher = Sha256(padding + nDataAvailabilityBitsPerTx*nTx);

    component decodeTx[nTx];
    component Tx[nTx];

    // First decode the TX data

    for (i=0; i<nTx; i++) {
        decodeTx[i] = DecodeTx(nLevels);
        if (i==0) {
            decodeTx[i].oldOnChainHash <== 0;
            decodeTx[i].previousOnChain <== 1;
            decodeTx[i].inIdx <== initialIdx;
        } else {
            decodeTx[i].oldOnChainHash <== imOnChainHash[i-1];
            decodeTx[i].previousOnChain <== imOnChain[i-1];
            decodeTx[i].inIdx <== decodeTx[i-1].outIdx;
        }
        decodeTx[i].txData <== txData[i];
        decodeTx[i].fromIdx <== fromIdx[i];
        decodeTx[i].toIdx <== toIdx[i];
        decodeTx[i].toAx <== toAx[i];
        decodeTx[i].toAy <== toAy[i];
        decodeTx[i].toEthAddr <== toEthAddr[i];
        decodeTx[i].rqTxData <== rqTxData[i];
        decodeTx[i].loadAmount <== loadAmount[i];
        decodeTx[i].fromEthAddr <== fromEthAddr[i];
        decodeTx[i].fromAx <== fromAx[i];
        decodeTx[i].fromAy <== fromAy[i];
        for (j = padding; j < nDataAvailabilityBitsPerTx + padding; j++) {
            offChainHasher.in[i*nDataAvailabilityBitsPerTx + j] <== decodeTx[i].dataAvailabilityBits[j - padding];
        }
    }

    for (i=0; i<padding; i++){
        offChainHasher.in[i] <== 0;
    }

    for (i=0; i<nTx-1; i++) {
        decodeTx[i].newOnChainHash === imOnChainHash[i];
        decodeTx[i].onChain === imOnChain[i];
    }

    for (i=0; i<nTx; i++) {

        // Chaining part

        Tx[i] = RollupTx(nLevels);


        // Tx itself

        Tx[i].fromIdx <== decodeTx[i].fromIdx;
        Tx[i].toIdx <== decodeTx[i].toIdx;
        Tx[i].toAx <== decodeTx[i].toAx;
        Tx[i].toAy <== decodeTx[i].toAy;
        Tx[i].toEthAddr <== decodeTx[i].toEthAddr;
        Tx[i].amount <== decodeTx[i].amount;
        Tx[i].coin <== decodeTx[i].coin;
        Tx[i].nonce <== decodeTx[i].nonce;
        Tx[i].fee <== decodeTx[i].fee;
        Tx[i].rqOffset <== decodeTx[i].rqOffset;
        Tx[i].onChain <== decodeTx[i].onChain;
        Tx[i].newAccount <== decodeTx[i].newAccount;

        Tx[i].sigOffChainHash <== decodeTx[i].sigOffChainHash;

        Tx[i].rqTxData <== rqTxData[i];
        Tx[i].s <== s[i];
        Tx[i].r8x <== r8x[i];
        Tx[i].r8y <== r8y[i];
        Tx[i].loadAmount <== loadAmount[i];
        Tx[i].fromEthAddr <== fromEthAddr[i];
        Tx[i].fromAx <== fromAx[i];
        Tx[i].fromAy <== fromAy[i];

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
        }

        if (i==0) {
            Tx[i].oldStRoot <== oldStRoot;
            Tx[i].oldExitRoot <== 0;
            for (j = 0; j < 16; j++){
                Tx[i].accFeeIn[j] <== 0;
            }
        } else {
            Tx[i].oldStRoot <== imStateRoot[i-1];
            Tx[i].oldExitRoot <== imExitRoot[i-1];
            for (j = 0; j < 16; j++){
                Tx[i].accFeeIn[j] <== Tx[i-1].accFeeOut[j];
            }
        }

        for (j=0; j<4; j++) {
            if (i-j-1 >= 0) {
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

    // Check Intermediary signals.
    for (i=0; i<nTx-1; i++) {
        Tx[i].newStRoot  === imStateRoot[i];
        Tx[i].newExitRoot  === imExitRoot[i];
    }

    component n2bOffChainHash = Bits2Num(256);
    for (i=0; i<256; i++) {
        n2bOffChainHash.in[i] <== offChainHasher.out[255-i];
    }

    newStRoot <== Tx[nTx-1].newStRoot;
    newExitRoot <== Tx[nTx-1].newExitRoot;
    offChainHash <== n2bOffChainHash.out;
    onChainHash <== decodeTx[nTx-1].newOnChainHash;
    finalIdx <== decodeTx[nTx-1].outIdx;

    // Check fees
    component checkFees = CheckFees();

    for (i = 0; i < 16; i++){
        checkFees.accFee[i] <== Tx[nTx-1].accFeeOut[i];
    }
    checkFees.feeTotals <== feeTotals;

    checkFees.feeTotalOk === 1;

    privEthAddress === pubEthAddress;
}
