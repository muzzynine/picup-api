/**
 * Created by impyeong-gang on 1/17/16.
 */

'use strict';

var Promise = require('bluebird');
var Dynamo = require('dynamoose');
var NodeDeltaScheme = require('./scheme').NODE_DELTA;
var NodeDelta = Dynamo.model(NodeDeltaScheme.TABLE, NodeDeltaScheme.SCHEME)
var _ = require('lodash');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var NUMBER_OF_REQUEST_CONCURRENCY = 100;

/**
 * 노드의 id로 최신 버전의 노드 델타를 얻는다.
 * @param nid
 * @param fn
 */
NodeDelta.getLatestNodeDelta = function(nid){
    return new Promise(function(resolve, reject){
        NodeDelta.queryOne('nid').eq(nid).where('revision').descending().exec(function(err, nodeDelta){
            if(err){
                log.error("NodeDelta#findNodeDeltaByNid - DB(NOSQL) Internal error", {err: err});
                return reject(AppError.throwAppError(500));
            }
            if(!nodeDelta){
                return reject(AppError.throwAppError(404));
            }
            resolve(nodeDelta);
        });
    });
};

NodeDelta.getLatestNodeDeltaBatch = function(nodeMetas){
    return new Promise(function(resolve, reject){
        var nodeDeltas = [];
        var jobs = [];

	_.forEach(nodeMetas, function(nodeMeta){
	    jobs.push(NodeDelta.getLatestNodeDelta(nodeMeta.nid));
	})

        Promise.settle(jobs).then(function(results){
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    var delta = result.value();
                    nodeDeltas.push(delta);
                } else {
		    var err = result.reason();
		    throw err;
                }
            });
            resolve(nodeDeltas);
        }).catch(function(err){
	    log.error("#getLatestNodeDeltaBatch", {err : err});
	    reject(AppError.throwAppError(500));
	});
    });
};

/**
 * 노드의 id와 버전으로 특정 버전의 노드 델타를 얻는다.
 * @param nid
 * @param revnum
 * @param fn
 */
NodeDelta.getNodeDeltaByNidAndRev = function(nid, revision){
    return new Promise(function(resolve, reject){
        NodeDelta.get(
            {nid : nid, revision : revision},
            function(err, NodeDelta){
                if(err){
                    log.error("NodeDelta#findNodeDeltaByNidAndRev - DB(NOSQL) Internal error", {err: err});
                    return reject(AppError.throwAppError(500));
                }
                if(!NodeDelta){
                    return reject(AppError.throwAppError(404));
                }
                resolve(NodeDelta);
            }
        )
    })
};

NodeDelta.getNodeDeltaByNidAndRevBatch = function(nodesArray){
    return new Promise(function(resolve, reject){
	var keyChunk = _.chunk(nodesArray, NUMBER_OF_REQUEST_CONCURRENCY);
	var jobs = [];
	
	_.forEach(keyChunk, function(keyArray){
	    jobs.push(NodeDelta.batchGet(keyArray))
	});

	Promise.settle(jobs).then(function(results){
	    var found = [];

	    _.forEach(results, function(result){
		if(result.isFulfilled()){
		    found = _.concat(found, result.value());
		} else {
		    throw result.reason();
		}
	    });
	    resolve(found);
	}).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
};
	    


/**
 * 노드의 id와 버전으로 특정 버전의 노드 델타를 얻는다.
 * @param nid
 * @param revnum
 * @param fn
 */
NodeDelta.getNodeDeltaByBetweenRev = function(nid, src, dst){
    return new Promise(function(resolve, reject){
	var result = [];
        NodeDelta.query('nid').eq(nid).where('revision').between(src, dst).exec(function(err, nodeDeltas){
            if(err){
                log.error("NodeDelta#findNodeDeltaByBetweenRev/DB(NOSQL) Internal error", {err :err});
                return reject(AppError.throwAppError(500));
            }

            _.remove(nodeDeltas, function(delta){
                return delta.revision === src;
            });

	    _.forEach(nodeDeltas, function(delta){
		result.push(delta);
	    });
	    
            if(nodeDeltas.length === 0){
                return reject(AppError.throwAppError(404));
            }
	    
            resolve(result);
        });
    })
};

NodeDelta.getNodeDeltaByBetweenRevBatch = function(nodeMetas, src, dst){
    return new Promise(function(resolve, reject){
        var jobs = [];

        _.forEach(nodeMetas, function(nodeMeta){
            var job = NodeDelta.getNodeDeltaByBetweenRev(nodeMeta.nid, src, dst);
            jobs.push(job);
        });

        return Promise.settle(jobs).then(function(results){
            var nodeDeltas = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    nodeDeltas = _.concat(nodeDeltas, result.value());
                } else {
                    return reject(result.reason());
                }
            });
            resolve(nodeDeltas);
        })
    })
};

