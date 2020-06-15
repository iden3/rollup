include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "feeupdater.circom";
include "balancesupdater.circom";
include "rolluptxstates.circom";
include "statepacker.circom";
include "requiredtxverifier.circom";
include "statepacker.circom";

template RollupTx(nLevels) {

    signal input feePlanCoin[16];

    // Past and future TxDatas
    signal input pastTxData[4];
    signal input futureTxData[3];

    // Tx
    signal input fromIdx;
    signal input toIdx;
    signal input toAx;
    signal input toAy;
    signal input toEthAddr;
    signal input amount;
    signal input coin;
    signal input nonce;
    signal input fee;
    signal input rqOffset;
    signal input onChain;
    signal input newAccount;

    signal input sigOffChainHash;

    signal input rqTxData;
    signal input s;
    signal input r8x;
    signal input r8y;

    // For on-chain TX
    signal input loadAmount;
    signal input fromEthAddr;
    signal input fromAx;
    signal input fromAy;

    // State 1
    signal input ax1;
    signal input ay1;
    signal input amount1;
    signal input nonce1;
    signal input ethAddr1;
    signal input siblings1[nLevels+1];
    // Required for inserts and delete
    signal input isOld0_1;                     // 1
    signal input oldKey1;
    signal input oldValue1;

    // State 2
    signal input ax2;
    signal input ay2;
    signal input amount2;
    signal input nonce2;
    signal input ethAddr2;
    signal input siblings2[nLevels+1];
    // Required for inserts and delete
    signal input isOld0_2;                     // 1
    signal input oldKey2;
    signal input oldValue2;

    // Roots
    signal input oldStRoot;
    signal output newStRoot;

    signal input oldExitRoot;
    signal output newExitRoot;

    // Accumulated fees
    signal input accFeeIn[16];
    signal output accFeeOut[16];

    var i;

//  states
///////////
    component states = RollupTXStates();
    states.onChain <== onChain;
    states.fromIdx <== fromIdx;
    states.toIdx <== toIdx;
    states.amount <== amount;
    states.amount2 <== amount2;
    states.loadAmount <== loadAmount;
    states.newAccount <== newAccount;

// requiredTxVerifier
//////////
    component requiredTxVerifier = RequiredTxVerifier();

    for (i=0; i<4; i++) {
        requiredTxVerifier.pastTxData[i] <== pastTxData[i];
    }

    for (i=0; i<3; i++) {
        requiredTxVerifier.futureTxData[i] <== futureTxData[i];
    }

    requiredTxVerifier.rqTxData <== rqTxData;
    requiredTxVerifier.rqTxOffset <== rqOffset;

// nonceChecker
//////////
    component nonceChecker = ForceEqualIfEnabled();
    nonceChecker.in[0] <== nonce;
    nonceChecker.in[1] <== nonce1;
    nonceChecker.enabled <== (1-onChain);

// toAxChecker
//////////
    component toAxChecker = ForceEqualIfEnabled();
    toAxChecker.in[0] <== toAx;
    toAxChecker.in[1] <== ax2;
    toAxChecker.enabled <== (1 - onChain)*(1 - states.isExit);

// toAyChecker
//////////
    component toAyChecker = ForceEqualIfEnabled();
    toAyChecker.in[0] <== toAy;
    toAyChecker.in[1] <== ay2;
    toAyChecker.enabled <== (1 - onChain)*(1 - states.isExit);

// toEthAddrChecker
//////////
    component toEthAddrChecker = ForceEqualIfEnabled();
    toEthAddrChecker.in[0] <== toEthAddr;
    toEthAddrChecker.in[1] <== ethAddr2;
    toEthAddrChecker.enabled <== (1 - onChain)*(1 - states.isExit);

// fromEthAddrChecker
//////////
    component fromEthAddrChecker = ForceEqualIfEnabled();
    fromEthAddrChecker.in[0] <== fromEthAddr;
    fromEthAddrChecker.in[1] <== ethAddr1;
    fromEthAddrChecker.enabled <== onChain;

// oldState1 Packer
/////////////////
    component oldSt1Pck = StatePacker();
    oldSt1Pck.ax <== ax1;
    oldSt1Pck.ay <== ay1;
    oldSt1Pck.amount <== amount1;
    oldSt1Pck.nonce <== nonce1;
    oldSt1Pck.coin <== coin;
    oldSt1Pck.ethAddr <== ethAddr1;

// oldState2 Packer
/////////////////
    component oldSt2Pck = StatePacker();
    oldSt2Pck.ax <== ax2;
    oldSt2Pck.ay <== ay2;
    oldSt2Pck.amount <== amount2;
    oldSt2Pck.nonce <== nonce2;
    oldSt2Pck.coin <== coin;
    oldSt2Pck.ethAddr <== ethAddr2;


// s1
//////////////
    component s1Amount = Mux1();
    s1Amount.c[0] <== amount1;
    s1Amount.c[1] <== 0;
    s1Amount.s <== states.s1;

    component s1Ax = Mux1();
    s1Ax.c[0] <== ax1;
    s1Ax.c[1] <== fromAx;
    s1Ax.s <== states.s1;

    component s1Ay = Mux1();
    s1Ay.c[0] <== ay1;
    s1Ay.c[1] <== fromAy;
    s1Ay.s <== states.s1;

    component s1Nonce = Mux1();
    s1Nonce.c[0] <== nonce1;
    s1Nonce.c[1] <== nonce;
    s1Nonce.s <== states.s1;

    component s1EthAddr = Mux1();
    s1EthAddr.c[0] <== ethAddr1;
    s1EthAddr.c[1] <== fromEthAddr;
    s1EthAddr.s <== states.s1;

    component s1OldKey = Mux1();
    s1OldKey.c[0] <== states.key1;
    s1OldKey.c[1] <== oldKey1;
    s1OldKey.s <== states.s1;

    component s1OldValue = Mux1();
    s1OldValue.c[0] <== oldSt1Pck.out;
    s1OldValue.c[1] <== oldValue1;
    s1OldValue.s <== states.s1;

// s2
//////////////

    component s2Ax = Mux1();
    s2Ax.c[0] <== ax2;
    s2Ax.c[1] <== s1Ax.out;
    s2Ax.s <== states.s2;

    component s2Ay = Mux1();
    s2Ay.c[0] <== ay2;
    s2Ay.c[1] <== s1Ay.out;
    s2Ay.s <== states.s2;

    component s2Nonce = Mux1();
    s2Nonce.c[0] <== nonce2;
    s2Nonce.c[1] <== 0;
    s2Nonce.s <== states.s2;

    component s2EthAddr = Mux1();
    s2EthAddr.c[0] <== ethAddr2;
    s2EthAddr.c[1] <== s1EthAddr.out;
    s2EthAddr.s <== states.s2;

    component s2OldKey = Mux1();
    s2OldKey.c[0] <== states.key2;
    s2OldKey.c[1] <== oldKey2;
    s2OldKey.s <== states.s2;

    component s2OldValue = Mux1();
    s2OldValue.c[0] <== oldSt2Pck.out;
    s2OldValue.c[1] <== oldValue2;
    s2OldValue.s <== states.s2;


// sigVerifier
//////////
    component sigVerifier = EdDSAPoseidonVerifier();
    sigVerifier.enabled <== states.verifySignEnabled;

    sigVerifier.Ax <== s1Ax.out;
    sigVerifier.Ay <== s1Ay.out;

    sigVerifier.S <== s;
    sigVerifier.R8x <== r8x;
    sigVerifier.R8y <== r8y;

    sigVerifier.M <== sigOffChainHash;

// balancesUpdater
///////////////
    component balancesUpdater = BalancesUpdater();
    balancesUpdater.oldStAmountSender <== s1Amount.out;
    balancesUpdater.oldStAmountReceiver <== amount2;
    balancesUpdater.amount <== amount;
    balancesUpdater.fee <== fee;
    balancesUpdater.onChain <== onChain;
    balancesUpdater.loadAmount <== loadAmount;
    balancesUpdater.nop <== states.nop;

// feeUpdater
///////////
    component feeUpdater = FeeUpdater();
    feeUpdater.coin <== coin;
    feeUpdater.fee2Charge <== balancesUpdater.fee2Charge;
    
    for (i = 0; i < 16; i++){
        feeUpdater.feePlanCoin[i] <== feePlanCoin[i];
        feeUpdater.accFeeIn[i] <== accFeeIn[i];
    }

    for (i = 0; i < 16; i++){
        feeUpdater.accFeeOut[i] ==> accFeeOut[i];
    }

// newState1 Packer
/////////////////
    component newSt1Pck = StatePacker();
    newSt1Pck.ax <== s1Ax.out;
    newSt1Pck.ay <== s1Ay.out;
    newSt1Pck.amount <== balancesUpdater.newStAmountSender;
    newSt1Pck.nonce <== s1Nonce.out + (1 - onChain);
    newSt1Pck.coin <== coin;
    newSt1Pck.ethAddr <== s1EthAddr.out;

// newState1 Packer
/////////////////
    component newSt2Pck = StatePacker();
    newSt2Pck.ax <== s2Ax.out;
    newSt2Pck.ay <== s2Ay.out;
    newSt2Pck.amount <== balancesUpdater.newStAmountReceiver;
    newSt2Pck.nonce <== s2Nonce.out;
    newSt2Pck.coin <== coin;
    newSt2Pck.ethAddr <== s2EthAddr.out;

// processor1
/////////////////
    component processor1 = SMTProcessor(nLevels+1) ;
    processor1.oldRoot <== oldStRoot;
    for (i=0; i<nLevels+1; i++) {
        processor1.siblings[i] <== siblings1[i];
    }
    processor1.oldKey <== s1OldKey.out;
    processor1.oldValue <== s1OldValue.out;
    processor1.isOld0 <== isOld0_1;
    processor1.newKey <== fromIdx;
    processor1.newValue <== newSt1Pck.out;
    processor1.fnc[0] <== states.P1_fnc0;
    processor1.fnc[1] <== states.P1_fnc1;

// s3
/////////////////
    component s3 = Mux1();
    s3.c[0] <== processor1.newRoot;
    s3.c[1] <== oldExitRoot;
    s3.s <== states.isExit;

// processor2
/////////////////
    component processor2 = SMTProcessor(nLevels+1) ;
    processor2.oldRoot <== s3.out;
    for (i=0; i<nLevels+1; i++) {
        processor2.siblings[i] <== siblings2[i];
    }
    processor2.oldKey <== s2OldKey.out;
    processor2.oldValue <== s2OldValue.out;
    processor2.isOld0 <== isOld0_2;
    processor2.newKey <== states.key2;
    processor2.newValue <== newSt2Pck.out;
    processor2.fnc[0] <== states.P2_fnc0*balancesUpdater.update2;
    processor2.fnc[1] <== states.P2_fnc1*balancesUpdater.update2;


// s4
/////////////////
    component s4 = Mux1();
    s4.c[0] <== processor2.newRoot;
    s4.c[1] <== processor1.newRoot;
    s4.s <== states.isExit;
    s4.out ==> newStRoot;

// s5
/////////////////
    component s5 = Mux1();
    s5.c[0] <== oldExitRoot;
    s5.c[1] <== processor2.newRoot;
    s5.s <== states.isExit;
    s5.out ==> newExitRoot;
}
