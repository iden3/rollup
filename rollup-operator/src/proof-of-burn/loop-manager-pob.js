const { performance } = require("perf_hooks");
const Web3 = require("web3");
const winston = require("winston");
const chalk = require("chalk");
const { stringifyBigInts } = require("ffjavascript").utils;
const Scalar = require("ffjavascript").Scalar;

const { timeout, buildPublicInputsSm, generateCall } = require("../utils"); 

// Logging state information
const strState = [
    "Synchronizing",
    "Checking winners",
    "Waiting to forge at block: ",
    "Building batch",
    "Getting proof",
    "Mining transaction",
    "Checking forge"
];

// server-proof states
const stateServer = {
    IDLE: 0,
    ERROR: 1,
    PENDING: 2,
    FINISHED: 3,
};

// Enum states for loop manager
const state = {
    SYNCHRONIZING: 0,
    CHECK_WINNERS: 1,
    WAIT_FORGE: 2,
    BUILD_BATCH: 3,
    GET_PROOF: 4,
    MINING: 5,
    CHECK_FORGE: 6,
};

/**
 * Manage operator actions
 * - checks when the operator has to forge a batch
 * - prepare batch to be commited and forged
 * - sends zkSnark inputs to server-proof
 * - get proof from server-proof
 * - send ethereum transaction to Rollup PoB
 */
