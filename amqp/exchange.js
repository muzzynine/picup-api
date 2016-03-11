'use strict';

/**
 * Created by impyeong-gang on 12/3/15.
 */

var Promise = require('bluebird');
var amqp = require('./amqp');
var AppError = require('../lib/appError');

module.exports = exchange;

function exchange(){}

exchange.sendCommitMessage = function(users, gid){
    return new Promise(function(resolve, reject){
	var type = 'sync';
	var message = { gid : gid };
	var uids = users;

	/*
	 * 푸시를 위한 메시지 포맷은
	 * type (String) : 메시지의 종류 notification, sync
	 * uids (Array) : 보낼 대상의 uid
	 * message (json) : { (Optional - 타입이 sync인 경우 ) gid : 동기화할 그룹 아이디
	 *                    (Optional - 타입이 notification인 경우 ) message : 보낼 메시지
	 */
	var msg = {
            type : type,
            uids : uids,
            message : message
	};

	amqp.send(msg).then(function(){
	    resolve();
	}).catch(function(err){
	    resolve();
	   // reject(err);
	});
    });	
};
