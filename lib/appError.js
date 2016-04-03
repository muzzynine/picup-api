'use strict';
/**
 * Created by impyeong-gang on 11/5/15.
 */

var util = require('util');
var statusError = require('./statusError');

function throwAppError(statusCode, detail){
    if(!statusError[statusCode]){
        return new AppError(null, null);
    }
    return new AppError(statusError[statusCode], detail, throwAppError);
}

function createAppError(settings){
    return new AppError(settings, createAppError);
}

function AppError(settings, detail, implementationContext){

    settings = settings || {};

    this.name = settings.name || "PicupAppError";
    this.type = settings.type || "Application";
    this.message = settings.message || "An error occurred.";
    this.detail = detail || "no include infomation";
    this.errorCode = settings.errorCode || 500;

    this.isAppError = true;

    Error.captureStackTrace(this, implementationContext || AppError);
}

util.inherits(AppError, Error);

exports.AppError = AppError;
exports.createAppError = createAppError;
exports.throwAppError = throwAppError;
