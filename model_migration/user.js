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
        return User.findOne({
	    where : {
		id : uid,
		isAlive : true
	    }
	}).then(function(user){
            if(!user){
		throw AppError.throwAppError(404, "Not exist user");
            }
            return user;
        });
    };


    /* 
     * 유저가 속해있는 그룹의 인스턴스를 얻는다.
     *
     * @param Object {user} 유저의 인스턴스
     * @param String {gid} 얻고자 하는 그룹의 primary key
     */
    User.getGroup = function(user, gid) {
        return user.getGroups({
            where: {
                id: gid,
		isAlive: true
            }
        }).then(function (groups) {
            if (groups.length === 0) {
		throw AppError.throwAppError(404, "Not Exist group");
            }
            return groups[0];
        });
    };

    User.getGroupWithSharedLock = function(user, gid, transaction){
        return user.getGroups({
            where : {
                id : gid,
		isAlive: true
            },
	    lock : transaction.LOCK.SHARE
        }).then(function(groups){
            if(groups.length === 0){
		throw AppError.throwAppError(404, "Not exist group");
            }
            return groups[0];
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
        return user.getGroups({
            where : {
                id : gid,
		isAlive : true
            },
            transaction: transaction,
	    lock : transaction.LOCK.UPDATE
        }).then(function(groups){
            if(groups.length === 0){
		throw AppError.throwAppError(404, "Not exist group");
            }
            return groups[0];
        });
    };

    /*
     * 유저가 속해있는 모든 그룹의 아이디를 얻는다.
     *
     * @param Object {user} 유저의 인스턴스
     */

    User.getGroupList = function(user){
        return user.getGroups({
	    where : {
		isAlive : true
	    }
	}).then(function(groups){
            var groupIds = [];

            groups.forEach(function(group){
                groupIds.push(group.id);
            });

            return groupIds;
        });
    };

    User.getAuthInfo = function(user){
        return user.getAuth({
	    where : {
		isAlive : true
	    }
	}).then(function(auth){
            if(!auth){
                throw AppError.throwAppError(404, "not exist auth info");
            }
            return auth;
        });
    };

    User.setProfile = function(user, nickname, profilePath){
        return user.update({
            nickname : nickname,
            profilePath : profilePath,
	    updatedAt : Date.now()
        }).then(function(){
            return;
        });
    };

    User.getProfileS3path = function(uid){
        return BUCKET_INFO + "/" + uid + "/" + Date.now() + ".jpg";
    };

        
    User.commitApply = function(user, transaction){
	user.updatedAt = Date.now();
	
	return user.update({
	    countAddPhoto : user.countAddPhoto,
	    countDeletedPhoto : user.countDeletedPhoto,
	    usageStorage : user.usageStorage,
	    updatedAt : user.updatedAt
	}, {transaction : transaction}).then(function(){
	    return;
	});
    };

    User.latestTimestampUpdate = function(user){
	return user.update({
	    latestReqDate : Date.now()
	}, {benchmark : true}).then(function(){
	    return;
	});
    };

    return User;
};
