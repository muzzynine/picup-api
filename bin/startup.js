'use strict'

var os = require('os');
var _ = require('lodash');
var Promise = require('bluebird');

function startupHelper(){}

var getIpAddrV4 = function(){
    var interfaces = os.networkInterfaces();
    var ethernet;
    var addr;
    
    if(interfaces['eth0']){
	ethernet = interfaces['eth0'];
    } else if(interfaces['en0']){
	ethernet = interfaces['en0'];
    } else {
	throw new Error("could not found ethernet");
    }

    _.forEach(ethernet, function(ep){
	if(ep.family === 'IPv4'){
	    addr = ep.address;
	};
    });

    if(addr){
	return addr;
    } else {
	throw new Error("could not found IPv4 address");
    }
};

exports.getIpAddrV4 = getIpAddrV4;