class LoopManager{
    /**
     * Initialize loop manager
     * @param {Object} rollupSynch - Rollup core synchronizer 
     * @param {Object} pobSynch - Rollup PoB synchronizer
     * @param {Object} poolTx - Transaction pool
     * @param {Object} opManager - Client to interact with Rollup PoB
     * @param {Object} cliServerProof - Client to interact woth server-proof
     * @param {String} logLevel - logger level
     * @param {String} nodeUrl - ethereum node url
     * @param {Object} timeouts - Configure timeouts
     */
    constructor(
        rollupSynch, 
        pobSynch,
        poolTx,
        opManager,
        cliServerProof,
        logLevel,
        nodeUrl,
        timeouts
    ) {
        this.nodeUrl = nodeUrl;
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.nodeUrl));
        this.web3.eth.handleRevert = true;
        this.rollupSynch = rollupSynch;
        this.pobSynch = pobSynch;
        this.poolTx = poolTx;
        this.opManager = opManager;
        this.cliServerProof = cliServerProof;

        this.state = state.SYNCHRONIZING;
        this.infoCurrentBatch = {};
        this.currentTx = {};
        
        this._initTimeouts(timeouts);
        this._initLogger(logLevel);
    }

    /**
     * Initilaize all timeouts
     * @param {Object} timeouts 
     */
    _initTimeouts(timeouts){
        const errorDefault = 5000;
        const nextStateInit = 5000;

        let timeoutError = errorDefault;
        if (timeouts !== undefined) 
            timeoutError = timeouts.ERROR || errorDefault;  

        this.timeouts = {
            ERROR: timeoutError,
            NEXT_STATE: nextStateInit,
        };
    }

    /**
     * Initilaize logger
     * @param {String} logLevel 
     */
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

    /**
     * Get public contract variables
     */
    async _init(){
        // get slot deadline
        this.slotDeadline = await this.pobSynch.getSlotDeadline();
        this.defaultOperator = await this.pobSynch.getDefaultOperator();
        
        // get fee for deposits off-chain
        const feeWei = await this.rollupSynch.getFeeDepOffChain();
        const feeEth = this.web3.utils.fromWei(feeWei.toString() , "ether");
        this.feeDepOffChain = Number(feeEth);
        this.poolTx.setFeeDeposit(this.feeDepOffChain);
    }

    /**
     * Main loop
     * Detect in which state is the manager
     * Each state has its own action to be triggered
     */
    async startLoop(){
        await this._init();

        // eslint-disable-next-line no-constant-condition
        while(true) {
            let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])}`.padEnd(20);
            let currentBlock = 0;
            let timeTx = 0;
            // Fill log information depending on the state
            switch(this.state) {

            case state.CHECK_WINNERS: 
                info += " | forger address: ";
                info += `${chalk.white.bold(`${this.opManager.wallet.address}`)}`;
                break;

            case state.WAIT_FORGE:  
                currentBlock = await this.pobSynch.getCurrentBlock();
                info += `${chalk.white.bold(`${this.infoCurrentBatch.fromBlock}`)} | `;
                info += `current block: ${chalk.white.bold(`${currentBlock}`)} | `;
                info += "operator winner: ";
                info += `${chalk.white.bold(`${this.infoCurrentBatch.forgerAddress}`)}`;
                break;

            case state.BUILD_BATCH:
                info += " | Attempts to send: ";
                info += chalk.white.bold(this.infoCurrentBatch.retryTimes);
                break;
            
            case state.GET_PROOF:
                timeTx = performance.now();
                info += " | Proof pending: ";
                info += `${chalk.white.bold(`${((timeTx - this.infoCurrentBatch.startTime)/1000).toFixed(2)} s`)}`;
                break;

            case state.MINING:
                info += " | info ==> Transaction hash: ";
                info += chalk.white.bold(this.currentTx.txHash);
                timeTx = performance.now();
                if (this.currentTx.attempts)
                    info += `| ${this.currentTx.attempts} attempts`;
                info += " | transaction pending: ";
                info += `${chalk.white.bold(`${((timeTx - this.currentTx.startTx)/1000).toFixed(2)} s`)}`;
                break;

            case state.CHECK_FORGE:
                if(this.infoCurrentBatch.deadlineBlock) {
                    currentBlock = await this.pobSynch.getCurrentBlock();
                    info += ` | current block: ${chalk.white.bold(`${currentBlock}`)} |  `;
                    info += "deadline block: ";
                    info += `${chalk.white.bold(`${this.infoCurrentBatch.deadlineBlock}`)}`;
                }
                break;
            }

            this.logger.info(info);

            // Take action depending on the current state
            try {
                switch(this.state) {

                // check all is fully synched
                case state.SYNCHRONIZING:
                    await this._fullySynch();
                    break;
                
                // check if operator is the winner
                case state.CHECK_WINNERS: 
                    await this._checkWinner();
                    break;
                
                // wait until block to forge is achieved
                case state.WAIT_FORGE:  
                    await this._checkWaitForge(currentBlock);
                    break;

                // start build batch
                case state.BUILD_BATCH:   
                    await this._buildBatch();
                    break;

                // send proof
                case state.GET_PROOF:
                    await this._stateProof();
                    break;

                // wait to mining transaction
                case state.MINING:
                    await this._monitorTx();
                    this.timeouts.NEXT_STATE = 5000;
                    break;

                case state.CHECK_FORGE:
                    await this._checkForge();
                    break;
                }

                if (this.timeouts.NEXT_STATE) await timeout(this.timeouts.NEXT_STATE);

            } catch (e) {
                this.logger.error(`OPERATOR STATE Message error: ${e.message}`);
                this.logger.debug(`OPERATOR STATE Message error: ${e.stack}`);
                await timeout(this.timeouts.ERROR);
            }}
    }

    /**
     * Checks if synchronizers, either rollup core and rollup PoB,
     * are fully synchronized
     */
    async _fullySynch() {
        this.timeouts.NEXT_STATE = 5000;
        // check rollup is fully synched
        const rollupSynched = await this.rollupSynch.isSynched();
        // check PoB is fully synched
        const pobSynched = await this.pobSynch.isSynched();
        if (rollupSynched & pobSynched) { // Both 100% synched
            this.timeouts.NEXT_STATE = 0;
            if (this.infoCurrentBatch.waiting) this.state = state.BUILD_BATCH;
            else this.state = state.CHECK_WINNERS;
        }
    }

    /**
     * Check if operator registered has won a slot to forge
     */
    async _checkWinner() {
        const winners = await this.pobSynch.getOperatorsWinners();
        const opWinner = winners[0];
        const slotWinner = opWinner.slot;
        const currentBlock = await this.pobSynch.getCurrentBlock();

        const forgerAddress = this.opManager.wallet.address;

        const slotFullFilled = await this.pobSynch.getFullFilledSlot(slotWinner);

        const fromBlockWinner = await this.pobSynch.getBlockBySlot(slotWinner);
        const toBlockWinner = await this.pobSynch.getBlockBySlot(slotWinner + 1);

        let checkForge = false;

        if (opWinner.forger === forgerAddress && (currentBlock < toBlockWinner)){
            const beneficiaryAddress = opWinner.beneficiary;
            this._setInfoBatch(fromBlockWinner, toBlockWinner, forgerAddress, beneficiaryAddress);
        } else if (slotWinner > 1 && !slotFullFilled) {
            checkForge = true;
        }

        if (this.infoCurrentBatch.fromBlock) {
            this.timeouts.NEXT_STATE = 0;
            this.state = state.WAIT_FORGE;
        } else if (checkForge) {
            this.timeouts.NEXT_STATE = 2000;
            this.state = state.CHECK_FORGE;
        } else {
            this.timeouts.NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
        }
    }

    /**
     * Wait for winner slot
     * @param {Number} currentBlock 
     */
    async _checkWaitForge(currentBlock) {
        this.timeouts.NEXT_STATE = 5000;
        if (currentBlock >= this.infoCurrentBatch.fromBlock) {
            this.timeouts.NEXT_STATE = 0;
            this.state = state.SYNCHRONIZING;
            this.infoCurrentBatch.waiting = true;
        } 
    }

    /**
     * Gets batch builder
     * Checks server-proof availability
     * Send zkSnark input to sever-proof
     */
    async _buildBatch() {

        // Update deposit fees 
        this._getDepositFee();

        // Check if batch has been built
        if (this.infoCurrentBatch.waiting) this.infoCurrentBatch.waiting = false;

        if(!this.infoCurrentBatch.builded) { // If batch has been already built
            const bbTmp = await this.rollupSynch.getBatchBuilder();
            await bbTmp.build();
            const tmpStateOnchain = bbTmp.getTmpStateOnChain();
            
            const bb = await this.rollupSynch.getBatchBuilder();
            bb.addBeneficiaryAddress(this.infoCurrentBatch.beneficiaryAddress);
            this.infoCurrentBatch.tmpOnChainHash = bb.getTmpOnChainHash();
            await this.poolTx.fillBatch(bb, tmpStateOnchain);
            this.infoCurrentBatch.batchData = bb;
            this.infoCurrentBatch.builded = true;
            this.infoCurrentBatch.depositFee = this.feeDepOffChain;
        }

        // Check server proof is available
        const resServer = await this.cliServerProof.getStatus();
        if (resServer.data.state != stateServer.IDLE){
            // time to reset server proof
            await this.cliServerProof.cancel();
            await timeout(2000);
        }
        const res = await this.cliServerProof.setInput(stringifyBigInts(this.infoCurrentBatch.batchData.getInput()));
        // retry build or send inputs to server-proof
        if (res.status == 200) {
            this.infoCurrentBatch.startTime = performance.now();
            this.timeouts.NEXT_STATE = 0;
            this.state = state.GET_PROOF;
        } else {
            this.timeouts.NEXT_STATE = 5000;
            this.infoCurrentBatch.retryTimes += 1;
        }
    }

    /**
     * Checks state of server-proof
     * If server-proof finishes correctly:
     * - sends proof to Rollup PoB using `commitAndForge` batch
     */
    async _stateProof() {
        const res = await this.cliServerProof.getStatus();
        const statusServer = res.data.state;
        const currentBlock = await this.pobSynch.getCurrentBlock();

        if (statusServer == stateServer.FINISHED) {
            let cancelProof;

            if (this.infoCurrentBatch.checkForge) {
                // Check that the end of slot has not been reached
                cancelProof = await this._endSlot(currentBlock);
            } else {
                // Check I am still the winner
                cancelProof = !(await this._stillWinner());
            }
            
            if (cancelProof) {
                // Cancel proof calculation
                await this.cliServerProof.cancel();
                this.state = state.SYNCHRONIZING;
                this._resetInfoBatch();
                this._resetInfoTx();
                return;
            }

            // get proof, commit data and forge block
            const proofServer = generateCall(res.data.proof);
            const commitData = this.infoCurrentBatch.batchData.getDataAvailableSM();
            const depOffChainData = `0x${this.infoCurrentBatch.batchData.getDepOffChainData().toString("hex")}`;

            // + 1% in case some batch is fullfilled and the fee increases, the remaining fee is transfer back to the operator
            const feeDepOffChain = this.infoCurrentBatch.batchData.depOffChainTxs.length * this.infoCurrentBatch.depositFee; 
            // Check if proof has the inputs
            const publicInputsBb = buildPublicInputsSm(this.infoCurrentBatch.batchData);
            if (!proofServer.publicInputs){ // get inputs from batchBuilder
                proofServer.publicInputs = publicInputsBb;
            } else {
                // sanity check
                for (let i = 0; i < publicInputsBb.length; i++){
                    if (publicInputsBb[i] !== proofServer.publicInputs[i])
                        this._errorTx("Proof public inputs does not match with batch public inputs");
                }
            }

            let txSign;
            let tx;
            if  (this.infoCurrentBatch.checkForge) {
                [txSign, tx] = await this.opManager.getTxCommitAndForgeDeadline(commitData, proofServer.proofA, proofServer.proofB,
                    proofServer.proofC, proofServer.publicInputs, depOffChainData, feeDepOffChain); 
            } else {
                [txSign, tx] = await this.opManager.getTxCommitAndForge(commitData, proofServer.proofA, proofServer.proofB,
                    proofServer.proofC, proofServer.publicInputs, depOffChainData, feeDepOffChain);
            }
                 
            if (txSign.error){
                this._logWarning(txSign.error);
                this._resetInfoTx();
                this._resetInfoBatch();
                this.timeouts.NEXT_STATE = 0;
                this.state = state.SYNCHRONIZING;
                return;
            }

            this._setInfoTx(tx, txSign.transactionHash);

            this.state = state.MINING;
            this.timeouts.NEXT_STATE = 1000;
            const self = this;
            try { // sanity check
                await this.web3.eth.call(this.currentTx.tx);
            } catch (error) { // error evm transaction
                this._errorTx(error.message); 
                return;
            }
            this.web3.eth.sendSignedTransaction(txSign.rawTransaction)
                .then( receipt => {
                    if (receipt.status == true) {
                        self._logTxOK();
                        self.timeouts.NEXT_STATE = 5000;
                        self.state = state.SYNCHRONIZING;
                        self._resetInfoTx();
                        self._resetInfoBatch();
                    } else { // unreachable code
                        self._errorTx("unreachable code loop-manager stateProof: should be OK like the .call() sanity check");
                    }
                })
                .catch( async (error) => {
                    if (error.message.includes("Transaction was not mined within")) { //polling timeout
                        self.overwriteTx = true;
                        self._logTxOverwrite();
                    } else { 
                        if(error.receipt) { // EVM error
                            await self.web3.eth.call(this.currentTx.tx, error.receipt.blocknumber) //catch the error
                                .then( () => {
                                    self._errorTx("unreachable code loop-manager stateProof: should be an error as the signed transaction, could run out of gas");
                                })
                                .catch( error => {
                                    self._errorTx(error.message);
                                });
                        } else { //no EVM error
                            self._errorTx(error.message); 
                        }
                    }
                });
        } else if (statusServer == stateServer.ERROR) {
            this.timeouts.NEXT_STATE = 5000;
            // reset server-proof and re-send input
            await this.cliServerProof.cancel();
            await timeout(2000); // time to reset the server-proof 
            this.state = state.BUILD_BATCH;
            this.infoCurrentBatch.retryTimes += 1;
        } else if (statusServer == stateServer.IDLE) {
            this.timeouts.NEXT_STATE = 5000;
            // re-send input to server-proof
            this.state = state.BUILD_BATCH;
            this.infoCurrentBatch.retryTimes += 1;
        } else { // Server in pending sate
            this.timeouts.NEXT_STATE = 5000;

            const checkState = await this._checkStateRollup();  //true --> the state matches with the SC

            let cancelProof;
            if(this.infoCurrentBatch.checkForge) {
                // Check that the end of slot has not been reached
                cancelProof = await this._endSlot(currentBlock);
            } else {
                // Check I am still the winner
                cancelProof = !(await this._stillWinner());
            }
            if (!checkState || cancelProof) {
                // Cancel proof calculation
                await this.cliServerProof.cancel();
                this.state = state.SYNCHRONIZING;
                this._resetInfoBatch();
                this._resetInfoTx();
                return;
            }
        }
    }

    /**
     * Monitors `commitAndForge` transaction
     */
    async _monitorTx(){

        if (!this.overwriteTx)
            return; 

        this.overwriteTx = false;
        if (this.currentTx.attempts > 5) {
            this._errorTx("it has been overwritten more than 5 times");
            return; 
        }
        const dataTx = await this.web3.eth.getTransaction(this.currentTx.txHash);
        if (!dataTx) {
            this._errorTx();
            return;
        }
        if (dataTx.blocknumber) { //already mined!
            this.timeouts.NEXT_STATE = 5000;
            this.state = state.SYNCHRONIZING;
            this._logTxOK();
            this._resetInfoTx();
            this._resetInfoBatch();
            return;
        }
        const txSign = await this.opManager.signTransaction(this.currentTx.tx);

        if (txSign.error){
            this._logWarning(txSign.error);
            this._resetInfoTx();
            this._resetInfoBatch();
            this.timeouts.NEXT_STATE = 0;
            this.state = state.SYNCHRONIZING;
            return;
        }

        this._updateTx(txSign.transactionHash);
        this._logResendTx();
        const self = this;

        try { //sanity check
            await this.web3.eth.call(this.currentTx.tx);
        } catch (error) { //error EVM transaction
            this._errorTx(error.message);
            return;
        }
        this.web3.eth.sendSignedTransaction(txSign.rawTransaction)
            .then( receipt => {
                if (receipt.status == true) {
                    self.timeouts.NEXT_STATE = 5000;
                    self.state = state.SYNCHRONIZING;
                    self._logTxOK();
                    self._resetInfoTx();
                    self._resetInfoBatch();
                } else { //unreachable code
                    self._errorTx("unreachable code loop-manager monitor: should be OK like the .call() sanity check");
                }   
            })
            .catch( async (error) => {
                if (error.message.includes("Transaction was not mined within")) { // polling timeout
                    self.overwriteTx = true;
                    self._logTxOverwrite();
                } else { 
                    if (error.receipt) { // EVM error
                        await self.web3.eth.call(this.currentTx.tx, error.receipt.blocknumber) // catch the error
                            .then( () => {
                                self._errorTx("unreachable code loop-manager monitor: should be an error as the signed transaction, could run out of gas");
                            })
                            .catch( error => {
                                self._errorTx(error.message);
                            });
                    } else { // another error no EVM
                        self._errorTx(error.message); 
                    }
                }
            });
    }

    async _getDepositFee(){
        // get fee for deposits off-chain
        const feeWei = await this.rollupSynch.getFeeDepOffChain();
        const feeEth = this.web3.utils.fromWei(feeWei.toString() , "ether");
        this.feeDepOffChain = Number(feeEth);
        this.poolTx.setFeeDeposit(this.feeDepOffChain);
    }

    async _checkForge(){
        const slots = await this.pobSynch.getSlotWinners();
        const slotWinner = slots[0];
        const currentBlock = await this.pobSynch.getCurrentBlock();
        const toBlock = await this.pobSynch.getBlockBySlot(slotWinner + 1);
        const deadlineBlock = await this.pobSynch.getBlockBySlot(slotWinner + 1) - this.slotDeadline;
        this.infoCurrentBatch.deadlineBlock = deadlineBlock;
        if (currentBlock >= deadlineBlock) {
            this._setInfoBatch();
            this.infoCurrentBatch.toBlock = toBlock;
            this.infoCurrentBatch.beneficiaryAddress = this.opManager.wallet.address;
            this.infoCurrentBatch.checkForge = true;
            this.infoCurrentBatch.waiting = true;
            this.timeouts.NEXT_STATE = 0;
            this.state = state.SYNCHRONIZING;
        } else {
            this.timeouts.NEXT_STATE = 2000;
            this.state = state.SYNCHRONIZING;
        }
    }

    /**
     * Check if operator is still the winner
     * @param {Number} currentBlock
     * @returns {Bool} - true if the operator is still a winner
     */
    async _stillWinner(){
        const winners = await this.pobSynch.getWinners();
        const opWinner = winners[0];
        const forgerAddress = this.opManager.wallet.address;
        if (opWinner === forgerAddress) {
            return true;
        }
        this._logWarning("Reach end of slot and you are not the winner. Cancelling proof computation");
        return false;
    }

    /**
     * Checks and log if end of slot has been reached
     * Also checks if I will be the next winner
     * @param {Number} currentBlock
     * @returns {Bool} - true if end of slot has been reached, false otherwise  
     */
    async _endSlot(currentBlock){
        const slots = await this.pobSynch.getSlotWinners();
        const winners = await this.pobSynch.getWinners();
        const currentSlot = this.pobSynch.getSlotByBlock(currentBlock);
        const indexOfSlot = slots.indexOf(Number(currentSlot));
        const imWinner = (winners[indexOfSlot] === this.opManager.wallet.address);
        if (currentBlock >= this.infoCurrentBatch.toBlock && !imWinner){
            this._logWarning("Reach end of slot. Cancelling proof computation");
            return true;
        } else if (currentBlock >= this.infoCurrentBatch.toBlock && imWinner){
            this.infoCurrentBatch.checkForge = false;
            return false;
        }
        return false;
    }


    /**
     * Initialize batch information
     * @param {Number} fromBlock - Ethereum block when the operator is able to forge  
     * @param {Number} toBlock - Ethereum block until the operatir is able to forge
     * @param {String} forgerAddress - operator forger address
     * @param {String} beneficiaryAddress - operator beneficiary address
     */
    _setInfoBatch(fromBlock, toBlock, forgerAddress, beneficiaryAddress){
        this.infoCurrentBatch.fromBlock = fromBlock;
        this.infoCurrentBatch.toBlock = toBlock;
        this.infoCurrentBatch.forgerAddress = forgerAddress;
        this.infoCurrentBatch.beneficiaryAddress = beneficiaryAddress;
        this.infoCurrentBatch.builded = false;
        this.infoCurrentBatch.batchData = undefined;
        this.infoCurrentBatch.waiting = false;
        this.infoCurrentBatch.startTime = 0;
        if (this.infoCurrentBatch.retryTimes !== undefined) this.infoCurrentBatch.retryTimes += 1;
        else this.infoCurrentBatch.retryTimes = 0;
    }

    /**
     * Reset batch information
     */
    _resetInfoBatch(){
        this.infoCurrentBatch = {};
    }

    /**
     * Initialize transaction information 
     * @param {Object} tx - ethereum transaction
     * @param {String} transactionHash - transaction hashx
     */
    _setInfoTx(tx, transactionHash){
        this.currentTx.startTx = performance.now();
        this.currentTx.txHash = transactionHash;
        this.currentTx.tx = tx;
        this.currentTx.attempts = 0;
    }

    /**
     * Reset transaction information
     */
    _resetInfoTx(){
        this.currentTx = {};
    }

    /**
     * Update ethereum transaction
     * @param {String} transactionHash - new transaction hash
     */
    _updateTx(transactionHash){
        // set double gas price 
        this.currentTx.tx.gasPrice = Scalar.mul(this.currentTx.tx.gasPrice, 2).toString(); 
        this.currentTx.startTx = performance.now();
        this.currentTx.attempts += 1;
        this.currentTx.txHash = transactionHash;
    }

    /**
     * Checks rollup core contract parameters:
     * - state root
     * - mining on-chain hash
     */
    async _checkStateRollup(){
        const currentStateRoot = await this.rollupSynch.getCurrentStateRoot();
        const currentOnchainHash = await this.rollupSynch.getMiningOnchainHash();
        
        if (Scalar.eq(currentStateRoot, this.infoCurrentBatch.batchData.getOldStateRoot()) &&
            Scalar.eq(currentOnchainHash, this.infoCurrentBatch.tmpOnChainHash)) {
            return true;
        } else { 
            let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])} | `;
            info += `${chalk.bgYellow.black("state info")}`;
            info += " ==> Current information of state root and/or onChain hash does not match with SC";
            this.logger.info(info);
            return false;
        }
    }

    /**
     * Actions due to error:
     * - log error message
     * - reset transaction and batch
     * - go to SYNCH state
     * @param {String} reason - Error message 
     */
    _errorTx(reason) { 
        this._logTxKO(reason); 
        this._resetInfoTx();
        this._resetInfoBatch();
        this.timeouts.NEXT_STATE = 0;
        this.state = state.SYNCHRONIZING;
    }

    /**
     * Send directly to logger information regarding an overwrite transaction action
     */
    _logTxOverwrite(){
        let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])}`;
        info += " | info ==> ";
        info += `${chalk.white.bold("Overwriting Tx")}`;
        this.logger.info(info);
    }

    /**
     * Sends directly to logger information regarding successful mined transaction
     */
    _logTxOK(){
        let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])}`;
        info += " | info ==> ";
        info += `${chalk.white.bold("Transaction mined succesfully")}`;
        this.logger.info(info);
    }

    /**
     * Sends directly to logger information regarding error mined transaction
     * @param {String} reason 
     */
    _logTxKO(reason){
        let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])} | `;
        info += `${chalk.bgRed.black("transaction info")}`;
        if (reason)
            info += `${chalk.white.bold(` ==> Error at transaction: ${reason}`)}`;
        else   
            info += `${chalk.white.bold(" ==> Error at transaction, try to forge batch again")}`;
        this.logger.info(info);
    }

    /**
     * Sends directly to logger information regarding resend ethereum transaction
     */
    _logResendTx(){
        let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])}`;
        info += " | info ==> ";
        info += `${chalk.white.bold("Overwrite previous transaction doubling the gas price")}`;
        this.logger.info(info);
    }

    /**
     * Sends directly to logger warning information
     * @param {String} reason - warning text information
     */
    _logWarning(reason){
        let info = `${chalk.yellowBright("OPERATOR STATE: ")}${chalk.white(strState[this.state])} | `;
        info += `${chalk.bgYellow.black("warning info")}`;
        info += ` ==> ${chalk.white.bold(`${reason}`)}`;
        this.logger.info(info);
    }
}

module.exports = LoopManager;