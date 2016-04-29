
/**
 * Created by impyeong-gang on 1/11/16.
 */
var GroupScheme = require('./scheme').GROUP;
var AppError = require('../lib/appError');
var config = require('../config/config');
var Promise = require('bluebird');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var HOST_URI = config.server.reverseProxy.addr + ":" + config.server.reverseProxy.port;
var BUCKET_INFO = config.S3.originalBucket;

module.exports = function(connection){
    var Group = connection.define(GroupScheme.TABLE, GroupScheme.SCHEME, GroupScheme.OPTION);

    /*
      * 그룹을 추가한다.
      * 
      * @param String {name} 생성할 그룹의 이름
      * @param Number {color} 생성할 그룹의 그룹 컬러
      * @param transaction {Sequelize.Transaction} 트랜잭션 인스턴스
      */
      
    Group.createGroup = function(name, color, transaction){
        return new Promise(function(resolve, reject){
            return Group.create({
                groupName : name,
                revision : 0,
                createdDate : Date.now(),
                lastModDate : Date.now(),
                repository : BUCKET_INFO,
                color : color
            }, {transaction: transaction}).then(function(group){
                resolve(group);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
                reject(AppError.throwAppError(500, err.toString()));
            });
        })
    };

    /* 
     * 그룹과 연결되는 새로운 리비전의 델타를 생성한다.
     * 저장하고자 하는 델타 정보는 JSON 포맷의 String으로 변경하여 저장한다.
     *
     * @param Object {group} 델타를 만들고핮 하는 그룹
     * @param Number {revision} 생성될 델타의 리비전
     * @param Object {data} 새로운 델타가 보관하고자 하는 델타 정보 
     */

    Group.createDeltaWithTransaction = function(group, revision, data, transaction){
        return new Promise(function(resolve, reject){
            var formattedData = JSON.stringify(data);
            return group.createDelta({
                revision : revision,
                data : formattedData
            }, {transaction : transaction}).then(function(delta){
                resolve(delta);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        })
    };

    /* 
     * 커밋하고자 하는 델타를 받아 이를 가지고 DB에 적용한다.
     *
     * @param Object {group} 커밋하고자 하는 그룹
     * @param Number {revision} 커밋하고자 하는 리비전(Target revision)
     * @param Object {commitNodeInfo} 커밋하고자 하는 델타 정보
     * @param Number {countAlbum} 해당 커밋에서 앨범의 증감분
     * @param Number {countPhoto} 해당 커밋에서 사진의 증감분
     * @param Number {usageStorage} 해당 커밋에서 사용하는 용량의 증감분
     */
    Group.commitApply2 = function(group, revision, commitNodeInfo, countAlbum, countPhoto, usageStorage, transaction){
        return new Promise(function(resolve, reject){
            Group.createDeltaWithTransaction(group, revision, commitNodeInfo, transaction).then(function(delta){
                return group.update({
		    countPhoto: group.countPhoto += countPhoto,
		    countAlbum: group.countAlbum += countAlbum,
		    usageStorage: group.usageStorage += usageStorage,
                    revision: revision
                }, {transaction : transaction}).then(function(){
                    resolve();
                });
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
		reject(AppError.throwAppError(500, err.toString()));
            });
        });
    };

    /* 
     * gid로 그룹의 instance를 가져온다.
     *
     * @param String {gid} 그룹의 unique한 primary key
     */
    Group.findGroupById = function(gid){
        return new Promise(function(resolve, reject){
            return Group.findById(gid).then(function(group){
                if(!group){
                    throw AppError.throwAppError(404, "Not exist group");
                }
                resolve(group);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
                reject(AppError.throwAppError(500, err.toString()));
            });

        })
    };

    /*
     * 그룹의 이름을 변경한다.
     *
     * @param Object {group} 변경하고자 하는 그룹의 인스턴스
     * @param String {newName} 변경하고자 하는 이름
     */

    Group.updateGroupName = function(group, newName){
        return new Promise(function(resolve, reject){
            return group.update({
                groupName : newName
            }).then(function(){
		group.groupName = newName
                resolve(group);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
                reject(AppError.throwAppError(500, err.toString()));
            });
        });
    };

    /* 
     * 그룹의 맴버 리스르를 얻는다.
     * 
     * @param String {gid} 맴버를 얻고자 하는 그룹의 primary key
     */
    Group.getMemberList = function(gid){
        return new Promise(function(resolve, reject){
            return Group.findGroupById(gid).then(function(group){
                return group.getUsers().then(function(users){
                    resolve(users);
                });
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
                reject(AppError.throwAppError(500, err.toString()));
            });
	});
    };

    /*
     * 그룹에 대한 초대링크를 얻는다.
     *
     * @param String {uid} 초대링크를 얻은 유저의 primary key
     * @param String {gid} 초대링크를 발급하고자 하는 그룹의 primary key
     */
    Group.getInviteUrl = function(uid, gid) {
        var baseUrl = HOST_URI;
        baseUrl += "/api/invite";
        baseUrl += "/".concat(gid);
        baseUrl += "?".concat("from").concat("=").concat(uid);

        return baseUrl;
    };

    /*
     * 그룹 맴버들의 프로필을 얻는다.
     *
     * @param Object {group} 맴버들의 프로필을 얻고자 하는 그룹의 인스턴스
     */
    
    Group.getMemberProfile = function(group){
        return new Promise(function(resolve, reject){
            //권한 체크 안함
            group.getUsers().then(function(users){
                var result = {
                    count : 0,
                    userInfo : []
                };
                users.forEach(function(user){
                    result.count++;
                    result.userInfo.push({
                        uid : user.id,
                        nickname : user.nickname,
                        pic_s3path : user.profilePath
                    });
                });
                resolve(result);
            }).catch(function(err){
		if(err.isAppError){
		    return reject(err);
		}
                reject(AppError.throwAppError(500, err.toString()));
            });
        });
    };

    /* 
     * forward와 backward로 구분되어있는 reivison의 Array를 받아 
     * revision에 맞는 델타의 배열을 리턴한다.
     * 
     * traversalInfo = { backward : Array<Number>, forward : Array<Number>}
     * return { backward : Array<Object>, forward : Array<Object>}
     *
     * @param Object {group} 델타를 얻고자 하는 그룹의 인스턴스
     * @param Object {traversalInfo} backward와 forward의 리비전이 담긴 어레이를 포함하는 오브젝트
     */
    Group.getDeltaSet = function(group, traversalInfo){
        return new Promise(function(resolve, reject){
            if (traversalInfo.backward.length > 0 && traversalInfo.forward.length > 0) {
                return group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.backward
                        }
                    }
                }).then(function (backwards) {
                    if (backwards.length !== traversalInfo.backward.length) {
			throw AppError.throwAppError(500, "Actual delta info is not equal with expected as a computed info");
                    }

                    //Delta serialize (JSON -> Array)
                    backwards.forEach(function (bDelta) {
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    return group.getDeltas({
                        where: {
                            revision: {
                                $in: traversalInfo.forward
                            }
                        }
                    }).then(function (forwards) {
                        if (forwards.length !== traversalInfo.forward.length) {
			    throw AppError.throwAppError(500, "Actual delta info is not equal with expected as a computed info");
                        }

                        //Delta serialize (JSON -> Array)
                        forwards.forEach(function (fDelta) {
                            fDelta.data = JSON.parse(fDelta.data);
                        });

                        resolve({
                            backward: backwards,
                            forward: forwards
                        });
                    });
                }).catch(function (err) {
		    if(err.isAppError){
			return reject(err);
		    }
		    reject(AppError.throwAppError(500, err.toString()));
                });
		
            } else if (traversalInfo.backward.length > 0 && !(traversalInfo.forward.length > 0)) {
                return group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.backward
                        }
                    }
                }).then(function (backwards) {
                    if (backwards.length !== traversalInfo.backward.length) {
			throw AppError.throwAppError(500, "Actual delta info is not equal with expected as a computed info");
                    }

                    backwards.forEach(function (bDelta) {
                        bDelta.data = JSON.parse(bDelta.data);
                    });

                    resolve({
                        backward: backwards,
                        forward: []
                    });

                }).catch(function (err) {
		    if(err.isAppError){
			return reject(err);
		    }
		    reject(AppError.throwAppError(500, err.toString()));
                });
            } else {
                return group.getDeltas({
                    where: {
                        revision: {
                            $in: traversalInfo.forward
                        }
                    }
                }).then(function (forwards) {
                    if (forwards.length !== traversalInfo.forward.length) {
			throw AppError.throwAppError(500, "Actual delta info is not equal with expected as a computed info");
                    }

                    forwards.forEach(function (fDelta) {
                        fDelta.data = JSON.parse(fDelta.data);
                    });

                    resolve({
                        backward: [],
                        forward: forwards
                    });
                }).catch(function (err) {
		    if(err.isAppError){
			return reject(err);
		    }
		    reject(AppError.throwAppError(500, err.toString()));
                });
            }
        });
    };

    return Group;
};

