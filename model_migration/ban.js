var BanScheme = require('./scheme').BAN_INFO;

module.exports = function(connection){
    return connection.define(BanScheme.TABLE,BanScheme.SCHEME, BanScheme.OPTION);
};
	
