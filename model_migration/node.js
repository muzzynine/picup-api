/**
 * Created by impyeong-gang on 12/27/15.
 */
'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var config = require('../config/config');
var NodeMeta = require('./nodeMeta');
var NodeDelta = require('./nodeDelta');
var Sync = require('../lib/sync');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

module.exports = Node;

function Node(nid, gid, relPath, kind,
              revision, presence, name,
              owner, author, s3Path,
              s3ThumbnailPath, exif, updatedDate,
              uploadedDate, createdDate){
    this.nid = nid || null;
    this.gid = gid
    this.relPath = relPath;
    this.kind = kind;
    this.revision = revision;
    this.presence = presence;
    this.name = name || "";
    this.owner = owner || null;
    this.author = author || null;
    this.s3Path = s3Path || null;
    this.s3ThumbnailPath = s3ThumbnailPath || null;
    this.exif = exif || null;
    this.updatedDate = updatedDate || 0;
    this.uploadedDate = uploadedDate || 0;
    this.createdDate = createdDate || 0;
}


/**
 * 노드 오브젝트는 정보를 db에 기록하기 위한 save function을 갖는다.
 * 한 노드 오브젝트는 NodeMeta와 NodeDelta의 정보로 이루어지기 때문에
 * 노드의 정보를 나누어 각각 저장한다.
 * @param fn
 * @returns {*}
 */
Node.prototype.save = function(){
    var self = this;
    if(self.presence === PRESENCE_ADD) {
        /*
         * 서로 다른 Document의 쓰기 작업이기 NodeDelta의 쓰기 작업이 실패했을 때,
         * 이미 쓰여진 NodeMeta는 비즈니스 로직에 아무런 영향을 않는다.
         * NodeMeta는 gid와 relPath의 조합으로 서비스 전체적으로 유니크해야한다.
         * 이를 NodeMeta#addNodeMeta에서 존재할 경우 업데이트, 존재하지 않을 경우 업데이트 함으로서 트랜잭션을 필요없게 한다.
         */
        return new Promise(function(resolve, reject) {
            NodeMeta.addNodeMeta(self).then(function (nodeMeta) {
                self.nid = nodeMeta.nid;
                return NodeDelta.addNodeDelta(self).then(function (nodeDelta) {
                    return resolve(new Node(nodeMeta.nid, nodeMeta.gid, nodeMeta.relPath, nodeMeta.kind,
                        nodeDelta.revision, nodeDelta.presence, nodeDelta.name, nodeDelta.owner,
                        nodeMeta.author, nodeDelta.s3Path, nodeDelta.s3ThumbnailPath, nodeMeta.exif,
                        nodeDelta.updatedDate, nodeMeta.uploadedDate, nodeDelta.createdDate));
                })
            }).catch(function(err) {
                log.error("Node#save - ADD Presence", {err :err});
                return reject(err);
            });
        });
    } else if(self.presence === PRESENCE_DELETE || self.presence === PRESENCE_REPLACE){
        /*
         * 삭제와 변경의 경우, 모두 해당 NodeMeta에 대한 NodeDelta를 추가, 생성함으로써 처리된다.
         * NodeMeta#addNodeDelta에서 nid, revision값을 식별하여 존재할 경우 업데이트, 존재하지 않을 경우 델타를 생성함으로써
         * 전체 NodeDelta에 대해서 어느 시점의 노드에 대한 한 버전은 하나밖에 존재하지 않는다.
         */
        return new Promise(function(resolve, reject){
            NodeMeta.findNodeByGidAndRelPath(self.gid, self.relPath).then(function(nodeMeta){
                self.nid = nodeMeta.nid;
                return NodeDelta.addNodeDelta(self).then(function(nodeDelta){
                    return resolve(new Node(nodeMeta.nid, nodeMeta.gid, nodeMeta.relPath, nodeMeta.kind,
                        nodeDelta.revision, nodeDelta.presence, nodeDelta.name, nodeDelta.owner,
                        nodeMeta.author, nodeDelta.s3Path, nodeDelta.s3ThumbnailPath,  nodeMeta.exif,
                        nodeDelta.updatedDate, nodeMeta.uploadedDate, nodeDelta.createdDate));
                })
            }).catch(function(err){
                log.error("Node#save - DELETE||REPLACE Presence", {err :err});
                return reject(err);
            });
        })
    } else {
        return new Promise(function(resolve, reject){
            log.error("Node#save - Not supported presence", {err :err});
            reject(AppError.throwAppError(500));
        });
    }
};

