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
    var User = db.user;

    return User.getGroupList(user).then(function(groupIds){
        return User.getAuthInfo(user).then(function(auth){
            var result = {
                id : user.id,
                nickname : user.nickname,
                profileS3path : user.profilePath,
                authType : auth.authType,
                group : groupIds
            };
            return result;
        });
    })
};

var getProfile = function(uid, db){
    var User = db.user;

    return User.findUserById(uid).then(function(user){
        return User.getGroupList(user).then(function(groupIds){
            var result = {
                id : user.id,
                nickname : user.nickname,
                profileS3path: user.profilePath,
                group : groupIds
            };
            return result;
        });
    });
};

var getUserProfilePath = function(user, db){
    try {
        var User = db.user;
        var s3path = User.getProfileS3path(user.id);
    } catch(err){
        throw AppError.throwAppError(500, err.toString());
    }
    return s3path;
};

var setProfile = function(user, nickname, profilePath, accessToken, db){
    var User = db.user;

    return User.setProfile(user, nickname, profilePath).then(function(){
	user.nickname = nickname;
	user.profilePath = profilePath;
	return user;
    });
};

exports.getMyProfile = getMyProfile;
exports.getProfile = getProfile;
exports.getUserProfilePath = getUserProfilePath;
exports.setProfile = setProfile;