NodeDelta.addNodeDeltaBatch = function(nodeArray){
    return new Promise(function(resolve, reject){

        var nodeDeltaArray = [];

        _.forEach(nodeArray, function(node){
            var nodeDelta = {
                nid : node.nid,
                revision : node.revision,
                presence : node.presence,
                s3Path : node.s3Path,
                s3ThumbnailPath : node.s3ThumbnailPath,
                name : node.name,
                owner : node.owner,
                updatedDate : node.updatedDate,
                createdDate : node.createdDate
            };
            nodeDeltaArray.push(nodeDelta);
        });

        var deltaChunk = _.chunk(nodeDeltaArray, NUMBER_OF_REQUEST_CONCURRENCY);
        var jobs = [];

        _.forEach(deltaChunk, function(chunk){
            jobs.push(NodeDelta.batchPut(chunk));
        });

        Promise.settle(jobs).then(function(results){
            _.forEach(results, function(result){
                if(!result.isFulfilled()){
                    throw result.reason();
                }
            });
            resolve(nodeDeltaArray);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
        });
    });
};

/**
 * 노드 델타에 대한 Document를 생성한다.
 * Insert가 아닌 Upsert로 하여 이전 실패작업에 대한 허용을 처리한다.
 * @param node
 * @param fn
 */
NodeDelta.addNodeDelta = function(node){
    return new Promise(function(resolve, reject){
        NodeDelta.get({nid : node.nid, revision : node.revision}, function(err, nodeDelta){
            if(err){
                return reject(AppError.throwAppError(500));
            }
            if(!nodeDelta){
                NodeDelta.create({
                    nid : node.nid,
                    revision : node.revision,
                    presence : node.presence,
                    s3Path : node.s3Path || null,
                    s3ThumbnailPath : node.s3ThumbnailPath || null,
                    name : node.name || null,
                    owner : node.owner || null,
                    updatedDate : node.updatedDate || null,
                    createdDate : node.createdDate || null
                }, function(err, created){
                    if(err){
                        log.error("NodeDelta#addNodeDelta/DB(NOSQL) Internal error", {err :err});
                        return reject(AppError.throwAppError(500));
                    }
                    resolve(created);
                })
            } else {
                nodeDelta.presence = node.presence;
                nodeDelta.s3Path = node.s3Path || null;
                nodeDelta.s3ThumbnailPath = node.s3ThumbnailPath || null;
                nodeDelta.name = node.name || null;
                nodeDelta.owner = node.owner || null;
                nodeDelta.updatedDate = node.updatedDate || null;
                nodeDelta.createdDate = node.createdDate || null;

                nodeDelta.save(function(err){
                    if(err){
                        log.error("NodeDelta#addNodeDelta/DB(NOSQL) Internal error", {err :err});
                        return reject(AppError.throwAppError(500));
                    }
                    resolve(nodeDelta);
                })
            }
        });
    });
};

module.exports = NodeDelta;

