'use strict';

var utils = require('../utils/writer.js');
var onError = require('../utils/errorManager.js').onError;
var Explorer = require('../service/ExplorerService');

module.exports.getOperatorById = function getOperatorById (req, res, next) {
  var id = req.swagger.params['id'].value;
  Explorer.getOperatorById(id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.getOperatorList = function getOperatorList (req, res, next) {
  Explorer.getOperatorList()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.getOperatorStats = function getOperatorStats (req, res, next) {
  Explorer.getOperatorStats()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.getStats = function getStats (req, res, next) {
  Explorer.getStats()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.getTransactionById = function getTransactionById (req, res, next) {
  var id = req.swagger.params['id'].value;
  Explorer.getTransactionById(id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.getTransactions = function getTransactions (req, res, next) {
  var address = req.swagger.params['address'].value;
  var from = req.swagger.params['from'].value;
  var to = req.swagger.params['to'].value;
  var block = req.swagger.params['block'].value;
  var fromId = req.swagger.params['fromId'].value;
  Explorer.getTransactions(address,from,to,block,fromId)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};
