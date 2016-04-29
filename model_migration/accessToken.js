/**
 * Created by impyeong-gang on 1/11/16.
 */
var AccessTokenScheme = require('./scheme').ACCESS_TOKEN;
var AppError = require('../lib/appError');

module.exports = function(connection){
    var AccessToken =  connection.define(AccessTokenScheme.TABLE, AccessTokenScheme.SCHEME, AccessTokenScheme.OPTION);

    return AccessToken;
};
