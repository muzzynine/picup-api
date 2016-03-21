/**
 * Created by impyeong-gang on 12/17/15.
 */
var Promise = require('bluebird');
var AppError = require('./../lib/appError');
var Sync = require('../lib/sync');
var awsS3 = require('../lib/awsS3');
var _ = require('lodash');
var Node = require('../model_migration/node');
var amqpExchange = require('./../amqp/exchange');
var bunyan = require('bunyan');
var log = bunyan.getLogger('BusinessLogicLogger');

/**
 * 그룹을 생성하는 비즈니스 로직을 담당한다.
 * 그룹 생성은 델타 생성 - 그룹 생성 - 유저 그룹정보 추가의 세 단위 작업으로 이루어진다.
 * 트랜잭션 관리는 선택이다.
 *
 * @param user 유저 객체
 * @param group_name 생성할 그룹 이름
 * @param group_color 생성할 그룹의 컬러
 * @param fn
 * @returns {*}
 */
var createGroup = function(user, group_name, group_color, db){
    return new Promise(function(resolve, reject){
        var Group = db.group;
        var Connection = db.connection;

        Connection.transaction(function(t){
            return Group.createGroup(group_name, group_color, t).then(function(group){
                return user.addGroup(group, {transaction : t}).then(function(){
                    return group;
                })
            })
        }).then(function(group){
            resolve(group);
        }).catch(function(err){
            log.error("GroupController#createGroup/DB(RDBMS) transaction failed", {err :err});
            reject(err);
        });
    });
};


/**
 * 그룹에 대한 정보를 얻는다.
 * 유저가 그룹에 대한 권한이 없으면 요청은 실패한다.
 * @param gid 그룹의 아이디
 * @param uid 유저의 아이디
 *
 * @param fn
 */
var getGroup = function(user, gid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroup(user, gid).then(function(group){
            resolve(group);
        }).catch(function(err){
            reject(err);
        })
    })
};

/**
 * 그룹의 맴버들에 대한 정보를 얻는다.
 * 유저가 그룹에 대한 권한이 없으면 요청은 실패한다.
 * @param gid 그룹의 아이디
 * @param uid 유저의 아이디
 * @param fn
 */
var getGroupMember = function(user, gid, db, fn){
    return new Promise(function(resolve, reject){
	
	var User = db.user;
	var Group = db.group;

	User.getGroup(user, gid).then(function(group){
            return Group.getMemberProfile(group).then(function(profiles){
		resolve(profiles)
            })
	}).catch(function(err){
            log.error("GroupController#getGroupMember", {err :err});
	    reject(err)
	});
    })
};

/**
 * 그룹의 이름을 업데이트 한다.
 * 유저가 그룹에 대한 권한이 없으면 요청은 실패한다
 * @param gid 그룹의 아이디
 * @param group_name 그룹의 이름
 * @param uid 유저의 아이디
 * @param fn
 */
var updateGroupName = function(user, gid, newName, db){
    return new Promise(function(resolve, reject){
        var User = db.user;
        var Group = db.group;

        User.getGroup(user, gid).then(function(group){
            return Group.updateGroupName(group, newName).then(function(chgrp){
                resolve(chgrp);
            })
        }).catch(function(err){
            log.error("GroupController#updateGroupName", {err :err});
            reject(err);
        });
    })
};

/**
 * 그룹에 멤버를 포함한다.
 * @param gid
 * @param uid
 * @param Group
 * @param User
 * @param fn
 */
var addGroupMember = function(user, gid, db){
    return new Promise(function(resolve, reject){
        var Group = db.group;

        //중복검사 안해서 여러번 들어가는지 테스트해야함
        Group.findGroupById(gid).then(function(group){
            return user.addGroup(group).then(function(){
                resolve({
                    uid : user.id,
                    gid : group.id
                });
            }).catch(function(err){
                throw AppError.throwAppError(500);
            })
        }).catch(function(err){
            reject(err);
        })
    })
};

var deleteGroupMember = function(user, gid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroup(user, gid).then(function(group){
            return user.removeGroup(group).then(function(){
                resolve({
                    uid: user.id,
                    gid: group.id
                });
            }).catch(function(err){
                log.error("GroupController#deleteGroupMember/DB(RDBMS) Internal error", {err:err});
                throw AppError.throwAppError(500);
            })
        }).catch(function(err){
            log.error("GroupController#deleteGroupMember", {err:err});
            reject(err);
        });
    })
};

