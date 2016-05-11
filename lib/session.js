var Promise = require('bluebird');
var AppError = require('./appError');
var redis = require('redis');
var bunyan = require('bunyan');
var log = bunyan.getLogger('SessionLogger');

module.exports = RedisSession;

var DEFAULT_TTL = 86400;
var DEFAULT_PREFIX = 'bfg::';

function retryStartegy(options){
    console.log("in");
    console.log(options);
    return Math.max(options.attempt * 100, 3000);
}


    /*
     *options
     * host : redis server hostname
     * port : redis server portno
     * socket : redis server unix_socket
     * url : redis server url
     * pass : redis authentication
     *
     * additional.
     * ttl : redis session TTL in second.
     * disableTTL : disable ttl.
     *  
     */
function RedisSession(options){
    options = options || {};

    this.prefix = options.prefix || DEFAULT_PREFIX;
    delete options.prefix;
    this.client = redis.createClient(options.url, {
	retry_strategy: retryStartegy
    });

    if(options.pass){
	this.client.auth(options.pass, function(err){
	    if(err){
		throw err;
	    }
	});
    }

    this.ttl = options.ttl || DEFAULT_TTL;
    this.disableTTL = options.disableTTL;

    this.client.on('connect', function(){
	log.info("Redis session server connected");
    });

    this.client.on('error', function(replyError){
	log.error('#SessionStore', {err : replyError});
    });
}

RedisSession.prototype.get = function(id){
    var self = this;
    return new Promise(function(resolve, reject){
	var sid = self.prefix + id;

	self.client.get(sid, function(err, data){
	    if(err){
		return reject(AppError.throwAppError(500, err.toString()));
	    }
	    if(!data){
		return reject(AppError.throwAppError(404, "Not exist"))
	    }
	    var result;
	    try{
		result = JSON.parse(data);
	    } catch(err){
		return reject(AppError.throwAppError(500, err.toString()));
	    }
	    resolve(result);
	});
    });
};

RedisSession.prototype.set = function(id, what){
    var self = this;
    return new Promise(function(resolve, reject){
	var args = [];
	args.push(self.prefix + id);
	var data;
	try{
	    data = JSON.stringify(what);
	} catch(err){
	    return reject(AppError.throwAppError(500, err.toString()));
	}
	args.push(data);

	if(!self.disableTTL){
	    args.push('EX', self.ttl);
	}

	self.client.set(args, function(err){
	    if(err){
		return reject(AppError.throwAppError(500, err.toString()));
	    }
	    resolve({
		id : id,
		data : what
	    });
	});
    });
};


RedisSession.prototype.destroy = function(id){
    var self = this;
    return new Promise(function(resolve, reject){
	var sid = self.prefix+id;
	
	self.client.del(sid, function(err){
	    if(err){
		return reject(AppError.throwAppError(500, err.toString()));
	    }
	    resolve();
	});
    });
};

RedisSession.prototype.touch = function(id, what){
    var self = this;
    return new Promise(function(resolve, reject){
	var sid = self.prefix+id;
	if(self.disableTTL){
	    return resolve({
		id : id,
		data : what
	    });
	}

	self.client.expire(sid, self.ttl, function(err){
	    if(err){
		return reject(AppError.throwAppError(500, err.toString()));
	    }
	    resolve({
		id : id,
		data : what
	    });
	});
    });
};

