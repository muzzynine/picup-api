/**
 * Created by impyeong-gang on 12/17/15.
 */
var Promise = require('bluebird');
var Sequelize = require('sequelize');
var AppError = require('./../lib/appError');
var Sync = require('../lib/sync');
var awsS3 = require('../lib/awsS3');
var _ = require('lodash');
var Node = require('../model_migration/node');
var amqpExchange = require('./../amqp/exchange');
var bunyan = require('bunyan');
var log = bunyan.getLogger('BusinessLogicLogger');
var utils = require('../utils/utils');


if(process.env.NODE_ENV == 'development'){
    //Sequelize query log printed std out
    Promise.config({
	warnings : false
    });
} else if(process.env.NODE_ENV == 'production'){
    
}


/**
 * 그룹을 생성하는 비즈니스 로직을 담당한다.
 * 그룹 생성은 - 그룹 생성을 생성하고 생성한 그룹에 유저를 추가하는 작업으로 이루어진다.
 * 이 작업은 원자성을 보장해야 하므로 트랜잭션으로 진행한다.
 *
 * @param user 유저 객체
 * @param group_name 생성할 그룹 이름
 * @param group_color 생성할 그룹의 컬러
 *
 * @returns Promise
 */
var createGroup = function(user, groupName, groupColor, db){
    return new Promise(function(resolve, reject){
        var Group = db.group;
        var Connection = db.connection;
	
        Connection.transaction(function(t){
            return Group.createGroup(groupName, groupColor, t).then(function(group){
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
 * 유저가 그룹에 대한 권한이 없으면 예외를 발생시킨다.
 * @param gid 그룹의 아이디
 * @param uid 유저의 아이디
 *
 * @param Promise
 */
var getGroup = function(user, gid, db){
    return new Promise(function(resolve, reject){
        var User = db.user;

        User.getGroup(user, gid).then(function(group){
            resolve(group);
        }).catch(function(err){
	    //유저가 그룹의 맴버가 아닌 경우, 404 에러가 반환된다.
            reject(err);
        })
    })
};

/**
 * 그룹의 맴버들에 대한 정보를 얻는다.
 * 유저가 그룹에 대한 권한이 없으면 예외를 발생시킨다.
 * @param gid 그룹의 아이디
 * @param uid 유저의 아이디
 */
var getGroupMember = function(user, gid, db){
    return new Promise(function(resolve, reject){
	var User = db.user;
	var Group = db.group;

	User.getGroup(user, gid).then(function(group){
            return Group.getMemberProfile(group).then(function(profiles){
		resolve(profiles)
            });
	}).catch(function(err){
	    //유저가 그룹의 맴버가 아닌 경우, 404 에러가 반환된다.
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
    });
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

        Group.findGroupById(gid).then(function(group){
	    //Sequelize에서 n:m Instance에 대한 addAssocation시 존재하는 경우 update, 존재하지 않는 경우 insert로 내부적으로 진행된다.
	    //따라서 추가시 이미 추가되어있는지 중복하여 검사할 필요는 없다.
	    return user.addGroup(group).then(function(){
                resolve({
		    uid : user.id,
		    gid : group.id
                });
	    });
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
* 유저가 그룹의 맴버가 아닐 경우 예외가 발생한다.
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
	    //유저가 그룹의 맴버가 아닐 경우 예외 발생
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

/**
* 새로운 델타를 커밋한다.
* 커밋은 크게 3단계로 구분된다.
* 1. 커밋하고자 하는 델타의 노드들이 리모트 저장소에 올라와있는지 확인
* 2. 커밋하고자 하는 델타의 노드들의 메타데이터를 데이터베이스에 저장
* 3. 커밋하고자 하는 델타의 메타데이터를 생성하여 데이터베이스에 저장하고, 그룹 정보 최신화.
*
* 위의 3단계를 문제없이 완료하여야 커밋이 이루어진다.
*/
var commit2 = function(user, gid, revision, deltaArray, db, amqp){
    return new Promise(function(resolve, reject){
        /*
         * deltaArray로부터 Node의 연산을 위한 NodeInfo를 만듬
         * s3 storage에 있는지 확인함.
         * add, replace의 노드들을 확인해야함
         */
	var User = db.user;
	var Group = db.group;
        var nodeInfo = Node.generateNodeInfo(deltaArray, user.id, gid, revision);

	User.getGroup(user, gid).then(function(group){
 	    if(revision === null || revision !== group.revision){
		throw AppError.throwAppError(400, "revision in request revision is not equal to groups latest revision");
	    }
	    
            return awsS3.checkExistNodeObjectsBatch(nodeInfo).then(function(originNeedBlocks){
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
				    group : group.id,
				    revision : revision,
				    delta : []
				}
			    ]
			);
		    }
		    
		    return commitInternal2(user, group, revision, commitList, db).then(function(commitResult){
			//커밋 완료 후 그룹 맴버들에 대한 Notification 진행
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
 * commitInternal
 * S3에 존재하는 커밋 대상 노드들을 인자로 받아 해당 노드들에 대한 커밋을 진행하고 반영한다.
 *
 * 아키텍처 구성상, NOSQL에는 노드정보를, RDBMS에는 그룹, 델타정보를 보관하며 다루기 때문에
 * DB레벨에서의 트랜잭션은 불가능하다.
 * 따라서 RDBMS의 최종 커밋 반영에만 트랜잭션을 사용하고, 실패허용적으로 커밋 루틴을 구성하여야 한다.
 * 
 * 실패허용을 만족하기 위해 다음과 같은 방법을 쓴다.
 *  - Presence ADD의 노드를 추가할 때, 노드의 특정 값에 영향을 받지 않는 UUID Node Id를 생성한다.
 *     Presence ADD의 노드 추가때 마다 Nid가 노드의 특정값에 영향을 받지 않는다면, 같은 노드더라도
 *     매번 다른 Nid를 생성하게 된다. 따라서 실패하더라도 현재까지의 정보에 아무런 영향을 주지 않으며,
 *     다음 재시도 시에 새로운 Nid가 할당된 값을 저장할 것이다.
 *  - Presence Replace, Delete의 경우, Node Delta의 추가에 대해 Upsert로 진행한다.
 *     Presence Replace와 Delete에 대해 Node Delta추가를 Upsert로 진행한다면,
 *     실패하더라도 한 리비전에 대한 Node Delta는 단 하나이고, 이 값은 커밋 시도한 요청중 최신의 값일 것이다.
 *     한 리비전에 대해 커밋이 성공한다면 항상 그 값은 최신임이 보장된다. (성공한다면 다음 커밋 시도 리비전은 다음 리비전일 것이기 때문이다.)       
 *  - 해당 델타구간의 노드를 포함하는 Delta의 Data필드는, {nid, revision}으로 구성한다.
 *     커밋에 성공하면 nid와 revision을 delta의 data필드에 저장하게 되므로, 특정 nid, revision으로 노드를 조회하게 된다.
 *     따라서 커밋에 성공한 노드들에만 접근하게 된다.
 */
var commitInternal2 = function(user, targetGroup, oldRevision, nodeInfo, db) {
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

	//커밋시 앨범, 사진, 용량의 증감 여부를 카운트한다.
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

	//짝수리비전, 홀수리비전의 커밋은 약간 다르게 이루어진다.
	//SkipDelta방식으로 커밋을 진행할 때 짝수리비전 커밋에서는 이전 델타 정보들과 현재 커밋하고자 하는 델타의 연산이 필요하나
	//홀수리비전 커밋에서는 필요하지 않다. 따라서 구분하여 처리한다.
        return Group.findGroupById(targetGroup.id).then(function (group) {
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
	    //델타를 만들기 위한 연산이 끝난후 이 델타를 데이터베이스에 적용할 떄 트랜잭션을 적용한다.
	    //SELECT ... FOR UPDATE는 autocommit = 0 이어야만 레코드에 Exclusive Lock이 걸린다.
            return Connection.transaction({
		autocommit: true
	    }).then(function(t){
		//내부에서 그룹의 리비전을 다시한번 확인한다.
		//트랜잭션이 시작되기 전 델타 연산을 하는 사이 해당 그룹에 대하여 리비전이 변경될 가능성이 있기 떄문이다.
		return User.getGroupWithTransaction(user, group.id, t).then(function(verifiedGroup){
                    if(oldRevision !== group.revision){
			throw AppError.throwAppError(400, "In transaction, revision in request revision is not equal to groups latest revision");
                    }

		    var countAlbum = countCommitAddAlbum - countCommitDelAlbum;
		    var countPhoto = countCommitAddPhoto - countCommitDelPhoto;
		    var usageStorage = countAddedTotalFileSize - countDeletedTotalFileSize;


                    return Group.commitApply2(group, newRevision, toCommitNodeInfo, countAlbum, countPhoto, usageStorage, t).then(function(){
			return User.commitApply(user, countCommitAddPhoto, countCommitDelPhoto, countAddedTotalFileSize, t).then(function(){
			    return t.commit().then(function(){
				return {
				    revision: newRevision,
				    group: verifiedGroup,
				    data: toCommitNodeInfo
				};
			    });
			});
                    });
		}).catch(function(err){
		    return t.rollback().then(function(){
			if(err.isAppError){
			    throw err;
			} else {
			    throw AppError.throwAppError(500, err.toString());
			}
		    });
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
            reject(AppError.throwAppError(500, err.toString()));
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
	    return reject(AppError.throwAppError(500, err.toString()));
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

/* 
 * Revision 값이 홀수인 경우 단지 커밋하고자 하는 노드들을 저장하고
 * 그 결과를 넘기기만 한다.
 */

var shortCommit = function(group, revision, commitChunk){
    return new Promise(function(resolve, reject){
        Node.saveNodeBatch(commitChunk).then(function(savedNodeList){
   	    var savedNodeIds = [];
		    
	    _.forEach(savedNodeList, function(saved){
		savedNodeIds.push({nid : saved.nid, revision : saved.revision})
	    });

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
	var Connection = db.connection;

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

	return User.getGroup(user, gid).then(function(group){
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
            return Group.getDeltaSet(group, traversalInfo, Connection).then(function(deltaSet){
		//deltaSet의 backward들과 forward들의 nid, revision으로 실제 노드 정보를 얻는다.
                return Node.getChangeSetBatch2(group.id, deltaSet.backward).then(function(changeSetBackward){
                    return Node.getChangeSetBatch2(group.id, deltaSet.forward).then(function(changeSetForward){
			var result;
                        try {
			    //diff를 통해 backward와 forward에서 중복되는 노드들을 제외시킨다.
			    var forwardList = utils.sumDeltaListForUpdate(changeSetForward);
			    var backwardList = utils.sumDeltaListForUpdate(changeSetBackward);

			    result = _.differenceBy(forwardList, backwardList, function(element){
				return element.nid + element.revision;
			    });

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
