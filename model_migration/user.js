/**
 * Created by impyeong-gang on 1/11/16.
 */
var Promise = require('bluebird');
var UserShceme = require('./scheme').USER;
var config = require('../config/config');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var BUCKET_INFO = config.S3.originalBucket;

module.exports = function(connection){
    var User = connection.define(UserShceme.TABLE,
        UserShceme.SCHEME, {
            instanceMethods: {
                getProfile : function(){
                    return {
                        uid : user.id,
                        nickname : user.nickname,
                        pic_s3path : user.profile_path
                    }
                }
            }
        });

    User.findUserById = function(uid){
        return new Promise(function(resolve, reject){
            return User.findOne({
                where : {
                    id : uid
                }
            }).then(function(user){
                if(!user){
		    throw AppError.throwAppError(404, "Not exist user");
                }
                resolve(user);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        })
    };


    User.getGroup = function(user, gid) {
        return new Promise(function(resolve, reject){
            user.getGroups({
                where: {
                    id: gid
                }
            }).then(function (groups) {
                if (groups.length === 0) {
                    return reject(AppError.throwAppError(404));
                }
                resolve(groups[0]);
            }).catch(function(err){
                reject(err);
            })
        })
    };


    User.getGroupWithUpdateLock = function(user, gid, transaction){
        return new Promise(function(resolve, reject){
            return user.getGroups({
                where : {
                    id : gid
                },
                transaction: transaction,
                lock : transaction.LOCK.UPDATE
            }).then(function(groups){
                if(groups.length === 0){
                    return reject(AppError.throwAppError(404));
                }
                resolve(groups[0]);
            }).catch(function(err){
                log.error("User#getGroupWithUpdateLock/DB(RDBMS) Internal error", {err :err});
                reject(AppError.throwAppError(500));
            });
        })
    };


    User.getGroupList = function(user){
        return new Promise(function(resolve, reject){
            user.getGroups().then(function(groups){
                var groupIds = [];

                groups.forEach(function(group){
                    groupIds.push(group.id);
                });

                resolve(groupIds);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        });
    };

    User.getAuthInfo = function(user){
        return new Promise(function(resolve, reject){
            user.getAuth().then(function(auth){
                if(!auth){
                    throw AppError.throwAppError(404, "not exist auth info");
                }
                resolve(auth);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        });
    }

    User.setProfile = function(user, nickname, profilePath){
        return new Promise(function(resolve, reject){
            return user.update({
                nickname : nickname,
                profile_path : profilePath
            }).then(function(){
                resolve();
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        });
    };

    User.getProfileS3path = function(uid){
        return BUCKET_INFO + "/" + uid + "/" + Date.now() + ".jpg";
    };

        
    User.commitApply = function(user, addedPhoto, deletedPhoto, countAddedFileSize, transaction){
	return new Promise(function(resolve, reject){
	    return user.update({
		countAddPhoto : user.countAddPhoto + addedPhoto,
		countDeletedPhoto : user.countDeletedPhoto + deletedPhoto,
		usageStorage : user.usageStorage + countAddedFileSize
	    }, {transaction : transaction}).then(function(){
		resolve();
	    });
	}).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    };



    return User;
};

