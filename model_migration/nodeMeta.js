/**
 * Created by impyeong-gang on 1/17/16.
 */
'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var Dynamo = require('dynamoose');
var NodeMetaScheme = require('./scheme').NODE_META;
var nodeMetaModel = Dynamo.model(NodeMetaScheme.TABLE, NodeMetaScheme.SCHEME);
var uuid = require('node-uuid');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

var AppError = require('../lib/appError');

var NUMBER_OF_REQUEST_CONCURRENCY = 100;

function NodeMeta(){};

NodeMeta.getNodeMetaByIdsBatch = function(metaKeyArray){
    var keyChunk = _.chunk(metaKeyArray, NUMBER_OF_REQUEST_CONCURRENCY);
    var jobs = [];

    _.forEach(keyChunk, function(keyArray){
        jobs.push(nodeMetaModel.batchGet(keyArray))
    });

    return Promise.settle(jobs).then(function(results){
        var found = [];
        _.forEach(results, function(result){
            if(result.isFulfilled()){
                found = _.concat(found, result.value());
            } else {
                throw result.reason();
            }
        });
        return found;
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
        nodeMetaModel.queryOne({gid : {eq : gid}, relPath : {eq : relPath}}, function(err, nodeMeta){
            if(err){
                return reject(AppError.throwAppError(500, err.toString()));
            }
            if(!nodeMeta){
                return reject(AppError.throwAppError(404, "Not exist nodeMeta"));
            }
            resolve(nodeMeta);
        });
    })
};

/*
 * 다수의 getNodeMetaByGidAndRelPath를 병렬적으로 일어나도록 한다.
 */

NodeMeta.getNodeMetaByGidAndRelPathBatch = function(nodeInfos){
    var jobs = [];
    nodeInfos.forEach(function(nodeInfo){
        jobs.push(NodeMeta.getNodeMetaByGidAndRelPath(nodeInfo.gid, nodeInfo.relPath));
    });

    return Promise.settle(jobs).then(function(results){
        var found = [];
        _.forEach(results, function(result){
            if(result.isFulfilled()){
                found.push(result.value());
            } else {
		throw result.reason();
            }
        })
        return found;
    });
};


NodeMeta.addNodeMetaBatch = function(nodeArray){
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
	jobs.push(nodeMetaModel.batchPut(chunk))
    });
    
    return Promise.settle(jobs).then(function(results){
	_.forEach(results, function(result){
            if(!result.isFulfilled()){
                throw result.reason();
            }
        });
        return nodeMetaArray;
    });
};

module.exports = NodeMeta;
