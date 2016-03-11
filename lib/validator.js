/**
 * Created by impyeong-gang on 12/17/15.
 */

var AppError = require('./appError');
var _ = require('lodash');

module.exports = validator;

function validator(){}

validator.nullVerify = function(){
    for (var i = 0; i < arguments.length; i++) {
        if(!arguments[i]){
            throw new AppError({
                name : "BadRequest",
                message : "WrongArgument"
            });
        }
    }
};

validator.is = function(type, input){
    switch(type){
        case "String" :
            return _.isString(input);
        case "Number" :
            return _.isNumber(input);
    }
};

validator.verify = function(spec, input){
    var type = spec.type;
    var rule = new RegExp(spec.rule);

    //catch NaN, Undefined, null
    if(input) {
        if (validator.is(type, input)) {
            if (rule.test(input)) return;
        }
    }

    throw new AppError.throwAppError(400);
};

