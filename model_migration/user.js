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
    var User = connection.define(UserShceme.TABLE, UserShceme.SCHEME, UserShceme.OPTION);

    /*
     * uid로 유저 인스턴스를 얻는다.
     *
     * @param String {uid} 인스턴스를 얻고자 하는 유저의 primary key
     */
    User.findUserById = function(uid){
        return new Promise(function(resolve, reject){
            return User.findById(uid).then(function(user){
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


    /* 
     * 유저가 속해있는 그룹의 인스턴스를 얻는다.
     *
     * @param Object {user} 유저의 인스턴스
     * @param String {gid} 얻고자 하는 그룹의 primary key
     */
    User.getGroup = function(user, gid) {
        return new Promise(function(resolve, reject){
            user.getGroups({
                where: {
                    id: gid
                }
            }).then(function (groups) {
                if (groups.length === 0) {
		    throw AppError.throwAppError(404, "Not Exist group");
                }
                resolve(groups[0]);
            }).catch(function(err){
		if(err.isAppError){
		    reject(err);
		} else {
		    reject(AppError.throwAppError(500, err.toString()));
		}
            });
        });
    };

    User.getGroupWithSharedLock = function(user, gid, transaction){
        return new Promise(function(resolve, reject){
            user.getGroups({
                where : {
                    id : gid
                },
		lock : transaction.LOCK.SHARE
            }).then(function(groups){
                if(groups.length === 0){
		    throw AppError.throwAppError(404, "Not exist group");
                }
                resolve(groups[0]);
            }).catch(function(err){
		if(err.isAppError){
		    reject(err);
		} else {
		    reject(AppError.throwAppError(500, err.toString()));
		}
            });
        });
    };


    /*
     * 유저가 속해있는 그룹의 인스턴스를 얻는다.
     * 이 때 해당 그룹에 대하여 트랜잭션, Exclusive lock을 걸고 얻는다.
     *
     * @param Object {user} 유저의 인스턴스
     * @param String {gid} 얻고자 하는 그룹의 primary key
     * @param Sequelize.Transaction {transaction} 트랜잭션 인스턴스
     */
    User.getGroupWithTransaction = function(user, gid, transaction){
        return new Promise(function(resolve, reject){
            user.getGroups({
                where : {
                    id : gid
                },
                transaction: transaction,
		lock : transaction.LOCK.UPDATE
            }).then(function(groups){
                if(groups.length === 0){
		    throw AppError.throwAppError(404, "Not exist group");
                }
                resolve(groups[0]);
            }).catch(function(err){
		if(err.isAppError){
		    reject(err);
		} else {
		    reject(AppError.throwAppError(500, err.toString()));
		}
            });
        });
    };

    /*
     * 유저가 속해있는 모든 그룹의 아이디를 얻는다.
     *
     * @param Object {user} 유저의 인스턴스
     */

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
                profilePath : profilePath
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

