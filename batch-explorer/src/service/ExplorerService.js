'use strict';


/**
 * Get a specific batch.
 * Returns the batch identified by id.
 *
 * id batchId ID of the transaction to return
 * returns batch
 **/
exports.getBatchById = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "id" : "0x0000050a2cbAbA54Ec6426065223B652b8b39133",
      "operatorId" : "0x0000000000bAbA54Ec6426065223B652b8b39133",
      "transactions" : [ {
        "id" : "0x1116B50a2cbAbA54Ec6426065223B652b8b39133",
        "from" : "0xaAa6B50a2cbAbA54Ec6426065223B652b8b39133",
        "to" : "0xbBb6B50a2cbAbA54Ec6426065223B652b8b39133",
        "tokenId" : "0xcCc6B50a2cbAbA54Ec6426065223B652b8b39133",
        "ammount" : 133,
        "fee" : 2
      } ],
      "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
      "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get a specific era.
 * Returns the era identified by id.
 *
 * id eraId ID of the era to return
 * returns era
 **/
exports.getEraById = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "id" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133",
      "slots" : [ {
        "id" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
        "batches" : [ {
          "id" : "0x0000050a2cbAbA54Ec6426065223B652b8b39133",
          "operatorId" : "0x0000000000bAbA54Ec6426065223B652b8b39133",
          "transactions" : [ {
            "id" : "0x1116B50a2cbAbA54Ec6426065223B652b8b39133",
            "from" : "0xaAa6B50a2cbAbA54Ec6426065223B652b8b39133",
            "to" : "0xbBb6B50a2cbAbA54Ec6426065223B652b8b39133",
            "tokenId" : "0xcCc6B50a2cbAbA54Ec6426065223B652b8b39133",
            "ammount" : 133,
            "fee" : 2
          } ],
          "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
          "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
        } ],
        "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
      } ]
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get an operator information.
 * Return an operator that matches the id.
 *
 * id operatorId ID of the operator to return
 * returns operator
 **/
exports.getOperatorById = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "id" : "0x55F6B50a2cbAbA54Ec6426065223B652b8b39111",
      "endpoint" : "http://operator.iden3.io",
      "stake" : 649,
      "activeSince" : "2019-10-11T14:04:01.067Z",
      "avgUptime" : 0.9856,
      "minedTransactions" : 35497,
      "minedBatches" : 35497,
      "batchRatio" : 0.9857
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get all the operators id's.
 * Returns an array of all the registered operator id's
 *
 * returns operatorIds
 **/
exports.getOperatorList = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ "0x44F6B50a2cbAbA54Ec6426065223B652b8b39122", "0x44F6B50a2cbAbA54Ec6426065223B652b8b39122" ];
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get all the operators id's.
 * Returns an array of all the registered operator id's
 *
 * returns operatorStats
 **/
exports.getOperatorStats = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "avgFee" : 0.000036,
      "totalFee" : 85672.897634,
      "totalStake" : 6349.387,
      "avgUptime" : 0.9856
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get a specific slot.
 * Returns the slot identified by id.
 *
 * id slotId ID of the slot to return
 * returns slot
 **/
exports.getSlotById = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "id" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
      "batches" : [ {
        "id" : "0x0000050a2cbAbA54Ec6426065223B652b8b39133",
        "operatorId" : "0x0000000000bAbA54Ec6426065223B652b8b39133",
        "transactions" : [ {
          "id" : "0x1116B50a2cbAbA54Ec6426065223B652b8b39133",
          "from" : "0xaAa6B50a2cbAbA54Ec6426065223B652b8b39133",
          "to" : "0xbBb6B50a2cbAbA54Ec6426065223B652b8b39133",
          "tokenId" : "0xcCc6B50a2cbAbA54Ec6426065223B652b8b39133",
          "ammount" : 133,
          "fee" : 2
        } ],
        "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
        "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
      } ],
      "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get general metrics of the rollup.
 * Returns various statistics that refelct the state of the rollup
 *
 * returns rollupStats
 **/
