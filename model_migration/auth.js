/**
 * Created by impyeong-gang on 1/14/16.
 */
var AuthScheme = require('./scheme').AUTH;


module.exports = function(connection){
    var Auth = connection.define(AuthScheme.TABLE, AuthScheme.SCHEME, AuthScheme.OPTION);

    return Auth;
};
