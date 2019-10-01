include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux2.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";


template RollupTXStates() {
    signal input fromIdx;
    signal input toIdx;
    signal input amount;
    signal input amount2;
    signal input loadAmount;
    signal input newAccount;
    signal input onChain;

    signal output s1;
    signal output s2;
    signal output key1;
    signal output key2;
    signal output P1_fnc0;
    signal output P1_fnc1;
    signal output P2_fnc0;
    signal output P2_fnc1;
    signal output isExit;
    signal output verifySignEnabled;
    signal output nop;

    component fromIdxIsZero = IsZero();
    fromIdxIsZero.in <== fromIdx;
    signal isFromIdx;
    isFromIdx <== 1 - fromIdxIsZero.out;

    component toIdxIsZero = IsZero();
    toIdxIsZero.in <== toIdx;
    isExit <== toIdxIsZero.out;

    component loadAmountIsZero = IsZero();
    loadAmountIsZero.in <== loadAmount;
    signal isLoadAmount;
    isLoadAmount <== 1 - loadAmountIsZero.out;

    component amountIsZero = IsZero();
    amountIsZero.in <== amount;
    signal isAmount;
    isAmount <== 1 - amountIsZero.out;

    component amount2IsZero = IsZero();
    amount2IsZero.in <== amount2;
    signal isAmount2;
    isAmount2 <== 1 - amount2IsZero.out;

    // loadAmount MUST be 0 if it an offChain Tx
    (1-onChain)*isLoadAmount === 0;

    // newAccount MUST be 0 if it an offChain Tx
    (1-onChain)*newAccount === 0;

    s1 <== onChain*newAccount; // The first Processor is in insert

    s2 <== isExit*(1-isAmount2) // The second Processor is initialized

    P1_fnc0 <== s1*isFromIdx;
    P1_fnc1 <== (1-s1)*isFromIdx;
    component mux1 = Mux2();
    mux1.c[0] <== 0;
    mux1.c[1] <== fromIdx;
    mux1.c[2] <== fromIdx;
    mux1.c[3] <== fromIdx;
    mux1.s[0] <== P1_fnc0;
    mux1.s[1] <== P1_fnc1;
    mux1.out ==> key1;

    P2_fnc0 <== s2*isFromIdx;
    P2_fnc1 <== (1-s2)*isFromIdx;
    component mux2 = Mux2();
    mux2.c[0] <== 0;
    mux2.c[1] <== toIdx;
    mux2.c[2] <== 0;
    mux2.c[3] <== fromIdx;
    mux2.s[0] <== isAmount;
    mux2.s[1] <== isExit;
    mux2.out ==> key2;

    verifySignEnabled <== (1-onChain)*isFromIdx;

    nop <== fromIdxIsZero.out;

}
