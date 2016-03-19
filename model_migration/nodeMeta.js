/**
 * Created by impyeong-gang on 1/17/16.
 */
'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var Dynamo = require('dynamoose');
var NodeMetaScheme = require('./scheme').NODE_META;
var NodeMeta = Dynamo.model(NodeMetaScheme.TABLE, NodeMetaScheme.SCHEME);
var uuid = require('node-uuid');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var AppError = require('../lib/appError');

module.exports = NodeMeta;

var NUMBER_OF_REQUEST_CONCURRENCY = 100;

NodeMeta.getNodeMetaByIds = function(gid, nid){
    return new Promise(function(resolve, reject){
        NodeMeta.get({gid : gid, nid : nid}, function(err, nodeMeta){
            if(err){
                log.error("NodeMeta#findNodeById/DB(NOSQL) Internal error", {err :err});
                return reject(AppError.throwAppError(500));
            }
            if(!nodeMeta){
                return reject(AppError.throwAppError(404));
            }
            resolve(nodeMeta);
        });
    })
};

NodeMeta.getNodeMetaByIdsBatch = function(metaKeyArray){
    return new Promise(function(resolve, reject){
        var keyChunk = _.chunk(metaKeyArray, NUMBER_OF_REQUEST_CONCURRENCY);
        var jobs = [];

        _.forEach(keyChunk, function(keyArray){
            jobs.push(NodeMeta.batchGet(keyArray))
        });

        Promise.settle(jobs).then(function(results){
            var found = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    found = _.concat(found, result.value());
                } else {
		    console.log(result.reason());
                    return reject(AppError.throwAppError(500));
                }
            });
            resolve(found);
        }).catch(function(err){
            console.log(err);
            reject(AppError.throwAppError(500));
        });
    });
};

/**
 * gid와 relPath로 NodeMeta정보를 얻는다.
 * NodeMeta는 gid와 relPath의 조합에 대해서 서비스 전체적으로 유니크해야한다.
 * @param gid
 * @param relPath
 * @param fn
 */


NodeMeta.getNodeMetaByGidAndRelPath = function(gid, relPath){
    return new Promise(function(resolve, reject){
        NodeMeta.queryOne('gid').eq(gid).where('relPath').eq(relPath).exec(function(err, nodeMeta){
            if(err){
                log.error("NodeMeta#findNodeByGidAndRelPath/DB(NOSQL) Internal error", {err :err});
                return reject(AppError.throwAppError(500));
            }
            if(!nodeMeta){
                return reject(AppError.throwAppError(404));
            }
            resolve(nodeMeta);
        });
    })
};


NodeMeta.getNodeMetaByGidAndRelPathBatch = function(nodeInfos){
    return new Promise(function(resolve, reject){
        var jobs = [];
        _.forEach(nodeInfos, function(nodeInfo){
            jobs.push(NodeMeta.getNodeMetaByGidAndRelPath(nodeInfo.gid, nodeInfo.relPath));
        });

        Promise.settle(jobs).then(function(results){
            var found = [];
            _.forEach(results, function(result){
                if(result.isFulfilled()){
                    found.push(result.value());
                } else {
		    console.log(result.reason());
		    return reject(AppError.throwAppError(500));
                }
            })
            resolve(found);
        }).catch(function(err){
            reject(AppError.throwAppError(500));
        })
    })
};


NodeMeta.addNodeMetaBatch = function(nodeArray){
    return new Promise(function(resolve, reject){
        var nodeMetaArray = [];

        _.forEach(nodeArray, function(node){
            node.nid = uuid.v1();

            var nodeMeta = {
                gid : node.gid,
                nid : node.nid,
                relPath : node.relPath,
                kind : node.kind,
                author : node.author,
                uploadedDate : node.uploadedDate,
                exif : node.exif
            };
            nodeMetaArray.push(nodeMeta);
        });

        var metaChunk = _.chunk(nodeMetaArray, NUMBER_OF_REQUEST_CONCURRENCY);
        var jobs = [];

        _.forEach(metaChunk, function(chunk){
	    jobs.push(NodeMeta.batchPut(chunk))
        });
	
	Promise.settle(jobs).then(function(results){
	    _.forEach(results, function(result){
                if(!result.isFulfilled()){
                    return reject(AppError.throwAppError(500));
                }
            });
            resolve(nodeMetaArray);
        }).catch(function(err){
	    console.log(err)
            reject(AppError.throwAppError(500));
        });
	
    });
};

/**
 * 새로운 노드에 대한 Document를 생성한다.
 * Insert가 아닌 Upsert로 하여 이전 실패작업에 대한 허용을 처리한다.
 * @param node
 * @param fn
 */
NodeMeta.addNodeMeta = function(node){
    return new Promise(function(resolve, reject){
        if(!node.nid) node.nid = uuid.v1();
        NodeMeta.get({gid : node.gid, nid : node.nid}, function(err, nodeMeta){
            if(err){
                return reject(AppError.throwAppError(500));
            }
            if(!nodeMeta){
                NodeMeta.create({
                    gid : node.gid,
                    nid : node.nid,
                    relPath : node.relPath,
                    kind : node.kind,
                    author : node.author,
                    uploadedDate : node.uploadedDate,
                    exif : node.exif
                }, function(err, created){
                    if(err){
                        log.error("NodeMeta#addNodeDelta/DB(NOSQL) Internal error", {err :err});
                        return reject(AppError.throwAppError(500));
                    }
                    resolve(created);
                });
            } else {
                nodeMeta.kind = node.kind;
                nodeMeta.author = node.author;
                nodeMeta.uploadedDate = node.uploadedDate;
                nodeMeta.exif = node.exif;

                nodeMeta.save(function(err){
                    if(err){
                        log.error("NodeMeta#addNodeDelta/DB(NOSQL) Internal error", {err :err});
                        return reject(AppError.throwAppError(500));
                    }
                    resolve(nodeMeta);
                })
            }
        });
    });
};