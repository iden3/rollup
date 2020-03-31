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
    signal input fromIdx; // TODO: Added as input since it was on txData
    signal input toIdx;
    signal input fromAx;
    signal input fromAy;
    signal input fromEthAddr;
    signal input toAx; // TODO: Added toAx, toAy, toEthAddr
    signal input toAy;
    signal input toEthAddr;

    // signal output iden3RollupTx; // 64      0..63 // TODO: needed as an output ?
    signal output amount;        // 16      64..79
    signal output coin;          // 32      80..111
    signal output nonce;         // 48      112..159
    signal output userFee;       // 16      160..175
    signal output rqOffset;      // 3       176..178
    signal output onChain        // 1       179
    signal output newAccount     // 1       180

    signal output dataAvailabilityBits[nLevels*2+16];
    signal output sigOffChainHash;  // For the signature // TODO: changed the name
    signal output newOnChainHash;   // For the chained onchain

    var i;

    component n2bData = Num2Bits(181);
    n2bData.in <== txData;

// amount
////////
    component dfAmount = DecodeFloatBin();
    for (i=0; i<16; i++) {
        dfAmount.in[i] <== n2bData.out[64 + i];
    }
    dfAmount.out ==> amount;

// coin
////////
    component b2nCoin = Bits2Num(32);
    for (i=0; i<32; i++) {
        b2nCoin.in[i] <== n2bData.out[80 + i];
    }
    b2nCoin.out ==> coin;

// nonce
////////
    component b2nNonce = Bits2Num(48);
    for (i=0; i<48; i++) {
        b2nNonce.in[i] <== n2bData.out[112 + i];
    }
    b2nNonce.out ==> nonce;

// userFee
////////
    component dfUserFee = DecodeFloatBin();
    for (i=0; i<16; i++) {
        dfUserFee.in[i] <== n2bData.out[160 + i];
    }
    dfUserFee.out ==> userFee;

// rqOffset
////////
    component b2nRqOffset = Bits2Num(3);
    for (i=0; i<3; i++) {
        b2nRqOffset.in[i] <== n2bData.out[176 + i];
    }
    b2nRqOffset.out ==> rqOffset;

// onChain
////////
    onChain <== n2bData.out[179];

// newAccount
////////
    newAccount <== n2bData.out[180];

//  Data Availability bits
////////
    component n2bFromIdx = Num2Bits(64);
    n2bFromIdx.in <== fromIdx;
    // Check padding bits are 0
    var paddingFromIdx = 0;
    for (i=nLevels; i<64; i++) {
        paddingFromIdx += n2bFromIdx.out[i];
    }
    paddingFromIdx === 0;

    component n2bToIdx = Num2Bits(64);
    n2bToIdx.in <== toIdx;
    // Check padding bits are 0
    var paddingToIdx = 0;
    for (i=nLevels; i<64; i++) {
        paddingToIdx += n2bToIdx.out[i];
    }
    paddingToIdx === 0;
 
    // Add fromIdx
    for (i=0; i<nLevels; i++) {
        dataAvailabilityBits[nLevels - 1 - i] <== n2bFromIdx.out[i]*(1-onChain);
    }
    // Add toIdx
    for (i=0; i<nLevels; i++) {
        dataAvailabilityBits[nLevels + nLevels - 1 - i] <== n2bToIdx.out[i]*(1-onChain);
    }
    // Add amountF
    for (i=0; i<16; i++) {
        dataAvailabilityBits[nLevels*2 + 16 -1 - i] <== n2bData.out[64 + i]*(1-onChain);
    }

// sigOffChainHash
//////
    component hashSig = Poseidon(5, 6, 8, 57);
    hashSig.inputs[0] <== txData;
    hashSig.inputs[1] <== rqTxData;
    hashSig.inputs[2] <== toAx;
    hashSig.inputs[3] <== toAy;
    hashSig.inputs[4] <== toEthAddr;

    hashSig.out ==> sigOffChainHash;

// onChainHash
/////
    component dataOnChain = Poseidon(6, 6, 8, 57);
    dataOnChain.inputs[0] <== fromEthAddr;
    dataOnChain.inputs[1] <== fromAx;
    dataOnChain.inputs[2] <== fromAy;
    dataOnChain.inputs[3] <== toEthAddr;
    dataOnChain.inputs[4] <== toAx;
    dataOnChain.inputs[5] <== toAy;

    component onChainHasher = Poseidon(4, 6, 8, 57);
    onChainHasher.inputs[0] <== oldOnChainHash;
    onChainHasher.inputs[1] <== txData;
    onChainHasher.inputs[2] <== loadAmount;
    onChainHasher.inputs[3] <== dataOnChain.out;
    // IMPORTANT NOTE FOR SECURITY AUDITORS:
    // Poseidon paper says that one of the pieces of the state must be keep fixed to keep the security.
    // The asumption that I'm doing here is that ay depends on ax of just one bit. and the eth address hase 253-140 =123 bits set to 0, so it is more than an element.
    // We could extract the sign bit and put it in one of the free bits of ethAddr or txData, but this safes many constraints.

// s6
/////////////////
    component s6 = Mux1();
    s6.c[0] <== oldOnChainHash;
    s6.c[1] <== onChainHasher.out;
    s6.s <== onChain;
    s6.out ==> newOnChainHash;

// Check that onChain are before offChain
    (1 - previousOnChain) * onChain === 0;
}
