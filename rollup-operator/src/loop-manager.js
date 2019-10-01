const { timeout } = require("../src/utils");

// global vars
const state = {
    SYNCHRONIZING: 0,
    NOT_REGISTER: 1,
    REGISTER: 2,
    BUILDING: 3,
};
const TIMEOUT_ERROR = 2000;
const TIMEOUT_NEXT_LOOP = 10000;

class LoopManager{
    constructor(rollupSynch, posSynch, poolTx, opManager) {
        this.rollupSynch = rollupSynch;
        this.posSynch = posSynch;
        this.poolTx = poolTx;
        this.opManager = opManager;
        this.state = state.SYNCHRONIZING;
    }

    async loopManager(){
        // eslint-disable-next-line no-constant-condition
        while(true) {
            this.opId = undefined;
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
                    if (await this._checkWinner()) this.state = state.REGISTER;
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
        let isRegister;
        const opAddress = this.opManager.wallet.address;
        const listOpRegistered = this.posSynch.getOperators();
        for (const opInfo of listOpRegistered) 
            if (opInfo.controllerAddress == opAddress.toString()) {
                isRegister == true;
                this.opId = Number(opInfo.operatorId);
            }
        return isRegister;
    }

    async _checkWinner() {
        const winners = this.posSynch.getRaffleWinners();
        
    }

    async _fullySynch() {
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoS is fully synched
        const posSynched = await this.rollupSynch.isSynched();
        return ( rollupSynched & posSynched );
    }
}

module.exports = LoopManager;