/**
 * Created by impyeong-gang on 12/23/15.
 */

var Promise = require('bluebird');
var _ = require('lodash');
var aws = require('aws-sdk');

aws.config.update({region:'ap-northeast-1'});
var config = require('../config/config');
var s3 = new aws.S3({apiVersion : config.S3.apiVersions});
var AppError = require('./appError');
var Sync = require('./sync');

var originalBucketName = config.S3.originalBucket;
var thumbnailBucketName = config.S3.minionBucket;

/* 2가지 해결해야 하는 것이 있음
 하나는 썸네일, 원본으로 인한 함수 중복.
 하나는 클라이언트로 부터 받은 null값이 문자열이라, 이를 문자열로 다루어야 하는 내용*/

/**
 * AWS S3의 지정된 버킷과 키에 오브젝트가 존재하는지 검사한다.
 * @param bucket
 * @param key
 * @param fn
 */
var checkExistNodeObject = function(node){
    return new Promise(function(resolve, reject){
        var s3PathSet = Sync.S3PathSeparator(node.s3Path);
        var params = {
            Bucket: s3PathSet.bucket,
            Key: s3PathSet.key,
            Range : 'bytes=0-1'
        };

        s3.headObject(params, function(err, data){
            if(err){
                if(err.statusCode === 404) {
                    var notExistErr = AppError.throwAppError(404);
                    notExistErr.data = node;
                    return reject(notExistErr);
                }
                return reject(AppError.throwAppError(500, err.toString()));
            }
            resolve(data);
        });
    });
};

var checkExistThumbObject = function(node){
    return new Promise(function(resolve, reject){
        var s3PathSet = Sync.S3PathSeparator(node.s3ThumbnailPath);
        var params = {
            Bucket: s3PathSet.bucket,
            Key: s3PathSet.key,
            Range : 'bytes=0-1'
        };

        s3.headObject(params, function(err, data){
            if(err){
                if(err.statusCode === 404) {
                    var notExistErr = AppError.throwAppError(404);
                    notExistErr.data = node;
                    return reject(notExistErr);
                }
                return reject(AppError.throwAppError(500, err.toString()));
            }
            resolve(data);
        });
    });
};


/**
 * AWS S3 오브젝트들의 배열을 받아 해당 오브젝트들이 있는지 판단한다.
 * 존재하지 않는 오브젝트들의 배열을 리턴한다.
 * S3요청이 실피했을때는 500을 리턴한다.
 * @param objectArray
 * @param fn
 */
var checkExistNodeObjectsBatch = function(nodeArray){
    return new Promise(function(resolve, reject){
        var notExists = [];
        var jobs = [];
	
	/* 노드의 s3Path필드가 유효한지 확인하고, 유효하지 않은 경우에는 s3Path를 생성해준 뒤, notExists에 푸쉬한다. 
	   존재하는 경우에는 s3에 존재하는지 확인하기 위해 jobs에 푸쉬한다. */
	_.forEach(nodeArray, function(node){
	    if(node.s3Path !== "default" && node.presence !== Sync.PRESENCE_DELETE){
		if(!node.s3Path || node.s3Path === 'null'){
		    node.s3Path = Sync.S3PathGenerator(originalBucketName, node.gid, node.relPath, node.kind);
                    notExists.push(node);
		} else {
		    jobs.push(checkExistNodeObject(node));
		}
	    }
	});

        Promise.settle(jobs).then(function(results){
            results.forEach(function(result){
                if(!result.isFulfilled()){
                    var err = result.reason();
                    if(err.errorCode === 404){
                        notExists.push(err.data);
                    } else {
                        throw err;
                    }
                }
            });
            resolve(notExists);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
};


var checkExistThumbObjectsBatch = function(nodeArray){
    return new Promise(function(resolve, reject){
	
        var notExists = [];
        var jobs = [];

	_.forEach(nodeArray, function(node){
	    if(node.s3ThumbnailPath !== "default" && node.presence !== Sync.PRESENCE_DELETE){
		jobs.push(checkExistThumbObject(node));
	    }
	});

        Promise.settle(jobs).then(function(results){
            results.forEach(function(result){
                if(!result.isFulfilled()){
                    var err = result.reason();
                    if(err.errorCode === 404){
                        notExists.push(err.data);
                    } else {
                        throw err;
                    }
                }
            });
            resolve(notExists);
        }).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
};


exports.checkExistNodeObject = checkExistNodeObject;
exports.checkExistThumbObject = checkExistThumbObject;
exports.checkExistNodeObjectsBatch = checkExistNodeObjectsBatch;
exports.checkExistThumbObjectsBatch = checkExistThumbObjectsBatch;
