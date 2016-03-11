'use strict';

/**
 * Created by impyeong-gang on 10/14/15.
 */
var _= require('lodash');
var config = require('../config');

/**
 * 델타리스트의 델타들에 포함된 단위 델타정보들을 모두 합쳐 반환한다.(커밋)
 * @param deltaList
 * @returns {Array}
 */
var sumDeltaListForCommit = function(deltaList){
    var result = [];

    for(var i = 0; i < deltaList.length ; i++){
        var delta = deltaList[i].data;
        for(var j = 0; j < delta.length ; j++){
            result.push(delta[j]);
        }
    }
    return result;
};

/**
 * 델타리스트의 델타들에 포함된 단위 델타정보들을 모두 합쳐 반환한다.(업데이트)
 * @param deltaList
 * @returns {Array}
 */
var sumDeltaListForUpdate = function(deltaList){
    var result = [];

    for(var i = 0; i < deltaList.length ; i++){
        var delta = deltaList[i];
        for(var j = 0; j < delta.length ; j++){
            result.push(delta[j]);
        }
    }
    return result;
};


var diffDeltaList = function(peg, oper){
    var result;
    result = _.differenceBy(peg, oper, function(value){
        return value.nid + value.revision;
    });
    return result;
};

var contain = function(arr, value){
    var isExist = false;
    for(var i = 0; i < arr.length; i++){
        if(arr[i] === value){
            isExist = true;
            break;
        }
    }
    return isExist;
};



exports.contain = contain;
exports.sumDeltaListForCommit = sumDeltaListForCommit;
exports.sumDeltaListForUpdate = sumDeltaListForUpdate;
exports.diffDeltaList = diffDeltaList;