var commit = function(user, gid, revision, deltaArray, db, fn){
    return new Promise(function(resolve, reject){
        /*
         * deltaArray로부터 Node의 연산을 위한 NodeInfo를 만듬
         * s3 storage에 있는지 확인함.
         * add, replace의 노드들을 확인해야함
         */
        var nodeInfo = Node.generateNodeInfo(deltaArray, user.id, gid, revision);
        awsS3.checkExistObjects(nodeInfo, function(err, needBlocks){
            if(err){
                log.error("GroupController#commit/Remote AWS S3 Request failed", {err:err});
                return reject(err);
            }
            /* originConfirmList는 원본 파일이 s3에 존재하는 노드 리스트이다.
             * 썸네일 또한 S3에 존재하는 것을 보장하기 위하여, originConfirmList의 썸네일들이 s3에 존재하는지 확인한다. */
            var originConfirmList = _.difference(nodeInfo, needBlocks);

            /* 원본이 존재하는 노드들에 대해, 썸네일 또한 s3에 존재하는지 확인한다. */

            awsS3.checkThumbExistObjects(originConfirmList, function(err, notExist){
                if(err){
                    log.error("GroupController#commit/Remote AWS S3 Request failed", {err:err});
                    return reject(err);
                }


                /*
                 * 커밋 대상은, S3에 원본과 썸네일까지 존재하는 노드들이다.
                 * 모두 존재하는 노드들에 대해서는 커밋을 진행하고,
                 * 원본과 썸네일이 존재하지 않는 노드에 대해서는 needBlocks에 리턴하고,
                 * 원본은 존재하나 아직 썸네일이 존재하지 않는 노드에 대해서는, 썸네일이 만들어지는 과정이라 가정하고 따로 알리지 않는다.
                 * 이런 처리가 가능한 이유는 예상하지 못한 오류로 썸네일이 만들어지지 못하더라도, 커밋을 방지할 수 있으며
                 * 클라이언트 입장에서는 커밋 처리가 안되는 노드이기 때문에, 능동적으로 판단하여 클라이언트 레벨에서 처리할 수 있도록 한다.
                 */
                var commitList = _.difference(originConfirmList, notExist);

                commitInternal(user, gid, revision, commitList, db, function(err, commitResult){
                    if(err){
                        return reject(err);
                    }
                    return fn(null, needBlocks, commitResult);
                });
            });
        });
    });
};

var commit2 = function(user, gid, revision, deltaArray, db){
    return new Promise(function(resolve, reject){
        /*
         * deltaArray로부터 Node의 연산을 위한 NodeInfo를 만듬
         * s3 storage에 있는지 확인함.
         * add, replace의 노드들을 확인해야함
         */
        var nodeInfo = Node.generateNodeInfo(deltaArray, user.id, gid, revision);

        awsS3.checkExistNodeObjectsBatch(nodeInfo).then(function(needBlocks){
            /* originConfirmList는 원본 파일이 s3에 존재하는 노드 리스트이다.
             * 썸네일 또한 S3에 존재하는 것을 보장하기 위하여, originConfirmList의 썸네일들이 s3에 존재하는지 확인한다. */
            var originConfirmList = _.difference(nodeInfo, needBlocks);

            /* 원본이 존재하는 노드들에 대해, 썸네일 또한 s3에 존재하는지 확인한다. */

            return awsS3.checkExistThumbObjectsBatch(originConfirmList).then(function(notExist){

                /*
                 * 커밋 대상은, S3에 원본과 썸네일까지 존재하는 노드들이다.
                 * 모두 존재하는 노드들에 대해서는 커밋을 진행하고,
                 * 원본과 썸네일이 존재하지 않는 노드에 대해서는 needBlocks에 리턴하고,
                 * 원본은 존재하나 아직 썸네일이 존재하지 않는 노드에 대해서는, 썸네일이 만들어지는 과정이라 가정하고 따로 알리지 않는다.
                 * 이런 처리가 가능한 이유는 예상하지 못한 오류로 썸네일이 만들어지지 못하더라도, 커밋을 방지할 수 있으며
                 * 클라이언트 입장에서는 커밋 처리가 안되는 노드이기 때문에, 능동적으로 판단하여 클라이언트 레벨에서 처리할 수 있도록 한다.
                 */
                var commitList = _.difference(originConfirmList, notExist);

                return commitInternal2(user, gid, revision, commitList, db).then(function(commitResult){
                    resolve([needBlocks, commitResult]);
                });
            });
        }).catch(function(err){
	    log.error("GroupController#commit", {err : err});
	    reject(err);
	});
    });
};


var commitInternal2 = function(user, gid, revision, nodeInfo, db) {
    return new Promise(function(resolve, reject){
        var User = db.user;
        var Group = db.group;
        var newRevision = revision + 1;

        if (nodeInfo.length === 0) {
            return resolve({
                uid: user.id,
                group: gid,
                revision: revision,
                delta: []
            });
        }

        for (var i in nodeInfo) {
            nodeInfo[i].incrementRevision();
        }

        User.getGroup(user, gid).then(function (group) {
            if (newRevision % 2 !== 1) {
                return longCommit(group, newRevision, nodeInfo, db).then(function (toCommitNodeInfo) {
	 	    return commitApply(user, group, newRevision, toCommitNodeInfo, db).then(function (committedInfo) {
			return committedInfo;
		    });
                });
            } else {
                return shortCommit(group, newRevision, nodeInfo, db).then(function (toCommitNodeInfo) {
		     return commitApply(user, group, newRevision, toCommitNodeInfo, db).then(function (committedInfo) {
			return committedInfo;
		    });
                });
            }
	}).then(function(committedInfo){
            return Group.getMemberList(gid).then(function (users) {
		var uids = [];
                users.forEach(function (user) {
		    uids.push(user.id);
		});

		return amqpExchange.sendCommitMessage(uids, gid).then(function (err) {
		    return resolve({
			uid: user.id,
			group: committedInfo.group.id,
                        revision: committedInfo.revision,
                        delta: nodeInfo
                    });
		});
	    });
        }).catch(function (err) {
            reject(err);
        });
    })
};



