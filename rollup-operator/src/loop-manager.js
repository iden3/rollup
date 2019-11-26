const web3 = require("web3");
const winston = require("winston");

const { timeout, buildInputSm } = require("../src/utils"); 
const { stringifyBigInts } = require("snarkjs"); 

// global vars
const SLOT_DEADLINE = 80;

const stateServer = {
    IDLE: 0,
    ERROR: 1,
    PENDING: 2,
    FINISHED: 3,
};

const state = {
    SYNCHRONIZING: 0,
    UPDATE_OPERATORS: 1,
    CHECK_WINNERS: 2,
    WAIT_FORGE: 3,
    BUILD_BATCH: 4,
    GET_PROOF: 5,
};

const TIMEOUT_ERROR = 2000;
let TIMEOUT_NEXT_STATE = 5000;

class LoopManager{
    constructor(rollupSynch, posSynch, poolTx, opManager, cliServerProof, logLevel) {
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
        this.hashChain = [];
        this.pHashChain = 0;
        this._initLogger(logLevel);
    }

    _initLogger(logLevel) {
        // config winston
        var options = {
            console: {
                level: logLevel,
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple(),
                )
            },
        };

        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console(options.console)
            ]
        });
    }

    async startLoop(){
        // eslint-disable-next-line no-constant-condition
        while(true) {
            let info = "OPERATOR STATE: ";
            try {
                switch(this.state) {

                case state.SYNCHRONIZING: // check all is fully synched
                    info += "SYNCH";
                    await this._fullySynch();
                    break;

                // update operators
                // if operator has been loaded, check if it is registered
                case state.UPDATE_OPERATORS: 
                    info += "UPDATE OPERATORS";
                    await this._checkRegister();
                    break;
                
                case state.CHECK_WINNERS: // Check if operator is the winner
                    info += "CHECK OPERATORS";
                    await this._checkWinner();
                    break;
                
                case state.WAIT_FORGE: // wait until block to forge is achieved 
                    info += "WAIT FORGE";
                    await this._checkWaitForge();
                    break;

                case state.BUILD_BATCH: // Start build batch
                    info += "BUILD BATCH";    
                    await this._buildBatch();
                    break;

                case state.GET_PROOF:
                    info += "GET PROOF";
                    await this._stateProof();
                    break;
                }
                this.logger.info(info);
                await timeout(TIMEOUT_NEXT_STATE);
            } catch (e) {
                this.logger.error(`OPERATOR STATE Message error: ${e.message}`);
                this.logger.debug(`OPERATOR STATE Message error: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }}
    }

    // seed encoded as an string
    async loadSeedHashChain(seed){
        const hashChainLength = 1000;
        this.hashChain.push(web3.utils.keccak256(seed));
        for (let i = 1; i < hashChainLength; i++) {
            this.hashChain.push(web3.utils.keccak256(this.hashChain[i - 1]));
        }
        this.pHashChain = hashChainLength - 1;
    }

    async register(stake, url) {
        const res = await this.opManager.register(this.hashChain[this.pHashChain], stake, url);
        if (res.status) this.pHashChain--;
        return res.status;
    }
    
    async _fullySynch() {
        TIMEOUT_NEXT_STATE = 5000;
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoS is fully synched
        const posSynched = await this.posSynch.isSynched();
        if (rollupSynched & posSynched) { // 100% synched
            TIMEOUT_NEXT_STATE = 0;
            if (this.flagWaiting) this.state = state.BUILD_BATCH;
            else this.state = state.UPDATE_OPERATORS;
        }
    }

    async _checkRegister() {
        const listOpRegistered = await this.posSynch.getOperators();
        await this._purgeRegisterOperators(listOpRegistered);
        if (this.opManager.wallet != undefined) {
            const opAddress = this.opManager.wallet.address;
            for (const opInfo of Object.values(listOpRegistered)) {
                if (opInfo.controllerAddress == opAddress.toString()) {
                    const opId = Number(opInfo.operatorId);
                    if (!this.registerId.includes(opId))
                        this.registerId.push(Number(opInfo.operatorId));
                }
            }
        }
        if (this.registerId.length) {
            TIMEOUT_NEXT_STATE = 0;
            this.state = state.CHECK_WINNERS;
        } else {
            TIMEOUT_NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
        }
    }

    async _purgeRegisterOperators(listOpRegistered) {
        // Delete active operators that are no longer registered
        for (const index in this.registerId) {
            const opId = this.registerId[index];
            if(!(opId.toString() in listOpRegistered))
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
            TIMEOUT_NEXT_STATE = 0;
            this.flagWaiting = true;
            this.state = state.WAIT_FORGE;
        } else {
            TIMEOUT_NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
        }
    }

    async _checkWaitForge() {
        const currentBlock = await this.posSynch.getCurrentBlock();
        TIMEOUT_NEXT_STATE = 5000;
        if (currentBlock > this.blockToStartForge) {
            TIMEOUT_NEXT_STATE = 0;
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
            await this.poolTx.fillBatch(bb);
            this.batch = bb;
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
        if (res.status == 200) {
            TIMEOUT_NEXT_STATE = 0;
            this.state = state.GET_PROOF;
        } else TIMEOUT_NEXT_STATE = 5000; // retry build or send inputs to server-proof
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
                const res = await this.opManager.commit(this.hashChain[this.pHashChain], commitData);
                resCommit = res.status;
            }
            if (resCommit) { // try again if no data is commited
                this.commited = true;
                const resForge = await this.opManager.forge(proof.proofA, proof.proofB,
                    proof.proofC, publicInputs);
                if(resForge.status) {
                    TIMEOUT_NEXT_STATE = 15000;
                    this.commited = false;
                    this.state = state.SYNCHRONIZING;
                    this.batchBuilded = false;
                    this.pHashChain--;
                }
            }
        } else if (statusServer == stateServer.ERROR) {
            TIMEOUT_NEXT_STATE = 2000;
            // reset server-proof and re-send input
            await this.cliServerProof.cancel();
            await timeout(2000); // time to reset the server-proof 
            this.state = state.BUILD_BATCH;
        } else if (statusServer == stateServer.IDLE) {
            TIMEOUT_NEXT_STATE = 5000;
            // re-send input to server-proof
            this.state = state.BUILD_BATCH;
        } else TIMEOUT_NEXT_STATE = 5000; // Server in pending state
    }
}

module.exports = LoopManager;