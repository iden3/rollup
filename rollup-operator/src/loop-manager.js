const { timeout } = require("../src/utils");

// global vars
const SLOT_DEADLINE = 80;

const state = {
    SYNCHRONIZING: 0,
    NOT_REGISTER: 1,
    REGISTER: 2,
    WAIT_FORGE: 3,
    BUILDING: 4,
};
const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 10000;

class LoopManager{
    constructor(rollupSynch, posSynch, poolTx, opManager) {
        this.rollupSynch = rollupSynch;
        this.posSynch = posSynch;
        this.poolTx = poolTx;
        this.opManager = opManager;
        this.registerId = [];
        this.blockToStartForge = 0;
        this.state = state.SYNCHRONIZING;
    }

    async loopManager(){
        // eslint-disable-next-line no-constant-condition
        while(true) {
            try {
                const isSynch = await this._fullySynch();
                switch(this.state) {

                case state.SYNCHRONIZING: // check all is fully synched
                    if (isSynch) this.state = state.NOT_REGISTER;
                    break;

                case state.NOT_REGISTER: // check if operator is registered
                    if (!isSynch) this.state = state.SYNCHRONIZING;
                    if (await this._checkRegister()) this.state = state.REGISTER;
                    break;
                
                case state.REGISTER: // Check if operator is the winner
                    if (!isSynch) this.state = state.SYNCHRONIZING;
                    if (await this._checkWinner()) this.state = state.WAIT_FORGE;
                    break;
                
                case state.WAIT_FORGE: // wait until block to forge is achieved 
                    if (await this._checkWaiting()) this.state = state.BUILDING;
                    break;

                case state.BUILDING: // Start build batch
                    await this._buildBatch();
                    break;
                }

                await timeout(TIMEOUT_NEXT_LOOP);
            } catch (e) {
                console.error(`Message error: ${e.message}`);
                console.error(`Error in loop: ${e.stack}`);
                await timeout(TIMEOUT_ERROR);
            }}
    }

    async _checkRegister() {
        const opAddress = this.opManager.wallet.address;
        const listOpRegistered = this.posSynch.getOperators();
        await this._purgeRegisterOperators(listOpRegistered);
        for (const opInfo of Object.values(listOpRegistered)) {
            if (opInfo.controllerAddress == opAddress.toString()) {
                const opId = Number(opInfo.operatorId);
                if (!this.registerId.includes(opId))
                    this.registerId.push(Number(opInfo.operatorId));
            }
        }
        return this.registerId.length ? true : false;
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
        const winners = this.posSynch.getRaffleWinners();
        const slots = this.posSynch.getSlotWinners();
        for(const index in winners){
            const opWinner = winners[index];
            if (this.registerId.includes(opWinner)){ // my turn to forge a batch
                // get block from which operator has to forge batches
                const block = this.posSynch.getBlockBySlot(slots[index] - 1);
                this.blockToStartForge = block + SLOT_DEADLINE;
            }
        }
        return this.blockToStartForge ? true : false ;
    }

    async _fullySynch() {
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoS is fully synched
        const posSynched = await this.rollupSynch.isSynched();
        return ( rollupSynched & posSynched );
    }

    async _checkWaiting() {
        const currentBlock = await this.posSynch.getCurrentBlock();
        return this.blockToStartForge > currentBlock; 
    }

    async _buildBatch() {
        const bb = await this.rollupSynch.getBatchBuilder();
        const batchBuild = await this.poolTx.fillBatch(bb);
        const inputs = batchBuild.getInput();
    }
}

module.exports = LoopManager;