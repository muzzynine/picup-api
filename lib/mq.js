var Promise = require('bluebird');
var mq = require('squiss');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('MQLogger');

function MQ(){
    this.instance;
};

/*
 * opts.queueName The name of the queue to be polled. Used only if opts.queueUrl is  * not specified, but Squiss prefers just the name.
 * opts.queueUrl The URL of the queue to be polled. If not specified, opts.queueName *  is required.
 * opts.accountNumber If a queueName is specified, the accountNumber of the queue ow * ner can optionally be specified to access a queue in a different AWS account.
 * opts.correctQueueUrl Default false. Changes the protocol, host, and port of the q * ueue URL to match the configured SQS endpoint (see opts.awsConfig), applicable on * ly if opts.queueName is specified. This can be useful for testing against a local * SQS service, such as ElasticMQ.
 */

MQ.prototype.init = function(opts){
    this.instance = new mq(opts);
    log.info("MQ#Message Queue(SQS) successfully initialized");
};

MQ.prototype.sendMessage = function(type, uids, msg){
    if(!this.instance){
	throw AppError.throwAppError(500, "MQ instance initialize needed");
    }
    var msg = {
	type : type,
	uids : uids,
	message : msg
    }

    return this.instance.sendMessage(msg);
}

MQ.prototype.sendCommitMessage = function(uids, gid){
    return this.sendMessage('sync', uids, { gid : gid });
}

module.exports = new MQ();

	
