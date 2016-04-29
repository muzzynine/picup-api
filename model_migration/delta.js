/**
 * Created by impyeong-gang on 1/11/16.
 */
var Promise = require('bluebird');
var DeltaScheme = require('./scheme').DELTA;
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

module.exports = function(connection){
    return  connection.define(DeltaScheme.TABLE, DeltaScheme.SCHEME, DeltaScheme.OPTION);
};
