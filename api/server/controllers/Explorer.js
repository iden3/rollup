'use strict';

var utils = require('../utils/writer.js');
var onError = require('../utils/errorManager.js').onError;
var Explorer = require('../service/ExplorerService');

module.exports.operatorIdGET = function operatorIdGET (req, res, next) {
  var id = req.swagger.params['id'].value;
  Explorer.operatorIdGET(id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.operatorListGET = function operatorListGET (req, res, next) {
  Explorer.operatorListGET()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.operatorStatsGET = function operatorStatsGET (req, res, next) {
  Explorer.operatorStatsGET()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.statsGET = function statsGET (req, res, next) {
  Explorer.statsGET()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.transactionIdGET = function transactionIdGET (req, res, next) {
  var id = req.swagger.params['id'].value;
  Explorer.transactionIdGET(id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};

module.exports.transactionsGET = function transactionsGET (req, res, next) {
  var address = req.swagger.params['address'].value;
  var from = req.swagger.params['from'].value;
  var to = req.swagger.params['to'].value;
  var block = req.swagger.params['block'].value;
  var fromId = req.swagger.params['fromId'].value;
  Explorer.transactionsGET(address,from,to,block,fromId)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (err) {
      onError(err, req, res);
    });
};
