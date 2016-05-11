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

     /*
      * 모든 API Request는 bearer 인증을 필요로 한다.
      * 인증에 성공하면 done에 유저의 정보를 넘긴다. 이후 request의 authInfo에 유저객체가 포함된다.
      * 
      * 인증은 다음과 같은 순서로 진행된다.
      * 1. 세션 스토어에 bearer토큰을 키값으로 요청
      * 2-1. 성공할 경우(유저정보가 세션에 있을 경우) done() 진행.
      * 2-2. 실패하였으며 404(Not found)가 아닐경우 done(err) 진행.
      * 2-3. 실패하였으며 404(Not found)일 떄 인증서버로 인증 요청
      * 3. 인증서버로 부터 온 응답으로 done() 진행 
      *
      */

    passport.use(new BearerStrategy({
        passReqToCallback: true
    }, function(req, accessToken, done){
        var User = req.app.get('models').user;
	var Session = req.app.get('session');

	Session.get(accessToken).then(function(userInfo){
	    var user = User.build({
		id : userInfo.id,
		nickname : userInfo.nickname,
		profilePath : userInfo.profilePath
	    }, { isNewRecord : false });
	    return Session.touch(accessToken).then(function(){
		done(null, user);
	    }).catch(function(err){
		done(null, user);
	    });
	}).catch(function(err){
	    if(err.isAppError){
		//세션 스토어에 요청한 키가 존재하지 않는 경우 인증서버로 요청 진행
		if(err.errorCode === 404){
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
				var userInfo = JSON.parse(data);

				var user = User.build({
				    id : userInfo.id,
				    nickname : userInfo.nickname,
				    profilePath : userInfo.profilePath
				}, {isNewRecord : false});

				done(null, user);
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
		} else {
		    //404 응답이 아닐 경우는 이 후 에러핸들러에서 처리하도록 한다.
		    done(err);
		}
	    } else {
		//AppError가 아닐 경우
		done(AppError.throwAppError(500, err.toString()));
	    }
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
