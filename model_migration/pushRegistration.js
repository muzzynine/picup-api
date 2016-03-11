/**
 * Created by impyeong-gang on 1/11/16.
 */
var PushRegScheme = require('./scheme').PUSH_REGISTRATION;

module.exports = function(connection){
    return connection.define(PushRegScheme.TABLE, PushRegScheme.SCHEME);


};