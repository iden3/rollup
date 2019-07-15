#include "rolluptx.circom"

template Rollup(nTx, nLevels) {

    // Roots
    signal public input oldStRoot;
    signal public output newStRoot;
    signal public output newExitRoot;
    signal public input onChainHash;
    signal public input offChainHash;
    signal public output feePlanHash;


    signal private input feePlanCoin[16];
    signal private input feePlanFee[16];

    // TX Data
    signal private input fnc[nTx][2];
    signal private input fromIdx[nTx];
    signal private input toIdx[nTx];
    signal private input amount[nTx];
    signal private input nonce[nTx];
    signal private input fee[nTx];
    signal private input rqTxHash[nTx];
    signal private input rqTxOffset[nTx];
    signal private input coin[nTx];
    signal private input sigR8[nTx];
    signal private input sigS[nTx];
    signal private input initAmount[nTx];
    signal private input inChain[nTx];

    // State 1
    signal private input ax1[nTx];
    signal private input ay1[nTx];
    signal private input StAmount1[nTx];
    signal private input siblings1[nTx][nlevels];
    // Required for inserts and delete
    signal private input isOld0_1[nTx];
    signal private input oldKey1[nTx];
    signal private input oldValue1[nTx];

    / State 2
    signal private input ax2[nTx];
    signal private input ay2[nTx];
    signal private input StAmount2[nTx];
    signal input siblings2[nlevels][nTx];
    // Required for inserts and delete
    signal private input isOld0_2[nTx];
    signal private input oldKey2[nTx];
    signal private input oldValue2[nTx];


    component feePlanHasher = FeePlanHasher();

    for (var i=0; i<16; i++) {
        feePlanHasher.coin[i] <== feePlanCoin[i];
        feePlanHasher.fee[i] <== feePlanFee[i];
    }
    feePlanHasher.hash ==> feePlanHash;


    component Tx[nTx];

    for (var i=0; i<nTx; i++) {

        // Chaining part

        Tx[i] = RollupTx(nLevels);
        if (i==0) {
            Tx[0].oldStRoot <== oldStRoot;
            Tx[0].oldExitRoot <== 0;
            Tx[0].oldInChain <== 1;
            Tx[0].oldInChainHash <== 0;
            Tx[0].oldOffChainHash <== 0;
        }
        Tx[i].oldStRoot <== Tx[i-1].newStRoot;
        Tx[i].oldExitRoot <== Tx[i-1].newExitRoot;
        Tx[i].oldInChain <== Tx[i-1].newInChain;
        Tx[i].oldInChainHash <== Tx[i-1].newInChainHash;
        Tx[i].oldOffChainHash <== Tx[i-1].newOffChainHash;

        // Tx itself
        Tx[i].fnc[0] <== fnc[i][0];
        Tx[i].fnc[1] <== fnc[i][1];
        Tx[i].fromIdx <== fromIdx[i];
        Tx[i].toIdx <== toIdx[i];
        Tx[i].amount <== amount[i];
        Tx[i].nonce <== [nonce];
        Tx[i].fee <== fee[i];
        Tx[i].rqTxHash <== rqTxHash[i];
        Tx[i].rqTxOffset <== rqTxOffset[i];
        Tx[i].coin <== coin[i];
        Tx[i].sigR8 <== sigR8[i];
        Tx[i].sigS <== sigS[i];
        Tx[i].initAmount <== initAmount[i];
        Tx[i].inChain <== inChain[i];

        // State 1
        Tx[i].ax1 <== ax1[i];
        Tx[i].ay1 <== ay1[i];
        Tx[i].stAmount1 <== stAmount1;
        for (var j=0; j<nLevels; j++) {
            Tx[i].siblings1[j] <== siblings1[i][j]
        }
        Tx[i].isOld0_1 <== isOld0_1[i];
        Tx[i].oldKey1 <== oldKey1[i];
        Tx[i].oldValue1 <== oldValue1[i];

        // State 2
        Tx[i].ax2 <== ax2[i];
        Tx[i].ay2 <== ay2[i];
        Tx[i].stAmount2 <== stAmount2;
        for (var j=0; j<nLevels; j++) {
            Tx[i].siblings2[j] <== siblings2[i][j]
        }
        Tx[i].isOld0_2 <== isOld0_2[i];
        Tx[i].oldKey2 <== oldKey2[i];
        Tx[i].oldValu2 <== oldValue2[i];

        for (var j=0; j<16; j++) {
            Tx[i].feePlanCoin[j] <== feePlanCoin[i];
            Tx[i].feePlanFee[i] <== feePlanFee[i];
        }

        for (var j=0; j<4; j++) {
            if (i-j-1 >= 0) {
                Tx[i].pastTxHasg[j] <== Tx[i-j-1].txHash;
            } else {
                Tx[i].pastTxHash[j] <== 0;
            }
        }
        for (var j=0; j<3; j++) {
            if (i+j+1 < nTx) {
                Tx[i].futureTxHash[j] <== Tx[i+j+1].txHash;
            } else {
                Tx[i].futureTxHash[j] <== 0;
            }
        }

    }

    Tx[nTx-1].newStRoot ==> newStRoot;
    Tx[nTx-1].newExitRoot ==> newExitRoot;
    Tx[nTx-1].newInChain ==> inChain;
    Tx[nTx-1].newOffChainHash ==> offChainHash;
}

component main Rollup(4, 24);
