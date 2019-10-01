const { timeout, buildInputSm } = require("../src/utils");
const crypto = require("crypto"); 
const web3 = require("web3");
const { stringifyBigInts } = require("snarkjs");

// global vars
const hashChainLength = 1000;
const hashChain = [];
const initialMsg = crypto.randomBytes(32).toString("hex");
hashChain.push(web3.utils.keccak256(initialMsg));
for (let i = 1; i < hashChainLength; i++) {
    hashChain.push(web3.utils.keccak256(hashChain[i - 1]));
}

const SLOT_DEADLINE = 80;

const stateServer = {
    IDLE: 0,
    ERROR: 1,
    PENDING: 2,
    FINISHED: 3,
};

const state = {
    SYNCHRONIZING: 0,
    UPDATE_REGISTER: 1,
    REGISTER: 2,
    WAIT_FORGE: 3,
    BUILD_BATCH: 4,
    GET_PROOF: 5,
};
const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 5000;

class LoopManager{
    constructor(rollupSynch, posSynch, poolTx, opManager, cliServerProof) {
        this.rollupSynch = rollupSynch;
        this.posSynch = posSynch;
        this.poolTx = poolTx;
        this.opManager = opManager;
        this.cliServerProof = cliServerProof;

        this.registerId = [];
        this.blockToStartForge = 0;
        this.batch = undefined;
        this.batchBuilded = false;
        this.flagWaiting = false;
        this.state = state.SYNCHRONIZING;
        // Current hash chain
        this.pHashChain = hashChainLength - 1;
    }

    async startLoop(){
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                switch(this.state) {

                case state.SYNCHRONIZING: // check all is fully synched
                    console.log("SYNCH");
                    await this._fullySynch();
                    break;

                case state.UPDATE_REGISTER: // check if operator is registered
                    console.log("UPDATE_REGISTER");
                    this._checkRegister();
                    break;
                
                case state.REGISTER: // Check if operator is the winner
                    console.log("REGISTER");
                    await this._checkWinner();
                    break;
                
                case state.WAIT_FORGE: // wait until block to forge is achieved 
                    console.log("WAIT FORGE");
                    await this._checkWaitForge();
                    break;

                case state.BUILD_BATCH: // Start build batch
                    console.log("BUILD BATCH");    
                    await this._buildBatch();
                    break;

                case state.GET_PROOF:
                    console.log("GET PROOF");
                    await this._stateProof();
                    break;
                }
                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                // console.error(`Message error: ${e.message}`);
                // console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }}
    }

    async register(stake) {
        const res = await this.opManager.register(hashChain[this.pHashChain], stake);
        if (res.status) this.pHashChain--;
        return res.status;
    }
    
    async _fullySynch() {
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoS is fully synched
        const posSynched = await this.posSynch.isSynched();
        if (rollupSynched & posSynched) { // 100% synched
            if (this.flagWaiting) this.state = state.BUILD_BATCH;
            else this.state = state.UPDATE_REGISTER;
        }
    }

    async _checkRegister() {
        const opAddress = this.opManager.wallet.address;
        const listOpRegistered = await this.posSynch.getOperators();
        await this._purgeRegisterOperators(listOpRegistered);
        for (const opInfo of Object.values(listOpRegistered)) {
            if (opInfo.controllerAddress == opAddress.toString()) {
                const opId = Number(opInfo.operatorId);
                if (!this.registerId.includes(opId))
                    this.registerId.push(Number(opInfo.operatorId));
            }
        }
        if (this.registerId.length) this.state = state.REGISTER;
        else this.state = state.SYNCHRONIZING;
    }

    async _purgeRegisterOperators(listOpRegistered) {
        // Delete active operators that are no longer registered
        for (const index in this.registerId) {
            const opId = this.registerId[index];
            if( !(opId.toString() in listOpRegistered))
                this.registerId.splice(index, 1);
        }
    }

    async _checkWinner() {
        const winners = await this.posSynch.getRaffleWinners();
        const slots = await this.posSynch.getSlotWinners();
        let foundSlotWinner = false;
        for(const index in winners){
            const opWinner = winners[index];
            if (this.registerId.includes(opWinner)){ // my turn to forge a batch
                // get block from which operator has to forge batch
                const block = await this.posSynch.getBlockBySlot(slots[index] - 1);
                this.blockToStartForge = block + SLOT_DEADLINE;
                foundSlotWinner = true;
            }
            if (foundSlotWinner) break;
        }
        if (this.blockToStartForge) {
            this.flagWaiting = true;
            this.state = state.WAIT_FORGE;
        } else this.state = state.SYNCHRONIZING;
    }

    async _checkWaitForge() {
        const currentBlock = await this.posSynch.getCurrentBlock();
        if (currentBlock > this.blockToStartForge) {
            this.state = state.SYNCHRONIZING;
            this.flagWaiting = true;
            this.blockToStartForge = 0;
        } 
    }

    async _buildBatch() {
        // Check if batch was already builded
        if (this.flagWaiting) this.flagWaiting = false;

        if(!this.batchBuilded) {
            const bb = await this.rollupSynch.getBatchBuilder();
            this.batch = await this.poolTx.fillBatch(bb);
            this.batchBuilded = true;
        }
        // Check server proof is available
        const resServer = await this.cliServerProof.getStatus();
        if (resServer.data.state != stateServer.IDLE){
            // time to reset server proof
            await this.cliServerProof.cancel();
            await timeout(2000);
        }
        const res = await this.cliServerProof.setInput(stringifyBigInts(this.batch.getInput()));
        if (res.status == 200) this.state = state.GET_PROOF;
    }

    async _stateProof() {
        const res = await this.cliServerProof.getStatus();
        const statusServer = res.data.state;
        if (statusServer == stateServer.FINISHED) {
            // get proof, commit data and forge block
            const proof = res.data.proof;
            const commitData = `0x${this.batch.getDataAvailable().toString("hex")}`;
            const publicInputs = buildInputSm(this.batch);
            let resCommit;
            if (this.commited) resCommit = true;
            else {
                const res = await this.opManager.commit(hashChain[this.pHashChain], commitData);
                resCommit = res.status;
            }
            if (resCommit) { // try again if no data is commited
                this.commited = true;
                const resForge = await this.opManager.forge(proof.proofA, proof.proofB,
                    proof.proofC, publicInputs);
                if(resForge.status) {
                    this.commited = false;
                    this.state = state.UPDATE_REGISTER;
                    this.batchBuilded = false;
                    this.pHashChain--;
                }
            }
        } else if (statusServer == stateServer.ERROR) {
            // reset server-proof and re-send input
            await this.cliServerProof.cancel();
            this.state = state.BUILD_BATCH;
        } else if (statusServer == stateServer.IDLE) {
            // re-send input to server-proof
            this.state = state.BUILD_BATCH;
        }
    }
}

module.exports = LoopManager;