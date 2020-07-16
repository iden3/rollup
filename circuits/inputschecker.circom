include "../node_modules/circomlib/circuits/sha256/sha256.circom"
include "../node_modules/circomlib/circuits/bitify.circom";

// inputsHash = [ input[0] # input[1] # ... # input[n-1] ]
template InputsChecker(nInputs){

    signal input inputs[nInputs];
    signal input hash;

    var i;
    var j;

    // Convert inputs to bits
    component n2bInputs[nInputs];
    for (i = 0; i < nInputs; i++){
        n2bInputs[i] = Num2Bits(256);
        n2bInputs[i].in <== inputs[i];
    }

    // Bits hash = 256 * nInputs
    // Fill hash bits
    component inputHash = Sha256(256*nInputs);
    for (i = 0; i < nInputs; i++){
        for (j = 0; j < 256; j++){
            inputHash.in[i*256 + j] <== n2bInputs[i].out[255 - j];
        }
    }

    component b2nInputHash = Bits2Num(256);
    for (i = 0; i < 256; i++) {
        b2nInputHash.in[i] <== inputHash.out[255 - i];
    }

    // b2nInputHash.out === hash;
}