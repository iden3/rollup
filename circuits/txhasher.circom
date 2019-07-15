
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";


template TxHasher() {

    signal input from;          // 64
    signal input to;            // 64
    signal input amountF;       // 16
    signal input coin;          // 16
    signal input nonce;         // 32
    signal input rqOffset;      // 8
    signal input rqTx;          // Field 2

    signal output out;

    component b2n = Bits2Num(200);

    var o=0;

    component n2bFrom = Num2Bits(64);
    n2bFrom.in <== from;
    for (var i=0; i<64; i++) n2bFrom.out[i] ==> b2n.in[o++];

    component n2bTo = Num2Bits(64);
    n2bTo.in <== to;
    for (var i=0; i<64; i++) n2bTo.out[i] ==> b2n.in[o++];

    component n2bAmountF = Num2Bits(16);
    n2bAmountF.in <== amountF;
    for (var i=0; i<16; i++) n2bAmountF.out[i] ==> b2n.in[o++];

    component n2bCoin = Num2Bits(16);
    n2bCoin.in <== coin;
    for (var i=0; i<16; i++) n2bCoin.out[i] ==> b2n.in[o++];

    component n2bNonce = Num2Bits(32);
    n2bNonce.in <== nonce;
    for (var i=0; i<32; i++) n2bNonce.out[i] ==> b2n.in[o++];

    component n2bRqOffset = Num2Bits(8);
    n2bRqOffset.in <== rqOffset;
    for (var i=0; i<8; i++) n2bRqOffset.out[i] ==> b2n.in[o++];

    component hash = Poseidon(2, 6, 8, 57);
    hash.input[0] <== b2n.out;
    hash.input[1] <== rqTx;

    hash.out ==> out;
}
