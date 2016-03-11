'use strict';
/**
 * Created by impyeong-gang on 11/5/15.
 */

var util = require('util');
var statusError = require('./statusError');

function throwAppError(statusCode){
    if(!statusError[statusCode]){
        return new AppError(null, null);
    }
    return new AppError(statusError[statusCode], throwAppError);
}

function createAppError(settings){
    return new AppError(settings, createAppError);
}

function AppError(settings, implementationContext){

    settings = settings || {};

    this.name = settings.name || "PicupAppError";
    this.type = settings.type || "Application";
    this.message = settings.message || "An error occurred.";
    this.detail = settings.detail || "";
    this.errorCode = settings.errorCode || "";

    this.isAppError = true;

    Error.captureStackTrace(this, implementationContext || AppError);
}

util.inherits(AppError, Error);

exports.AppError = AppError;
exports.createAppError = createAppError;
exports.throwAppError = throwAppError;
