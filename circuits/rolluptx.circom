include "./node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "./node_modules/circomlib/circuits/eddsposeidon.circom";
include "./node_modules/circomlib/circuits/gates.circom";

template RollupTx(nLevels) {

    // Fee Plan
    signal input feePlanCoin[16];
    signal input feePlanFee[16];

    // Past and future TxHashes
    signal input pastTxHash[4];
    signal input futureTxHash[3];
    signal output TxHash;

    //TX
    /*
    fn[0]  fn[1]   Function    S1  S2  S3  S4
    0       0       NOP         0   0   0   0
    0       1       TRANSFER    0   1   0   1
    1       0       ENTRY       0   1   0   1
    1       1       EXIT        1   0   1   1
    */
    signal input fnc[2];                        // 2
    signal input fromIdx;                       // 24
    signal input toIdx;                         // 24
    signal input amount;                        // 16
    signal input nonce;
    signal input fee;
    signal input rqTxHash;
    signal input rqTxOffset;
    signal input coin;
    signal input sigR8;
    signal input sigS;
    signal input initAmount;
    signal input inChain;
    signal input coinSelector;

    // State 1
    signal input ax1;
    signal input ay1;
    signal input StAmount1;
    signal input siblings1[nlevels];
    // Required for inserts and delete
    signal input isOld0_1;                     // 1
    signal input oldKey1;
    signal input oldValue1;

    // State 2
    signal input ax2;
    signal input ay2;
    signal input StAmount2;
    signal input siblings2[nlevels];
    // Required for inserts and delete
    signal input isOld0_2;                     // 1
    signal input oldKe2;
    signal input oldValue2;

    // Roots
    signal input oldStRoot;
    signal output newStRoot;

    signal input oldExitRoot;
    signal output newExitRoot;

    signal input oldInChain;
    signal output newInChain;

    signal input oldInChainHash;
    signal output newInChainHash;

    signal input oldOffChainHash;
    signal output newOffChainHash;

///////
//  Components
///////
    component feeChooser = MultiMux4(2);
    for (var i=0; i<16; i++) {
        feePlanChosser.coins[i] <== feePlanCoin[i];
        feePlanChosser.fees[i] <== feePlanFee[i];
    }
    feePlanChosser.coinSel <== coinSel;
    feePlanChosser.coin <== coin;

    component txHasher = TxHasher();

    component s5 = StateSelector();
    component s6 = StateSelector();

    component balanceSubstracter = BalanceUpdater();

    component sigVerifier = EdDSAPoseidongVerifier();
    component requiredTxVerifier = RequiredTxVerifier();

    // Check coin
    feePlanChooser.coin === coin;
    s5.coin === s6.coin;
    s5.coin === coin;

    // Check nonce
    s5.nonce === nonce;


    component txHash TxHash();

    component oldStateHasher1 = StateHasher() ;
    component newStateHasher1 = StateHasher() ;
    component oldStateHasher2 = StateHasher() ;
    component newStateHasher2 = StateHasher() ;

    component processor1 = SMTProcessor(nLevelse) ;
    component processor2 = SMTProcessor(nLevelse) ;


    component s1 = Mux2();
    component s2 = Mux2();
    component s3 = Mux2();
    component s4 = Mux2();
    component s7 = Mux2();
    component s8 = Mux2();

    component inChanHasher = new InChainHash();
    component offChainHasher = new OffChainHash();

    component andInChain = And();


}
