include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux4.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template FeeUpdaterStep(){
    signal input coin;
    signal input feePlanCoin;
    signal input isSelectedIn;
    signal input fee2Charge;
    signal input accFeeIn;

    signal output isSelectedOut;
    signal output currentFeeOut;
    signal output accFeeOut;
    
    component isEqual = IsEqual();
    isEqual.in[0] <== coin;
    isEqual.in[1] <== feePlanCoin;

    isSelectedOut <== 1 - (1 - isEqual.out)*(1 - isSelectedIn);

    component mux = Mux1();
    mux.c[0] <== accFeeIn;
    mux.c[1] <== accFeeIn + fee2Charge;
    mux.s <== isEqual.out*(1 - isSelectedIn);
    mux.out ==> accFeeOut;
}

template FeeUpdater(){
    signal input coin;
    signal input fee2Charge;
    signal input feePlanCoin[16];
    signal input accFeeIn[16];

    signal output accFeeOut[16];

    component chain[16];
    
    var i;

    for (i = 0; i < 16; i++){
         chain[i] = FeeUpdaterStep();
        if (i == 0){
            chain[i].isSelectedIn <== 0;
        } else {
            chain[i].isSelectedIn <== chain[i-1].isSelectedOut;
        }
        chain[i].coin <== coin;
        chain[i].fee2Charge <== fee2Charge;
        chain[i].feePlanCoin <== feePlanCoin[i];
        chain[i].accFeeIn <== accFeeIn[i];
     }

    for (i = 0; i < 16; i++ ){
        accFeeOut[i] <== chain[i].accFeeOut;
    }
}
