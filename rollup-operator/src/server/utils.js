const readline = require("readline");
const { Writable } = require("stream");

/**
 * Check environment variables
 * @returns {Bool} - true if some variables is not found, false otherwise
 */
function checkEnvVariables(){
    if (!process.env.CONFIG_SYNCH || 
        !process.env.CONFIG_POOL ||
        !process.env.OPERATOR_PORT_EXTERNAL ||
        !process.env.URL_SERVER_PROOF 
    ) {
        return true;
    }
    else return false;
}

/**
 * Check password environment variable
 * @returns {Bool} - true if password variable is not found, false otherwise
 */
function checkPassEnv(){
    if (!process.env.PASSWORD) return true;
    return false;
}

/**
 * Ask password on console
 * @returns {String} - user input
 */
function getPassword() {
    return new Promise((resolve) => {
        const mutableStdout = new Writable({
            write(chunk, encoding, callback) {
                if (!this.muted) {
                    process.stdout.write(chunk, encoding);
                }
                callback();
            },
        });
        const rl = readline.createInterface({
            input: process.stdin,
            output: mutableStdout,
            terminal: true,
        });
        rl.question("Password: ", (password) => {
            rl.close();
            console.log("");
            resolve(password);
        });
        mutableStdout.muted = true;
    });
}

module.exports = {
    checkEnvVariables,
    checkPassEnv,
    getPassword,
};