exports.getStats = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "currentEra" : {
        "id" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133",
        "slots" : [ {
          "id" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
          "batches" : [ {
            "id" : "0x0000050a2cbAbA54Ec6426065223B652b8b39133",
            "operatorId" : "0x0000000000bAbA54Ec6426065223B652b8b39133",
            "transactions" : [ {
              "id" : "0x1116B50a2cbAbA54Ec6426065223B652b8b39133",
              "from" : "0xaAa6B50a2cbAbA54Ec6426065223B652b8b39133",
              "to" : "0xbBb6B50a2cbAbA54Ec6426065223B652b8b39133",
              "tokenId" : "0xcCc6B50a2cbAbA54Ec6426065223B652b8b39133",
              "ammount" : 133,
              "fee" : 2
            } ],
            "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
            "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
          } ],
          "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
        } ]
      },
      "scheduledSlots" : [ {
        "id" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39134",
        "batches" : [ {
          "id" : "0x0000050a2cbAbA54Ec6426065223B652b8b39133",
          "operatorId" : "0x0000000000bAbA54Ec6426065223B652b8b39133",
          "transactions" : [ ],
          "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39134",
          "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
        } ],
        "slotId" : "0x5556B50a2cbAbA54Ec6426065223B652b8b39133",
        "eraId" : "0x6666B50a2cbAbA54Ec6426065223B652b8b39133"
      } ],
      "totalOperators" : 23,
      "stake" : 756349.8734,
      "totalTransactions" : 908757,
      "activeSince" : "2019-10-11T14:45:21.500Z"
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Get a specific transaction.
 * Returns the transaction identified by id.
 *
 * id transactionId ID of the transaction to return
 * returns transaction
 **/
exports.getTransactionById = function(id) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "id" : "0xAAA6B50a2cbAbA54Ec6426065223B652b8b39133",
      "from" : "0xBBB6B50a2cbAbA54Ec6426065223B652b8b39133",
      "to" : "0xCCC6B50a2cbAbA54Ec6426065223B652b8b39133",
      "tokenId" : "0xDDD6B50a2cbAbA54Ec6426065223B652b8b39133",
      "ammount" : 133,
      "fee" : 2
    };
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}


/**
 * Query for transactions.
 * Returns an array of transactions based on the query parameters. If no parameter are porvided, this endpoint will return the most recent transactions.
 *
 * address address If this parameter is porvided, all the returned transactions will have this value as sender or receiver. (optional)
 * from address If this parameter is porvided, all the returned transactions will have this value as sender. (optional)
 * to address If this parameter is porvided, all the returned transactions will have this value as receiver. (optional)
 * fromBatch batchId If this parameter is porvided, all the returned transactions will have been mined in the indicated batch (fromBatch) or older batches. Use to retrieve older transactions that were not included in a query, as in pagination. (optional)
 * returns transactions
 **/
exports.getTransactions = function(address,from,to,fromBatch) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = [ {
      "id" : "0xAAA6B50a2cbAbA54Ec6426065223B652b8b39133",
      "from" : "0xBBB6B50a2cbAbA54Ec6426065223B652b8b39133",
      "to" : "0xCCC6B50a2cbAbA54Ec6426065223B652b8b39133",
      "tokenId" : "0xDDD6B50a2cbAbA54Ec6426065223B652b8b39133",
      "ammount" : 133,
      "fee" : 2
    }, {
      "id" : "0xAAA6B50a2cbAbA54Ec6426065223B652b8b39133",
      "from" : "0xBBB6B50a2cbAbA54Ec6426065223B652b8b39133",
      "to" : "0xCCC6B50a2cbAbA54Ec6426065223B652b8b39133",
      "tokenId" : "0xDDD6B50a2cbAbA54Ec6426065223B652b8b39133",
      "ammount" : 133,
      "fee" : 2
    }];
    // RETURNING A MOCKUP, NOT IMPLEMENTED YET
    reject({
      notImplemented: true,
      mockup: examples[Object.keys(examples)[0]]
    })
    // return resolve(answer);
  });
}
