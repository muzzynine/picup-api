'use strict';

/**
 * Created by impyeong-gang on 12/3/15.
 */
var Promise = require('bluebird')
var amqp = require('amqplib');
var config = require('../config/config');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('AMQPLogger');

function GCMPusher(){
    this.db = {};
    this.conn = {};
    this.ch = {};
    this._exchange = {};
};

GCMPusher.prototype.init = function(db){
    this.db = db;
};

GCMPusher.prototype.connect = function(){
    var self = this;

    return new Promise(function(resolve, reject){
	amqp.connect(config.AMQP.amqpAddr).then(function (conn) {
	    process.once('SIGINT', function(){ conn.close(); });
	    conn.on('error', self.reconnect.bind(self));

	    return conn.createChannel().then(function(ch){
		return ch.assertQueue(config.AMQP.QUEUE.name, {durable: true}).then(function(){
		    log.info("AMQP#connected server Successfully");
		    self.conn = conn;
		    self.ch = ch;
		    resolve();
		});
	    });
	}, function connectionFailed(err){
	    if(err){
		log.error("AMQP#connect", {url : config.AMQP.amqpAddr}, {err : err.toString()}, {stack : err.stack});
		self.reconnect();
	    }
	}).catch(function(err){
	    if(err.isAppError){
		return reject(err);
	    }
	    reject(AppError.throwAppError(500, err.toString()));
	});
    });
};

GCMPusher.prototype.reconnect = function(err){
    var self = this;
    seltTimeout(function(){
	log.info("AMQP#reconnect", {url : config.AMQP.amqpAddr}, {qName : config.AMQP.QUEUE.name});
	self.connect();
    }, RECONNECT_TIMEOUT);
}

GCMPusher.prototype.send = function(message){
    var self = this;
    return new Promise(function(resolve, reject){
	if(!self.conn || !self.ch){
	    return reject(AppError.throwAppError(500, "GCM pusher's connection is invalid"));
	}
	
	var buffer = new Buffer(JSON.stringify(message));

	self.ch.sendToQueue(config.AMQP.QUEUE.name, buffer);
	resolve();
    });
};

GCMPusher.prototype.sendCommitMessage = function(users, gid){
    var self = this;
    return new Promise(function(resolve, reject){
	var type = 'sync';

	/*
	 * 푸시를 위한 메시지 포맷은
	 * type (String) : 메시지의 종류 notification, sync
	 * uids (Array) : 보낼 대상의 uid
	 * message (json) : { (Optional - 타입이 sync인 경우 ) gid : 동기화할 그룹 아이디
	 *                    (Optional - 타입이 notification인 경우 ) message : 보낼 메시지
	 */
	var msg = {
            type : type,
            uids : users,
            message : { gid : gid }
	};

	self.send(msg).then(function(){
	    resolve();
	}).catch(function(err){
	    resolve();
	   // reject(err);
	});
    });
};
			 

module.exports = new GCMPusher();
