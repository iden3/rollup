include "../node_modules/circomlib/circuits/poseidon.circom";

template StatePacker() {

    signal input ax;
    signal input ay;
    signal input amount;
    signal input nonce;
    signal input coin;
    signal input ethAddr;

    signal output out;

    signal data;
    data <== amount + coin * (1<<128) + nonce * (1<<142);
    component hash = Poseidon(4, 6, 8, 57);

    hash.inputs[0] <== data;
    hash.inputs[1] <== ax;
    hash.inputs[2] <== ay;
    hash.inputs[3] <== ethAddr;

    hash.out ==> out;
}
