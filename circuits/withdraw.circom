include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/smt/smtverifier.circom";
include "./statepacker.circom"

template Withdraw(nLevels) {

    signal input rootExit;
	signal input ethAddr;
    signal input numBatch;
    signal input tokenId;
    signal input amount;
    
    signal output nullifier;

	signal private input idx;
    signal private input ax;
    signal private input ay;
    signal private input siblingsState[nLevels + 1];

    // compute account state hash
    component accountState = StatePacker();
    accountState.ax <== ax;
    accountState.ay <== ay;
    accountState.amount <== amount;
    accountState.nonce <== 0;
    accountState.coin <== tokenId;
    accountState.ethAddr <== ethAddr;

    // verify account state is on exit tree root
	component smtVerify = SMTVerifier(nLevels + 1);
	smtVerify.enabled <== 1;
	smtVerify.fnc <== 0;
	smtVerify.root <== rootExit;
	for (var i = 0; i < nLevels + 1; i++) {
		smtVerify.siblings[i] <== siblingsState[i];
	}
	smtVerify.oldKey <== 0;
	smtVerify.oldValue <== 0;
	smtVerify.isOld0 <== 0;
	smtVerify.key <== idx;
	smtVerify.value <== accountState.out;

    // compute nullifier 
    component hash = Poseidon(3, 6, 8, 57);
    hash.inputs[0] <== accountState.out;
    hash.inputs[1] <== numBatch;
    hash.inputs[2] <== rootExit;

    hash.out ==> nullifier;
}
