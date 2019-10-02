include "../node_modules/circomlib/circuits/bitify.circom";
include "decodefloat.circom";

template FeePlanDecoder() {
    signal input feePlanCoins;
    signal input feePlanFees;
    signal output feePlanCoin[16];
    signal output feePlanFee[16];

    var i;
    var j;
    var nb;

    component n2bCoins = Num2Bits(253);
    component n2bFees = Num2Bits(253);

    n2bCoins.in <== feePlanCoins;
    n2bFees.in <== feePlanFees;
    component decodeFloat[16];
    component b2nCoins[16];
    for (i=0; i<16; i++) {
        nb = i<15 ? 16 : 13;
        decodeFloat[i] = DecodeFloatBin();
        b2nCoins[i] = Bits2Num(nb);
        for (j=0; j<16; j++) {
            if (j<nb) {
                b2nCoins[i].in[j] <== n2bCoins.out[i*16+j];
                decodeFloat[i].in[j] <== n2bFees.out[i*16+j];
            } else {
                decodeFloat[i].in[j] <== 0;
            }
        }
        feePlanFee[i] <== decodeFloat[i].out;
        feePlanCoin[i] <== b2nCoins[i].out;
    }
}
