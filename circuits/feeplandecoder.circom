include "../node_modules/circomlib/circuits/bitify.circom";
include "decodefloat.circom";

template FeePlanDecoder() {
    signal input feePlanCoins;
    signal output feePlanCoin[16];

    var i;
    var j;
    var nb;

    component n2bCoins = Num2Bits(253);

    n2bCoins.in <== feePlanCoins;
    
    component b2nCoins[16];
    for (i=0; i<16; i++) {
        nb = i<15 ? 16 : 13;
        b2nCoins[i] = Bits2Num(16);
        for (j=0; j<16; j++) {
            if (j<nb) {
                b2nCoins[i].in[j] <== n2bCoins.out[i*16+j];
            } else {
                b2nCoins[i].in[j] <== 0;
            }
        }
        feePlanCoin[i] <== b2nCoins[i].out;
    }
}