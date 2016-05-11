
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
        return Group.create({
            groupName : name,
            revision : 0,
            createdDate : Date.now(),
            lastModDate : Date.now(),
            repository : BUCKET_INFO,
            color : color
        }, {transaction: transaction, benchmark : true}).then(function(group){
            return group;
        });
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
        var formattedData = JSON.stringify(data);
        return group.createDelta({
            revision : revision,
            data : formattedData
        }, {transaction : transaction, benchmark : true}).then(function(delta){
            return delta;
        });
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
    Group.commitApply2 = function(group, commitNodeInfo, transaction){
	group.revision += 1;
	
        return Group.createDeltaWithTransaction(group, group.revision, commitNodeInfo, transaction).then(function(delta){
            return group.update({
		countPhoto: group.countPhoto,
		countAlbum: group.countAlbum,
		usageStorage: group.usageStorage,
                revision: group.revision,
		lastModDate : Date.now(),
		updatedAt : Date.now()
            }, {transaction : transaction, benchmark : true}).then(function(){
                return;
            });
        })
    };

    /* 
     * gid로 그룹의 instance를 가져온다.
     *
     * @param String {gid} 그룹의 unique한 primary key
     */
    Group.findGroupById = function(gid){
        return Group.findOne({
	    where : {
		id : gid,
		isAlive : true
	    }
	}).then(function(group){
            if(!group){
                throw AppError.throwAppError(404, "Not exist group");
            }
            return group;
        });
    };

    /*
     * 그룹의 이름을 변경한다.
     *
     * @param Object {group} 변경하고자 하는 그룹의 인스턴스
     * @param String {newName} 변경하고자 하는 이름
     */

    Group.updateGroupName = function(group, newName){
        return group.update({
            groupName : newName,
	    updatedAt : Date.now()
        }).then(function(){
	    group.groupName = newName
            return group;
        });
    };

    /* 
     * 그룹의 맴버 리스르를 얻는다.
     * 
     * @param String {gid} 맴버를 얻고자 하는 그룹의 primary key
     */
    Group.getMemberList = function(group){
        return group.getUsers({
	    where : {
		isAlive : true
	    }
	}).then(function(users){
            return users;
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
	return Group.getMemberList(group).then(function(users){
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
            return result;
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
        if (traversalInfo.backward.length > 0 && traversalInfo.forward.length > 0) {
            return group.getDeltas({
                where: {
		    isAlive : true,
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
		    isAlive : true,
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

                    return [backwards, forwards]
                });
            });
        } else if (traversalInfo.backward.length > 0 && !(traversalInfo.forward.length > 0)) {
            return group.getDeltas({
                where: {
		    isAlive : true,
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

                return [backwards, []];

            });
        } else {
            return group.getDeltas({
		isAlive : true,
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

                return [[], forwards];
            });
        }
    };

    return Group;
};

