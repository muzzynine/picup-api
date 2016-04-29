/**
 * Created by impyeong-gang on 1/11/16.
 */
var ClientScheme = require('./scheme').CLIENT;
var AppError = require('../lib/appError');

module.exports = function(connection){
    return connection.define(ClientScheme.TABLE, ClientScheme.SCHEME, ClientScheme.OPTION);
};










