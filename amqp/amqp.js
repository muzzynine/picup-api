'use strict';

/**
 * Created by impyeong-gang on 12/3/15.
 */
var Promise = require('bluebird')
var amqp = require('amqplib/callback_api');
var config = require('../config');
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('AMQPLogger');

var connection;
var channel;

amqp.connect(config.AMQP.amqpAddr, function (err, conn) {
    if (err) {
        log.error(err);
        return;
    }
    connection = conn;
    conn.createChannel(function (err, ch) {
        if (err) {
            log.error(err);
            return;
        }
        channel = ch;
        ch.assertQueue(config.AMQP.QUEUE.name, {durable: false});
        log.info("amqp connected successfully");
    });
});


exports.send = function(message){
    return new Promise(function(resolve, reject){
	if(!channel){
	    return reject(AppError.throwAppError(500));
	}

	var buffer = new Buffer(JSON.stringify(message));

	channel.assertQueue(config.AMQP.QUEUE.name, {durable: false}, function(err, ok){
	    if(err){
		log.error(err);
		return reject(AppError.throwAppError(500));
	    }
	    channel.sendToQueue(config.AMQP.QUEUE.name, buffer);
	    resolve();
	});
    });
};
