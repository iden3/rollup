include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "./decodefloat.circom";

/*
    fn[0]  fn[1]   Function    S1  S2  S3  S4
    0       0       NOP         0   0   0   0
    0       1       TRANSFER    0   1   0   1
    1       0       ENTRY       0   1   0   1
    1       1       EXIT        1   0   1   1
*/

template DecodeTx(nLevels) {
    signal input previousOnChain;
    signal input oldOnChainHash;
    signal input txData;
    signal input rqTxData;
    signal input loadAmount;
    signal input ethAddr;
    signal input ax;
    signal input ay;

    signal output fromIdx;       // 64        0..63
    signal output toIdx;         // 64       64..127
    signal output amount;        // 16      128..143
    signal output coin;          // 32      144..175
    signal output nonce;         // 48      176..223
    signal output userFee;       // 16      224..239
    signal output rqOffset;      // 3       240..242
    signal output onChain        // 1       243
    signal output newAccount     // 1       244

    signal output dataAvailabilityBits[nLevels*2+16];
    signal output offChainHash;  // For the signature
    signal output newOnChainHash;   // For the chained onchain

    var i;
    var IDEN3_ROLLUP_TX = 1625792389453394788515067275302403776356063435417596283072371667635754651289; // blake2b("IDEN3_ROLLUP_TX") % r

    component n2bData = Num2Bits(245);
    n2bData.in <== txData;

// from
////////
    component b2nFrom = Bits2Num(64);
    for (i=0; i<64; i++) {
        b2nFrom.in[i] <== n2bData.out[i];
    }
    b2nFrom.out ==> fromIdx;
    var pFrom = 0;
    for (i=nLevels; i<64; i++) {
        pFrom += n2bData.out[i];
    }
    pFrom === 0;

// to
////////
    component b2nTo = Bits2Num(64);
    for (i=0; i<64; i++) {
        b2nTo.in[i] <== n2bData.out[64 + i];
    }
    b2nTo.out ==> toIdx;
    var pTo = 0;
    for (i=nLevels; i<64; i++) {
        pTo += n2bData.out[64+i];
    }
    pTo === 0;

// amount
////////
    component dfAmount = DecodeFloatBin();
    for (i=0; i<16; i++) {
        dfAmount.in[i] <== n2bData.out[128 + i];
    }
    dfAmount.out ==> amount;

// coin
////////
    component b2nCoin = Bits2Num(32);
    for (i=0; i<32; i++) {
        b2nCoin.in[i] <== n2bData.out[144 + i];
    }
    b2nCoin.out ==> coin;

// nonce
////////
    component b2nNonce = Bits2Num(48);
    for (i=0; i<48; i++) {
        b2nNonce.in[i] <== n2bData.out[176 + i];
    }
    b2nNonce.out ==> nonce;

// userFee
////////
    component dfUserFee = DecodeFloatBin();
    for (i=0; i<16; i++) {
        dfUserFee.in[i] <== n2bData.out[224 + i];
    }
    dfUserFee.out ==> userFee;

// rqOffset
////////
    component b2nRqOffset = Bits2Num(3);
    for (i=0; i<3; i++) {
        b2nRqOffset.in[i] <== n2bData.out[240 + i];
    }
    b2nRqOffset.out ==> rqOffset;

// onChain
////////
    onChain <== n2bData.out[243];

// newAccount
////////
    newAccount <== n2bData.out[244];

//  Data Availability bits
////////
    for (i=0; i<nLevels; i++) {
        dataAvailabilityBits[nLevels - 1 - i] <== n2bData.out[i]*(1-onChain);
    }
    for (i=0; i<nLevels; i++) {
        dataAvailabilityBits[nLevels + nLevels - 1 - i] <== n2bData.out[64 + i]*(1-onChain);
    }
    for (i=0; i<16; i++) {
        dataAvailabilityBits[nLevels*2 + 16 -1 - i] <== n2bData.out[128 + i]*(1-onChain);
    }

// offChainHash
//////
    component hash1 = Poseidon(3, 6, 8, 57);
    hash1.inputs[0] <== IDEN3_ROLLUP_TX;
    hash1.inputs[1] <== txData;
    hash1.inputs[2] <== rqTxData;

    hash1.out ==> offChainHash;


// onChainHash
/////
    component onChainHasher = Poseidon(6, 6, 8, 57);
    onChainHasher.inputs[0] <== oldOnChainHash;
    onChainHasher.inputs[1] <== txData;
    onChainHasher.inputs[2] <== loadAmount;
    onChainHasher.inputs[3] <== ethAddr;
    onChainHasher.inputs[4] <== ax;
    onChainHasher.inputs[5] <== ay;
    // IMPORTANT NOTE FOR SECURITY AUDITORS:
    // Poseidon paper says that one of the pieces of the state must be keep fixed to keep the security.
    // The asumption that I'm doing here is that ay depends on ax of just one bit. and the eth address has 253-140 =123 bits set to 0, so it is more than an element.
    // We could extract the sign bit and put it in one of the free bits of ethAdd or txData, but this safes many constraints.

// s6
/////////////////
    component s6 = Mux1();
    s6.c[0] <== oldOnChainHash;
    s6.c[1] <== onChainHasher.out;
    s6.s <== onChain;
    s6.out ==> newOnChainHash;

// Check that offChain are before onChain
    previousOnChain * (1 - onChain) === 0;

}
