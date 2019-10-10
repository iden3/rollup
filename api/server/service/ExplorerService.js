'use strict';


/**
 * Get an operator information.
 * Return an operator that matches the id.
 *
 * id operatorId ID of the operator to return
 * returns operator
 **/
exports.operatorIdGET = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "stake" : 649,
  "minedBatches" : 35497,
  "endpoint" : "https://operator.iden3.io",
  "activeSince" : "2000-01-23T04:56:07.000+00:00",
  "batchRatio" : 0.9856,
  "minedTransactions" : 35497,
  "id" : "",
  "avgUptime" : 0.9856
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Get all the operators id's.
 * Returns an array of all the registered operator id's
 *
 * returns operatorIds
 **/
exports.operatorListGET = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ "", "" ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Get all the operators id's.
 * Returns an array of all the registered operator id's
 *
 * returns operatorStats
 **/
exports.operatorStatsGET = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "avgFee" : 0.000036,
  "totalFee" : 85672.897634,
  "totalStake" : 6349.387,
  "avgUptime" : 0.9856
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Get general metrics of the rollup.
 * Returns various statistics that refelct the state of the rollup
 *
 * returns rollupStats
 **/
exports.statsGET = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "stake" : 756349.8734,
  "totalTransactions" : 908757,
  "activeSince" : "2000-01-23T04:56:07.000+00:00",
  "totalOperators" : 23,
  "currentEra" : "",
  "scheduledSlots" : [ {
    "batches" : [ {
      "slotId" : "",
      "id" : "",
      "eraId" : "",
      "transactions" : "",
      "operatorId" : ""
    }, {
      "slotId" : "",
      "id" : "",
      "eraId" : "",
      "transactions" : "",
      "operatorId" : ""
    } ],
    "id" : "",
    "eraId" : ""
  }, {
    "batches" : [ {
      "slotId" : "",
      "id" : "",
      "eraId" : "",
      "transactions" : "",
      "operatorId" : ""
    }, {
      "slotId" : "",
      "id" : "",
      "eraId" : "",
      "transactions" : "",
      "operatorId" : ""
    } ],
    "id" : "",
    "eraId" : ""
  } ]
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Get a specific transactions.
 * Returns the transaction identified by id.
 *
 * id transactionId ID of the transaction to return
 * returns transaction
 **/
exports.transactionIdGET = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "tokenId" : "",
  "fee" : 2,
  "from" : "",
  "id" : "",
  "to" : "",
  "ammount" : 123
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * Query for transactions.
 * Returns an array of transactions based on the query parameters. If no parameter are porvided, this endpoint will return the most recent transactions.
 *
 * address bigInt If this parameter is porvided, all the returned transactions will have this value as sender or receiver. (optional)
 * from bigInt If this parameter is porvided, all the returned transactions will have this value as sender. (optional)
 * to bigInt If this parameter is porvided, all the returned transactions will have this value as receiver. (optional)
 * block bigInt If this parameter is porvided, all the returned transactions will have this value as block id. (optional)
 * fromId bigInt If this parameter is porvided, all the returned transactions will be previous to the the transaction identified by the provided value. Use to retrieve older transactions that were not included in a query, as in pagination. (optional)
 * returns transactions
 **/
exports.transactionsGET = function(address,from,to,block,fromId) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
  "tokenId" : "",
  "fee" : 2,
  "from" : "",
  "id" : "",
  "to" : "",
  "ammount" : 123
}, {
  "tokenId" : "",
  "fee" : 2,
  "from" : "",
  "id" : "",
  "to" : "",
  "ammount" : 123
} ];
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

