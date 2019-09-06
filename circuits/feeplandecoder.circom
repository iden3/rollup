include "../node_modules/circomlib/circuits/bitify.circom";

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
    component b2nFees[16];
    component b2nCoins[16];
    for (i=0; i<16; i++) {
        nb = i<15 ? 15 : 13;
        b2nFees[i] = Bits2Num(nb);
        b2nCoins[i] = Bits2Num(nb);
        for (j=0; j<nb; j++) {
            b2nCoins[i].in[j] <== n2bCoins.out[i*16+j];
            b2nFees[i].in[j] <== n2bFees.out[i*16+j];
        }
        feePlanFee[i] <== b2nFees[i].out;
        feePlanCoin[i] <== b2nCoins[i].out;
    }
}
