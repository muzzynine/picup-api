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
        var body = "";
        var toRequest = http.request({
            hostname: config.auth_server.addr,
            port : config.auth_server.port,
            path : config.auth_server.authPath + "?accessToken="+accessToken,
            method: 'GET'
        }, function(res){
            statusCode = res.statusCode;
            res.setEncoding('utf8');
            res.on('data', function(chunk){
                body += chunk;
            });
            res.on('end', function(){
                var response = JSON.parse(body);
                switch(statusCode){
                    case 200 :
                        User.findUserById(response.uid).then(function(user){
                            return done(null, user);
                            }).catch(function(err){
                            return done(err);
                        });
                        break;

                    case 403:
                        //Forbidden
                    case 404:
                        //NotExistResource
                        return done(new AppError.throwAppError(403));
                        break;

                    case 500:
                    default:
                        return done(new AppError.throwAppError(500));
                        log.error('Received status code 500 from auth server');
                        break;
                }
            });
        });
            toRequest.end();
    }));
};

var checkScope = function(req, res, next){
    if(!req.authInfo || !req.user){
        return next(new AppError.throwAppError(403));
    }
    if(!_.includes(req.authInfo.scope, 'picup_user')){
        return next(new AppError.throwAppError(401));
    }
    next();
};


exports.setPassportStrategy = setPassportStrategy;
exports.checkScope = checkScope;
