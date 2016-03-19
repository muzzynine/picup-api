var prod = require('./prod_env.js');
var dev = require('./dev_env.js');

module.exports = function(){
    if(process.env.NODE_ENV == "production"){
	return prod;
    } else if(process.env.NODE_ENV == "development"){
	return dev;
    }
    else throw new Error("node_env mismatch");
}();
    
