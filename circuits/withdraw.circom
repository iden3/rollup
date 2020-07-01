/*
 withdraw funds from rollup
*/

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";
include "./statepacker.circom"

template Withdraw(nLevels) {
	signal input ethAddress;
    signal input numBatch;
	signal input rootExit;
    signal output nullifier;

	signal private input idx;
    signal private input tokenId;
    signal private input amount;
    signal private input ax;
    signal private input ay;
    signal private input siblings[nLevels];

    // compute account state hash
    component accountState = StatePacker();
    accountState.ax <== ax;
    accountState.ay <== ay;
    accountState.amount <== amount;
    accountState.nonce <== 0;
    accountState.coin <== tokenId;
    accountState.ethAddr <== ethAddress;

    // verify account state is on exit tree root
	component smt = smtVerifier(nLevels);
	smt.enabled <== 1;
	smt.fnc <== 0;
	smt.root <== rootExit;
	for (var i = 0; i < nLevels; i++) {
		smt.siblings[i] <== siblings[i];
	}
	smt.oldKey <== 0;
	smt.oldValue <== 0;
	smt.isOld0 <== 0;
	smt.key <== accountState.out;
	smt.value <== 0;

    // compute nullifier 
    component hash = Poseidon(3, 6, 8, 57);
    hash.inputs[0] <== accountState.out;
    hash.inputs[1] <== numBatch;
    hash.inputs[2] <== rootExit;

    hash.out ==> nullifier;
}
