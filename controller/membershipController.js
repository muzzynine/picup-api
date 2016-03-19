/**
 * Created by impyeong-gang on 12/18/15.
 */
var Promise = require('bluebird');
var validator = require('./../lib/validator');
var validation = require('./../lib/validation');
var AppError = require('./../lib/appError');

var getMyProfile = function(user, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroupList(user).then(function(groupIds){
            return User.getAuthInfo(user).then(function(auth){
                var result = {
                    id : user.id,
                    nickname : user.nickname,
                    profile_s3path : user.profile_path,
                    auth_type : auth.auth_type,
                    group : groupIds
                };
                resolve(result);
            });
        }).catch(function(err){
            log.error("MembershipController#getMyProfile", {err:err});
            reject(err);
        });
    })
};

var getProfile = function(uid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.findUserById(uid).then(function(user){
            return User.getGroupList(user).then(function(groupIds){
                var result = {
                    id : user.id,
                    nickname : user.nickname,
                    profile_s3path: user.profile_path,
                    group : groupIds
                };
                resolve(result);
            });
        }).catch(function(err){
            log.error("MembershipController#getProfile", {err:err});
            reject(err);
        });
    });
};

var getUserProfilePath = function(user, db){
    return new Promise(function(resolve, reject){
        try {
            var User = db.user;
            var s3path = User.getProfileS3path(user.id);
        } catch(err){
            return reject(AppError.throwAppError(500));
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
            log.error("MembershipController#setProfile", {err:err});
            reject(AppError.throwAppError(500));
        });
    })
};

exports.getMyProfile = getMyProfile;
exports.getProfile = getProfile;
exports.getUserProfilePath = getUserProfilePath;
exports.setProfile = setProfile;