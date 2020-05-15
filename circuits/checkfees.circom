include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "decodefloat.circom";

template CheckFees() {
    signal input accFee[16];
    signal input feeTotals;
    
    signal output feeTotalOk;

    signal feeTotal[16];

    component n2bfeeTotal = Num2Bits(253);
    n2bfeeTotal.in <== feeTotals;

    component decodeFloat[16];

    var i;
    var j;
    var nb;

    for (i = 0; i < 16; i++) {
        nb = i < 15 ? 16 : 13;
        decodeFloat[i] = DecodeFloatBin();
        for (j = 0; j < 16; j++) {
            if (j < nb) {
                decodeFloat[i].in[j] <== n2bfeeTotal.out[i*16+j];
            } else {
                decodeFloat[i].in[j] <== 0;
            }
        }
        feeTotal[i] <== decodeFloat[i].out;
    }

    component checkFeeLt[16];
    for (i = 0; i < 16; i ++){
        checkFeeLt[i] = LessEqThan(253);
        checkFeeLt[i].in[0] <== feeTotal[i];
        checkFeeLt[i].in[1] <== accFee[i];
    }

    component feesOk = MultiAND(16);
    for (i = 0; i < 16; i++){
        feesOk.in[i] <== checkFeeLt[i].out;  
    }

    feeTotalOk <== feesOk.out;
}