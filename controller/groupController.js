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
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
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
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
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
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    })
};

/**
 * 그룹에 멤버를 포함한다.
 * @param gid
 * @param uid
 * @param Group
 * @param User
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
            })
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        })
    })
};

/**
* 그룹에서 멤버를 제외시킨다.
* @param user 
* @param gid
* @param db
*/

var deleteGroupMember = function(user, gid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroup(user, gid).then(function(group){
            return user.removeGroup(group).then(function(){
                resolve({
                    uid: user.id,
                    gid: group.id
                });
            });
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

var commit2 = function(user, gid, revision, deltaArray, db, amqp){
    return new Promise(function(resolve, reject){
        /*
         * deltaArray로부터 Node의 연산을 위한 NodeInfo를 만듬
         * s3 storage에 있는지 확인함.
         * add, replace의 노드들을 확인해야함
         */
	var Group = db.group;
        var nodeInfo = Node.generateNodeInfo(deltaArray, user.id, gid, revision);

        awsS3.checkExistNodeObjectsBatch(nodeInfo).then(function(originNeedBlocks){
            /* originConfirmList는 원본 파일이 s3에 존재하는 노드 리스트이다.
             * 썸네일 또한 S3에 존재하는 것을 보장하기 위하여, originConfirmList의 썸네일들이 s3에 존재하는지 확인한다. */
            var originConfirmList = _.difference(nodeInfo, originNeedBlocks);

            /* 원본이 존재하는 노드들에 대해, 썸네일 또한 s3에 존재하는지 확인한다. */

            return awsS3.checkExistThumbObjectsBatch(originConfirmList).then(function(thumbNeedBlocks){
                /*
                 * 커밋 대상은, S3에 원본과 썸네일까지 존재하는 노드들이다.
                 * 모두 존재하는 노드들에 대해서는 커밋을 진행하고,
                 * 원본과 썸네일이 존재하지 않는 노드에 대해서는 needBlocks에 리턴하고,
                 * 원본은 존재하나 아직 썸네일이 존재하지 않는 노드에 대해서는, 썸네일이 만들어지는 과정이라 가정하고 따로 알리지 않는다.
                 * 이런 처리가 가능한 이유는 예상하지 못한 오류로 썸네일이 만들어지지 못하더라도, 커밋을 방지할 수 있으며
                 * 클라이언트 입장에서는 커밋 처리가 안되는 노드이기 때문에, 능동적으로 판단하여 클라이언트 레벨에서 처리할 수 있도록 한다.
                 */
                var commitList = _.difference(originConfirmList, thumbNeedBlocks);
		var needBlocks = _.concat(originNeedBlocks, thumbNeedBlocks);
		/* 
		 * 커밋할 것이 없는 경우 needBlocks와 빈 델타와 함꼐 함수 리턴
		 */

		if(commitList.length === 0){
		    return resolve(
			[
			    needBlocks,
			    {
				uid : user.id,
				group : gid,
				revision : revision,
				delta : []
			    }
			]
		    );
		}
		
		return commitInternal2(user, gid, revision, commitList, db).then(function(commitResult){
		    return Group.getMemberList(gid).then(function (users) {
			var uids = [];
			users.forEach(function (user) {
			    uids.push(user.id);
			});

			return amqp.sendCommitMessage(uids, gid).then(function () {
			    resolve([needBlocks, commitResult]);
			});
		    });
                });
            });
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
};


var commitInternal2 = function(user, gid, oldRevision, nodeInfo, db) {
    return new Promise(function(resolve, reject){
	var Connection = db.connection;
        var User = db.user;
        var Group = db.group;
        var newRevision = oldRevision + 1;

	var countCommitAddPhoto = 0;
	var countCommitAddAlbum = 0;
	var countCommitDelPhoto = 0;
	var countCommitDelAlbum = 0;
	var countAddedTotalFileSize = 0;
	var countDeletedTotalFileSize = 0;

	nodeInfo.forEach(function(node){
	    if(node.presence === Sync.PRESENCE_ADD){
		if(node.kind === Sync.KIND_DIR){
		    countCommitAddAlbum++;
		} else if(node.kind === Sync.KIND_FILE){
		    countCommitAddPhoto++;
		    if(node.exif && node.exif.fileSize){
			countAddedTotalFileSize += node.exif.fileSize;
		    } 
		}
	    } else if(node.presence === Sync.PRESENCE_DELETE){
		if(node.kind === Sync.KIND_DIR){
		    countCommitDelAlbum++;
		} else if(node.kind === Sync.KIND_FILE){
		    countCommitDelPhoto++;
		    if(node.exif && node.exif.fileSize){
			countDeletedTotalFileSize += node.exif.fileSize;
		    } 
		}
	    }
	    node.incrementRevision();
	});

        User.getGroup(user, gid).then(function (group) {
            if (newRevision % 2 === 0) {
                return longCommit(group, newRevision, nodeInfo, db).then(function (toCommitNodeInfo) {
		    return [toCommitNodeInfo, group];
                });
            } else {
                return shortCommit(group, newRevision, nodeInfo, db).then(function (toCommitNodeInfo) {
		    return [toCommitNodeInfo, group];
                });
            }
	}).spread(function(toCommitNodeInfo, group){
            return Connection.transaction(function(t){
		return User.getGroup(user, group.id).then(function(verifiedGroup){
                    if(oldRevision !== group.revision){
			throw AppError.throwAppError(400, "In transaction, revision in request revision is not equal to groups latest revision");
                    }

		    var countAlbum = countCommitAddAlbum - countCommitDelAlbum;
		    var countPhoto = countCommitAddPhoto - countCommitDelPhoto;
		    var usageStorage = countAddedTotalFileSize - countDeletedTotalFileSize;

                    return Group.commitApply2(group, newRevision, toCommitNodeInfo, countAlbum, countPhoto, usageStorage, t).then(function(){
			return User.commitApply(user, countCommitAddPhoto, countCommitDelPhoto, countAddedTotalFileSize, t).then(function(){
			    return {
				revision: newRevision,
				group: verifiedGroup,
				data: toCommitNodeInfo
			    };
			});
                    });
		}).catch(function(err){
		    if(err.isAppError){
			throw err;
		    }
		    throw AppError.throwAppError(500, err.toString());
		});
	    }).then(function(committed){
		return resolve({
		    uid : user.id,
		    group : committed.group.id,
		    revision: committed.revision,
		    delta: nodeInfo
		});
	    });	
        }).catch(function (err) {
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));;
        });
    })
};

/*
 * Revision 값이 짝수인 경우 2이상의 Revision delta를 순회 한다.
 * 커밋 요청된 델타를 먼저 저장한 후 타겟 리비전의 스킵 델타를 구한다.
 * 구한 스킵 리비전 값과 이전 리비전 값 사이의 델타를 모두 구하고 이 델타와 커밋 요청된 델타를 합쳐
 * 새로운 델타 값을 생성한다.
 */

var longCommit = function(group, revision, commitChunk, db){
    return new Promise(function(resolve, reject){
        var Group = db.group;
	var traversalDeltaNumber;

	try {
            traversalDeltaNumber = Sync.computeTraversal(revision);
	} catch(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	}

	//traversalDeltaNumber에 해당하는 delta정보를 db로부터 가져온다.
        Group.getDeltaSet(group, traversalDeltaNumber).then(function(deltaSet){
	    //클라이언트로 받은 commit 대상 노드들을 모두 db에 저장한다.
	    return Node.saveNodeBatch(commitChunk).then(function(savedNodeList){
		var nodeDeltaKeys = [];

		//커밋의 경우 deltaSet은 스킵델타의 원리에 따라 항상 forward 값만을 가짐을 보장한.
		//따라서 forward를 순회하며 delta key array를 구성한다.
		_.forEach(deltaSet.forward, function(delta){
		    _.forEach(delta.data, function(node){
			nodeDeltaKeys.push({
			    nid : node.nid,
			    revision : node.revision
			});
		    });
		});

		//살아있는 노드를 구하고, 이에 대한 결과로 요청한 커밋 리비전에 대한 델타를 반환한다.
		return Node.getAliveNodes3(nodeDeltaKeys, savedNodeList).then(function(deltaData){
		    resolve(deltaData);
		});
	    });	    
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    } 
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
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
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
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
            return reject(AppError.throwAppError(400, "Start revision or end revision is null. is wrong argument"));
        }

	//Strat revision보다 end revision이 클 수 없다.
        if (startRev > endRev) {
            return reject(AppError.throwAppError(400, "End revision is greater than start revision. is wrong argument"));
        }

        // 그룹 확인보다 같은 경우의 fast return이 먼저 있다. 
        if (startRev === endRev) {
            return fn({
                gid: gid,
                revision: startRev,
                delta: []
            });
        }

        User.getGroup(user, gid).then(function(group){
	    //클라이언트가 요청한 end revision은 그룹의 리비전보다 클 수 없다.
            if (endRev > group.revision) {
                throw AppError.throwAppError(400, "end revision is greater than groups latest revision. is wrong argument");
            }
	    
            var src = parseInt(startRev);
            var dst = parseInt(endRev);

            /* src와 dst로 탐색해야 하는 리비전 넘버셋을 구한다 */
            try {
                var traversalInfo = Sync.getDeltaList(src, dst);
            } catch (err) {
                throw AppError.throwAppError(500, err.toString());
            }

	    //tarversalInfo에 해당하는 delta들의 정보를 얻는다.
            return Group.getDeltaSet(group, traversalInfo).then(function(deltaSet){
		//deltaSet의 backward들과 forward들의 nid, revision으로 실제 노드 정보를 얻는다.
                return Node.getChangeSetBatch2(group.id, deltaSet.backward).then(function(changeSetBackward){
                    return Node.getChangeSetBatch2(group.id, deltaSet.forward).then(function(changeSetForward){
                        try {
			    //diff를 통해 backward와 forward에서 중복되는 노드들을 제외시킨다.
                            var result = Sync.generateDifferenceUpdateData(changeSetBackward, changeSetForward);
                        } catch(err){
                            throw AppError.throwAppError(500, err.toString());
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
	    if(err.isAppError){
		reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

var getInviteUrl = function(user, gid, db){
    return new Promise(function(resolve, reject){
        try {
            var Group = db.group;
            var inviteUrl = Group.getInviteUrl(user.id, gid);
        } catch(err){
            return reject(AppError.throwAppError(500, err.toString()));
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
exports.update = update;
exports.commitInternal2 = commitInternal2
exports.commit2 = commit2;
