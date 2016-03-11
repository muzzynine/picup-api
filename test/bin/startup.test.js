var Startup = require('../../bin/startup');
var should = require('should');

describe('Startup - ready for start server', function(){
    describe('#getIpAddrV4', function(){
	it('It works for me', function(){
	    var ipaddr = Startup.getIpAddrV4()
	    console.log(ipaddr);
	});
    });
});
