/**
 * Created by impyeong-gang on 1/11/16.
 */
var Promise = require('bluebird');
var DeltaScheme = require('./scheme').DELTA;
var AppError = require('../lib/appError');
var bunyan = require('bunyan');
var log = bunyan.getLogger('DataModelLogger');

module.exports = function(connection){
    var Delta =  connection.define(DeltaScheme.TABLE, DeltaScheme.SCHEME,
        {
            instanceMethods: {
                countTask: function(){

                }
            }
        });

    Delta.findDeltaById = function(id, fn){
        return new Promise(function(resolve, reject){
            return Delta.findById(id).then(function(delta){
                if(!delta){
                    return reject(AppError.throwAppError(404))
                }
                resolve(delta);
            }).catch(function(err){
                log.error("Delta#findDeltaById/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            });

        })
    };

    Delta.commitApply = function(delta, revision, data, transaction){
        return new Promise(function(resolve, reject) {
            var formatted = JSON.stringify(data);
            return delta.update({
                revision: revision,
                data: formatted
            }, {transaction: transaction}).then(function () {
                resolve();
            }).catch(function (err) {
                log.error("Delta#commitApply/Internal Database(RDBMS) error", {err :err});
                reject(AppError.throwAppError(500));
            });
        });
    };



    return Delta;
};