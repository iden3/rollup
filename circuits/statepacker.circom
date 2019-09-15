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
    data <== coin + nonce * (1<<32);
    component hash = Poseidon(5, 6, 8, 57);

    hash.inputs[0] <== data;
    hash.inputs[1] <== amount;
    hash.inputs[2] <== ax;
    hash.inputs[3] <== ay;
    hash.inputs[4] <== ethAddr;

    hash.out ==> out;
}
