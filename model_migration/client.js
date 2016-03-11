/**
 * Created by impyeong-gang on 1/11/16.
 */
var ClientScheme = require('./scheme').CLIENT;
var AppError = require('../lib/appError');

module.exports = function(connection){
    var Client = connection.define(ClientScheme.TABLE, ClientScheme.SCHEME);

    Client.getAuthInfo = function(clientId, clientSecret, fn){
        Client.findOne({
            where : {
                client_id : clientId,
                client_secret : clientSecret
            }
        }).then(function(client){
            if(!client){
                return fn(AppError.throwAppError(404));
            }
            client.getAuth().then(function(auth){
                if(!client){
                    return fn(AppError.throwAppError(404));
                }
                fn(null, auth);
            }).catch(function(err){
                fn(AppError.throwAppError(500));
            })
        }).catch(function(err){
            fn(AppError.throwAppError(500));
        })
    };

    return Client;
};
