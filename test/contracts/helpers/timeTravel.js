/* global web3 */
module.exports = seconds => new Promise((resolve, reject) => {
  web3.currentProvider.send(
    {
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds],
      id: new Date().getTime(),
    },
    // eslint-disable-next-line consistent-return
    (err1) => {
      if (err1) return reject(err1);
      web3.currentProvider.send(
        {
          jsonrpc: '2.0',
          method: 'evm_mine',
          params: [],
          id: new Date().getTime(),
        },
        // eslint-disable-next-line consistent-return
        (err2) => {
          if (err2) return reject(err2);
          resolve();
        },
      );
    },
  );
});
