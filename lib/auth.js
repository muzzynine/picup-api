'use strict';

/**
 * Created by impyeong-gang on 9/17/15.
 */
var passport = require('passport');
var BearerStrategy = require('passport-http-bearer').Strategy;
var http = require('http');
var config = require('../config/config');
var AppError = require('./appError');
var _ = require('lodash');
var bunyan = require("bunyan");
var log = bunyan.getLogger('AuthenticationLogger');


var setPassportStrategy = function(){
    /*
       All the API Request must be authenticated by bearer strategy.
       if successful passed, next() include scope information at the req.authInfo field.
     */

    passport.use(new BearerStrategy({
        passReqToCallback: true
    }, function(req, accessToken, done){
        var User = req.app.get('models').user;
        /* 인증서버에 토큰 인증을 요청함 */
        var statusCode = null;
	var data = "";
	var option = {
	    hostname: config.authServer.addr,
            port : config.authServer.port,
            path : config.authServer.authPath,
            method: 'GET',
	    headers: {
		'Authorization': 'Bearer ' +accessToken
	    }
	};

	var request = http.request(option, function(response){
	    statusCode = response.statusCode;
            response.setEncoding('utf8');
            response.on('data', function(chunk){
                data += chunk;
            });
            response.on('end', function(){
                switch(statusCode){
                case 200 :
		    var response = JSON.parse(data);
		    
                    User.findUserById(response.uid).then(function(user){
                        done(null, user);
                    }).catch(function(err){
                        done(err);
                    });
                    break;
		case 401 :

                case 403:
                    //Forbidden
                case 404:
                    //NotExistResource
                    done(AppError.throwAppError(403, "Authentication failed"));
                    break;
                case 500:
                default:
                    done(AppError.throwAppError(500, "Received status code 500 from auth server"));
                    break;
                }
            });
	});
	request.end();

	request.on('error', function(err){
	    return done(AppError.throwAppError(500, err.toString()));
	});
    }));
};

var checkScope = function(req, res, next){
    if(!req.authInfo || !req.user){
        return next(AppError.throwAppError(403));
    }
    if(!_.includes(req.authInfo.scope, 'picup_user')){
        return next(AppError.throwAppError(401));
    }
    next();
};


exports.setPassportStrategy = setPassportStrategy;
exports.checkScope = checkScope;