Node.prototype.incrementRevision = function(){
    this.revision += 1;
};

/**
 * Node객체가 db에 들어갔다가 나오면 상태만 있고, 프로토가 없다.
 * 살려주기 위해 초기화한다.
 * @param transaction
 */
Node.instantiateNode = function(transaction){
    var node = transaction.data.slice(0);
    var result = [];

    for(var i in node){
        result.push(new Node(node[i].nid, node[i].gid, node[i].relPath, node[i].kind, node[i].revision, node[i].presence, node[i].name, node[i].owner,
            node[i].author, node[i].s3Path, node[i].s3ThumbnailPath, node[i].exif, node[i].updatedDate, node[i].uploadedDate, node[i].createdDate));
    }
    transaction.data = result;
};


Node.addNodeBatch = function(nodes){
    return new Promise(function(resolve, reject){
        /*
         * 서로 다른 Document의 쓰기 작업이기 NodeDelta의 쓰기 작업이 실패했을 때,
         * 이미 쓰여진 NodeMeta는 비즈니스 로직에 아무런 영향을 않는다.
         * NodeMeta는 gid와 relPath의 조합으로 서비스 전체적으로 유니크해야한다.
         * 이를 NodeMeta#addNodeMeta에서 존재할 경우 업데이트, 존재하지 않을 경우 업데이트 함으로서 트랜잭션을 필요없게 한다.
         */

        NodeMeta.addNodeMetaBatch(nodes).then(function(nodeMetas){
            return NodeDelta.addNodeDeltaBatch(nodes).then(function(nodeDeltas){
                var result = [];
                nodeMetas.forEach(function(nodeMeta){
                    var nodeDelta = _.find(nodeDeltas, {nid : nodeMeta.nid});
                    if(nodeDelta){
                        result.push(_.merge(nodeMeta, nodeDelta));
                    }
                });
                resolve(result);
            })
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

Node.replaceNodeBatch = function(nodes){
    return new Promise(function(resolve, reject){
        /*
         * 삭제와 변경의 경우, 모두 해당 NodeMeta에 대한 NodeDelta를 추가, 생성함으로써 처리된다.
         * NodeMeta#addNodeDelta에서 nid, revision값을 식별하여 존재할 경우 업데이트, 존재하지 않을 경우 델타를 생성함으로써
         * 전체 NodeDelta에 대해서 어느 시점의 노드에 대한 한 버전은 하나밖에 존재하지 않는다.
         */
        NodeMeta.getNodeMetaByGidAndRelPathBatch(nodes).then(function(nodeMetas){
            var alivedNodes = [];
            nodes.forEach(function(node){
                var nodeMeta = _.find(nodeMetas, {gid : node.gid, relPath : node.relPath});
                if(nodeMeta){
                    node.nid = nodeMeta.nid;
                    alivedNodes.push(node);
                }
            });
            return NodeDelta.addNodeDeltaBatch(alivedNodes).then(function(nodeDeltas){
                var result = [];
                alivedNodes.forEach(function(nodeMeta){
                    var nodeDelta = _.find(nodeDeltas, {nid : nodeMeta.nid});
                    if(nodeDelta){
                        result.push(_.merge(nodeMeta, nodeDelta));
                    }
                });
                resolve(result);
            })
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        })
    })
};

Node.deleteNodeBatch = function(nodes){
    return new Promise(function(resolve, reject){
        /*
         * 삭제와 변경의 경우, 모두 해당 NodeMeta에 대한 NodeDelta를 추가, 생성함으로써 처리된다.
         * NodeMeta#addNodeDelta에서 nid, revision값을 식별하여 존재할 경우 업데이트, 존재하지 않을 경우 델타를 생성함으로써
         * 전체 NodeDelta에 대해서 어느 시점의 노드에 대한 한 버전은 하나밖에 존재하지 않는다.
         */

        NodeMeta.getNodeMetaByGidAndRelPathBatch(nodes).then(function(nodeMetas){
            var alivedNodes = [];
            nodes.forEach(function(node){
                var nodeMeta = _.find(nodeMetas, {gid : node.gid, relPath : node.relPath});
                if(nodeMeta){
                    node.nid = nodeMeta.nid;
                    alivedNodes.push(node);
                }
            });
            return NodeDelta.addNodeDeltaBatch(alivedNodes).then(function(nodeDeltas){
                var result = [];
                alivedNodes.forEach(function(nodeMeta){
                    var nodeDelta = _.find(nodeDeltas, {nid : nodeMeta.nid});
                    if(nodeDelta){
                        result.push(_.merge(nodeMeta, nodeDelta));
                    }
                });
                resolve(result);
            })
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toStriong()));
        })
    })
};

/*
 * saveNodeBatch는 인자로 넘어온 node의 리스트를 모두 데이터베이스에 저장한다.
 */
Node.saveNodeBatch = function(nodes){
    return new Promise(function(resolve, reject) {
	var classified = {
            add : [],
            delete : [],
            replace : []
        };
	
        nodes.forEach(function(node){
            if(node.presence === Sync.PRESENCE_ADD) classified.add.push(node);
            else if (node.presence === Sync.PRESENCE_DELETE) classified.delete.push(node);
            else if (node.presence === Sync.PRESENCE_REPLACE) classified.replace.push(node);
        });

        var jobs = [];
	
        if(classified.add.length !== 0) jobs.push(Node.addNodeBatch(classified.add));
        if(classified.replace.length !== 0) jobs.push(Node.replaceNodeBatch(classified.replace));
        if(classified.delete.length !== 0) jobs.push(Node.deleteNodeBatch(classified.delete));


        Promise.settle(jobs).then(function(results){
            var savedNodes = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    savedNodes = _.concat(savedNodes, result.value());
                } else {
                    throw result.reason();
                }
            });
            resolve(savedNodes);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
            reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

/**
 * nid에 해당하는 노드들 중 revnum과 그 Skip-delta사이의 변경점들을 구한다.
 * @param nid
 * @param revnum
 * @param fn
 */
Node.getNodeBetweenSkipRevision = function(gid, nid, revnum) {
    return new Promise(function(resolve, reject){
        var src = Sync.getSkipDeltaNumber(revnum);
        var dst = revnum;
        return NodeMeta.getNodeMetaByIds(gid, nid).then(function(nodeMeta){
            return NodeDelta.getNodeDeltaByBetweenRev(nodeMeta.nid, src, dst).then(function(nodeDeltas){
                var result = [];
                nodeDeltas.forEach(function (nodeDelta) {
                    var node = new Node(nodeMeta.nid, nodeMeta.gid, nodeMeta.relPath, nodeMeta.kind,
                        nodeDelta.revision, nodeDelta.presence, nodeDelta.name, nodeDelta.owner,
                        nodeMeta.author, nodeDelta.s3Path, nodeDelta.s3ThumbnailPath, nodeMeta.exif,
                        nodeDelta.updatedDate, nodeMeta.uploadedDate, nodeDelta.createdDate);
                    result.push(node);
                });
                resolve(result);
            })
        }).catch(function(err){
            reject(err);
        })
    })
};


Node.getNodeBetweenSkipRevisionBatch = function(gid, revision, deltaUpdateList) {
    return new Promise(function(resolve, reject){
        var src = Sync.getSkipDeltaNumber(revision);
        var dst = revision;

        var metaKeys = [];

        _.forEach(deltaUpdateList, function(nid){
            metaKeys.push({
                gid : gid,
                nid : nid
            });
        });

        NodeMeta.getNodeMetaByIdsBatch(metaKeys).then(function(nodeMetas){
            return NodeDelta.getNodeDeltaByBetweenRevBatch(nodeMetas, src, dst).then(function(nodeDeltas){
                var nodes = [];

		_.forEach(nodeMetas, function(nodeMeta){
                    var nodeDelta = _.find(nodeDeltas, {nid : nodeMeta.nid});
                    if(nodeDelta){
                        var node = new Node(nodeMeta.nid, nodeMeta.gid, nodeMeta.relPath, nodeMeta.kind,
                            nodeDelta.revision, nodeDelta.presence, nodeDelta.name, nodeDelta.owner,
                            nodeMeta.author, nodeDelta.s3Path, nodeDelta.s3ThumbnailPath, nodeMeta.exif,
                            nodeDelta.updatedDate, nodeMeta.uploadedDate, nodeDelta.createdDate);
                        nodes.push(node);
                    }
                });
                resolve(nodes);
            })
        }).catch(function(err){
            reject(err);
        });
    })
};


/**
 * Node의 id가 담겨있는 배열을 받아, 해당 노드가 살아있는지 확인하고,
 * 살아있는 nid들의 배열을 리턴한다.
 * @param nodeArray
 * @param fn
 */
Node.getAliveNodes = function(gid, nidArray){
    return new Promise(function(resolve, reject) {
        var nids = nidArray.slice(0);
        var result = [];
        (function checkAlive(){
            if(nids.length === 0){
                return resolve(result);
            }
            var nid = nids.splice(0,1)[0];
            Node.isAlive(gid, nid).then(function(is){
                if(is) result.push(nid);
                setTimeout(checkAlive, 0);
            }).catch(function(err){
                log.error("Node#getAliveNodes", {err :err});
                return reject(err);
            });
        })();
    })
};

Node.getAliveNodes2 = function(nodeInfo){    
    return new Promise(function(resolve, reject){
	NodeMeta.getNodeMetaByIdsBatch(nodeInfo).then(function(nodeMetas){
            return NodeDelta.getLatestNodeDeltaBatch(nodeMetas).then(function(nodeDeltas){
                var nids = [];
                nodeDeltas.forEach(function(delta){
                    if(delta.presence !== Sync.PRESENCE_DELETE){
                        nids.push(delta.nid);
                    }
                });
                resolve(nids);
            })
        }).catch(function(err){
            log.error("Node#isAlive", {err :err});
            reject(err);
        });
    })
};

/**
 * Node가 delete가 아니라 존재하는 상태인지 확인한다.
 * @param nid
 * @param fn
 */
Node.isAlive = function(gid, nid){
    return new Promise(function(resolve, reject){
        NodeMeta.findNodeById(gid, nid).then(function(nodeMeta){
            return NodeDelta.findNodeDeltaByNid(nodeMeta.nid).then(function(nodeDelta){
                if(nodeDelta.presence === Sync.PRESENCE_DELETE){
                    return resolve(false);
                }
                resolve(true);
            });
        }).catch(function(err){
            log.error("Node#isAlive", {err :err});
            return reject(err);
        });
    })
};

/**
 * getAliveNode3
 *
 * 새로운 Skip-delta에 포함될 기존 그룹-델타들의 노드의 nid와 revision의 배열을 키로 리모트 데이터베이스에서
 * 얻어진 노드-델타 정보들과, 새로 커밋될 노드들의 정보를 연산하여, 새로운 델타에 포함될 노드정보를 얻는다. 
 * 해당 작업은 델타의 크기를 가능한한 최소로 유지하기 위함이다.
 * 
 * ... 8 <- +A - 9       10 <- -B - 11        12 
 *     8 <- - - +AB - - -10
 *     8 <- - - - - - - - +AC - - - - - - - - 12
 * 
 */

Node.getAliveNodes3 = function(prevNodesDeltaKey, toCommitNodeList){
    return new Promise(function(resolve, reject){
	NodeDelta.getNodeDeltaByNidAndRevBatch(prevNodesDeltaKey).then(function(prevNodeDeltaList){
	    
	    var allNodeOfGroupDelta = _.sortBy(_.concat(prevNodeDeltaList, toCommitNodeList), 'revision');

	    /**
	     * long-commit일 경우 만들고자 하는 스킵-델타는 중복된 노드를 가질 수 있다.(ex. 4-8 스킵델타의 한 노드-메타의 5,6,7 노드-델타)
	     * 포함되는 정보의 조건은 아래 명시.
	     * 1. 스킵-델타 내에서 추가된 노드(단, 스킵-델타 내에서 삭제되지 않아야 함)
	     * 2. 스킵-델타 내에서 변경된 노드(단, 스킵-델타 내에서 삭제되지 않았고, 변경된 노드-델타중 가장 최신이어야 한다.)
	     * 3. 스킵-델타 내에서 삭제된 노드(단, 스킵 델타 내에서 추가, 변경 되지 않아야 함)
	     *
	     * 위에 해당하는 노드의 정보만 포함하도록 한다.
	     * alives array에 포함될 노드들을 추가하고, 수정해가며 완성한다.
	     **/

	    var alives = [];	    

	    _.forEach(allNodeOfGroupDelta, function(node){
		if(node.presence === Sync.PRESENCE_ADD){
		    //노드의 presence가 add인 경우는 반드시 alives에 추가한다.
		    //같은 스킵-델타 안에서 delete가 존재할 수 있으나, 그것은 delete case에서 처리하도록 한다.
		    //왜냐하면 비즈니스 특성상 add가 delete보다 빈번하게 일어나는 작업이기 때문이다.
		    alives.push(node);
		} else if(node.presence === Sync.PRESENCE_REPLACE){
		    //노드의 presence가 replace인 경우에 alives에 같은 nid가 존재하지 않는 경우는 추가하여야 한다.
		    //같은 nid가 존재하고, revision이 더 높은 경우는 alives의 해당 노드를 최신 정보로 교체시켜 스킵-델타 내에 최신의 필요한 정보만
		    //유지시키도록 한다.
	
		    var found = false;

		    for(var j = 0; j < alives.length ; j++){
			var included = alives[j];
			if(node.nid === included.nid && node.presence === included.presence){
			    found = true;
			    if(node.revision > included.revision){
				alives.splice(j, 1, node);
			    }
			    break;
			}
		    }
		    
		    //alives에서 같은 노드(nid와 presence가 일치하는)를 찾지 못했을 경우에는 추가한다.	    
		   
		    if(!found){
			alives.push(node);
		    }
		    
		} else {
		    //노드의 presence가 delete인 경우는, alives에 같은 nid를 지닌 정보를 모두 지우도록 한다.
		    var found = false;
		    
		    for(var j = 0; j < alives.length ; j++){
			var included = alives[j];
			if(node.nid === included.nid){
			    found = true;
			    alives.splice(j, 1);
			    break;
			}
		    }

		    if(!found){
			alives.push(node);
		    }
		}
	    });
	    
	    alives = _.map(alives, function(alive){
		return {
		    nid : alive.nid,
		    revision : alive.revision
		};
	    });

	    resolve(alives);
	}).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    } 
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
}
		         
		    			
Node.getChangeSetBatch = function(gid, deltaSet){
    return new Promise(function(resolve, reject){
        var jobs = [];
        _.forEach(deltaSet, function(delta){
            var job = Node.getNodeBetweenSkipRevisionBatch(gid, delta.revision, delta.data);
            jobs.push(job);
        });

        Promise.settle(jobs).then(function(results){
            var changeSet = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    changeSet.push(result.value());
                } else {
                    return reject(result.reason());
                }
            });
            resolve(changeSet);
        }).catch(function(err){
            reject(err);
        });
    });
};


Node.getChangeSetBatch2 = function(gid, deltaSet){
    return new Promise(function(resolve, reject){
        var jobs = [];
        _.forEach(deltaSet, function(delta){
            var job = Node.getChangeSet2(gid, delta.data);
            jobs.push(job);
        });

        Promise.settle(jobs).then(function(results){
            var changeSet = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    changeSet.push(result.value());
                } else {
                    throw result.reason();
                }
            });
            resolve(changeSet);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

/*
 * gid에 해당하는 그룹의 delta정보를 받아 delta정보가 포함하고 있는
 * 모든 노드정보를 remote db로부터 가져와 이를 반환한다.
 */
Node.getChangeSet2 = function(gid, deltaData){
    return new Promise(function(resolve, reject){
	var uniqNids = _.uniq(_.map(deltaData, 'nid'));
    
	var metaKey = [];

	_.forEach(uniqNids, function(nid){
	    metaKey.push({
		gid : gid,
		nid : nid
	    });
	});

	NodeMeta.getNodeMetaByIdsBatch(metaKey).then(function(nodeMetas){
	    return NodeDelta.getNodeDeltaByNidAndRevBatch(deltaData).then(function(nodeDeltas){
		var nodes = [];
		_.forEach(nodeDeltas, function(nodeDelta){
		    var nodeMeta = _.find(nodeMetas, {nid : nodeDelta.nid});
	            if(nodeMeta){
			var node = new Node(nodeMeta.nid, nodeMeta.gid, nodeMeta.relPath, nodeMeta.kind,
					    nodeDelta.revision, nodeDelta.presence, nodeDelta.name, nodeDelta.owner,
					    nodeMeta.author, nodeDelta.s3Path, nodeDelta.s3ThumbnailPath, nodeMeta.exif,
					    nodeDelta.updatedDate, nodeMeta.uploadedDate, nodeDelta.createdDate);
			nodes.push(node);
		    }
		});
		resolve(nodes);
	    });
	}).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
}
		

/**
 * 커밋을 위한 델타 정보를 생성한다.
 * @param deltaArray
 * @param uid
 * @param gid
 * @param revision
 * @returns {*}
 */
Node.generateNodeInfo = function(deltaArray, uid, gid, revision){
    var thumbnailBucketName = config.S3.minionBucket;

    var nodes = [];

   for(var i in deltaArray){
       var node;
       var nodeInfo = deltaArray[i];
       if(nodeInfo.presence === Sync.PRESENCE_ADD) {
           /*
            * 받은 s3Path가 default라면, s3ThumbnailPath 또한 default로 설정한다.
            * 만약 s3Path가 null이라면, s3ThunmbnailPath 또한 null로 설정한다.
            * s3Path가 있다면 s3ThumbnailPath를 세팅한다.
            */
           var addThumbnailPath = nodeInfo.s3Path === "default" ? "default"
               : (!nodeInfo.s3Path || nodeInfo.s3Path === "null") ? null
               : Sync.S3ThumbnailPathGenerator(nodeInfo.s3Path, thumbnailBucketName);

           node = new Node(null, gid, nodeInfo.relPath, nodeInfo.kind,
               revision, Sync.PRESENCE_ADD, nodeInfo.name,
               uid, uid, nodeInfo.s3Path,
               addThumbnailPath, nodeInfo.exif, Date.now(), Date.now(), nodeInfo.createdDate);
       }

       else if(nodeInfo.presence === Sync.PRESENCE_REPLACE) {
           var replaceThumbnailPath = nodeInfo.s3Path === "default" ? "default"
               : (!nodeInfo.s3Path || nodeInfo.s3Path === "null") ? null
               : Sync.S3ThumbnailPathGenerator(nodeInfo.s3Path, thumbnailBucketName);

           node = new Node(null, gid, nodeInfo.relPath, nodeInfo.kind,
               revision, Sync.PRESENCE_REPLACE, nodeInfo.name,
               nodeInfo.owner, null, nodeInfo.s3Path,
               replaceThumbnailPath, null, Date.now(), null, nodeInfo.createdDate);
       }

       else if(nodeInfo.presence === Sync.PRESENCE_DELETE) {
           node = new Node(null, gid, nodeInfo.relPath, nodeInfo.kind,
               revision, Sync.PRESENCE_DELETE, null, null, null, null, null, nodeInfo.exif, Date.now());
       }
       nodes.push(node);

    }
    return nodes;
};













