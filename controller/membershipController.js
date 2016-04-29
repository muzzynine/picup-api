/**
 * Created by impyeong-gang on 12/18/15.
 */
var Promise = require('bluebird');
var validator = require('./../lib/validator');
var validation = require('./../lib/validation');
var AppError = require('./../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('MembershipLogger');

var getMyProfile = function(user, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroupList(user).then(function(groupIds){
            return User.getAuthInfo(user).then(function(auth){
                var result = {
                    id : user.id,
                    nickname : user.nickname,
                    profileS3path : user.profilePath,
                    authType : auth.authType,
                    group : groupIds
                };
                resolve(result);
            });
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

var getProfile = function(uid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.findUserById(uid).then(function(user){
            return User.getGroupList(user).then(function(groupIds){
                var result = {
                    id : user.id,
                    nickname : user.nickname,
                    profileS3path: user.profilePath,
                    group : groupIds
                };
                resolve(result);
            });
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

var getUserProfilePath = function(user, db){
    return new Promise(function(resolve, reject){
        try {
            var User = db.user;
            var s3path = User.getProfileS3path(user.id);
        } catch(err){
            throw AppError.throwAppError(500, err.toString());
        }
        resolve(s3path);
    })
};

var setProfile = function(user, nickname, s3path, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.setProfile(user, nickname, s3path).then(function(){
            resolve(user);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

exports.getMyProfile = getMyProfile;
exports.getProfile = getProfile;
exports.getUserProfilePath = getUserProfilePath;
exports.setProfile = setProfile;
