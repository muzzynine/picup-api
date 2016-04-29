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
	    
/*
 * addNodeDelta를 병렬적으로 일어나도록 한다.
 */
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
                return reject(AppError.throwAppError(500, err.toString()));
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
                        return reject(AppError.throwAppError(500, err.toString()));
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
                        return reject(AppError.throwAppError(500, err.toString()));
                    }
                    resolve(nodeDelta);
                })
            }
        });
    });
};

module.exports = NodeDelta;