var longCommit = function(group, revision, commitChunk, db){
    return new Promise(function(resolve, reject){
        var Group = db.group;
        var traversalDeltaNumber = Sync.computeTraversal(revision);

        Group.getDeltaSet(group, traversalDeltaNumber).then(function(deltaSet){
	    return Node.saveNodeBatch(commitChunk).then(function(savedNodeList){
		var nodeDeltaKeys = [];

		_.forEach(deltaSet.forward, function(delta){
		    _.forEach(delta.data, function(node){
			nodeDeltaKeys.push({
			    nid : node.nid,
			    revision : node.revision
			});
		    });
		});

		return Node.getAliveNodes3(nodeDeltaKeys, savedNodeList).then(function(deltaData){
		    resolve(deltaData);
		});
	    });	    
        }).catch(function(err){
            reject(err);
        })
    })
};

var shortCommit = function(group, revision, commitChunk){
    return new Promise(function(resolve, reject){
        Node.saveNodeBatch(commitChunk).then(function(savedNodeList){
   	    var savedNodeIds = [];
		    
	    _.forEach(savedNodeList, function(saved){
		savedNodeIds.push({nid : saved.nid, revision : saved.revision})
	    })

            resolve(savedNodeIds);
        }).catch(function(err){
            reject(err);
        })
    })
};

var commitApply = function(user, group, revision, commitInfo, db){
    return new Promise(function(resolve, reject){
        var Connection = db.connection;
        var User = db.user;
        var Group = db.group;

        Connection.transaction(function(t){
            return User.getGroup(user, group.id).then(function(group){
                var oldRevision = revision-1;
                if(oldRevision !== group.revision){
                    throw AppError.throwAppError(400);
                }
                return Group.commitApply2(group, revision, commitInfo, t).then(function(){
                    return {
                        revision: revision,
                        group: group,
                        data: commitInfo
                    };
                })
            }).catch(function(err){
                throw err;
            })
        }).then(function(committed){
            resolve(committed);
        }).catch(function(err){
            reject(err);
        })
    })
};



var update = function(user, gid, startRev, endRev, db) {
    return new Promise(function(resolve, reject){
        var User = db.user;
        var Group = db.group;
        var Delta = db.delta;

	//Start revision에 0이 올 경우 !startRev에 포함되므로, null임을 체크한다.
        if (startRev === null || !endRev) {
            return reject(AppError.throwAppError(400));
        }

        if (startRev > endRev) {
            return reject(AppError.throwAppError(400));
        }

        // 그룹 확인보다 같은 경우의 fast return이 먼저 있다. 인지하고 있어야 한다.
        if (startRev === endRev) {
            return fn({
                gid: gid,
                revision: startRev,
                delta: []
            });
        }

        User.getGroup(user, gid).then(function(group){
            if (endRev > group.revision) {
                return reject(AppError.throwAppError(400));
            }
            var src = parseInt(startRev);
            var dst = parseInt(endRev);

            /* src와 dst로 탐색해야 하는 리비전 넘버셋을 구한다 */
            try {
                var traversalInfo = Sync.getDeltaList(src, dst);
            } catch (err) {
                log.error("GroupController#update/getDeltaList compute error", {err: err});
                return reject(AppError.throwAppError(500));
            }
            return Group.getDeltaSet(group, traversalInfo).then(function(deltaSet){
                return Node.getChangeSetBatch2(group.id, deltaSet.backward).then(function(changeSetBackward){
                    return Node.getChangeSetBatch2(group.id, deltaSet.forward).then(function(changeSetForward){
                        try {
                            var result = Sync.generateDifferenceUpdateData(changeSetBackward, changeSetForward);
                        } catch(err){
                            throw AppError.throwAppError(500);
                        }
                        resolve({
                            gid: group.id,
                            revision: group.revision,
                            delta: result
                        });
                    })
                })
            })
        }).catch(function(err){
            reject(err);
        })
    })
};

var getInviteUrl = function(user, gid, db){
    return new Promise(function(resolve, reject){
        try {
            var Group = db.group;
            var inviteUrl = Group.getInviteUrl(user.id, gid);
        } catch(err){
            return reject(AppError.throwAppError(500));
        }
        resolve(inviteUrl);
    });
};

exports.createGroup = createGroup;
exports.getGroup = getGroup;
exports.getGroupMember = getGroupMember;
exports.updateGroupName = updateGroupName;
exports.addGroupMember = addGroupMember;
exports.deleteGroupMember = deleteGroupMember;
exports.getInviteUrl = getInviteUrl;
exports.commit = commit;
exports.update = update;
exports.commitInternal2 = commitInternal2
exports.commit2 = commit2;
