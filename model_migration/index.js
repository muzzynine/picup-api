/**
 * Created by impyeong-gang on 1/11/16.
 */
var config = require('../config/config').DB.MYSQL;
var Sequelize = require('sequelize');
var Dynamo = require('dynamoose');
var bunyan = require('bunyan');
var logger = require('../lib/logger');
var log = bunyan.getLogger('DatabaseConnectLogger');
var _ = require('lodash');


Dynamo.AWS.config.update({
    accessKeyId: 'AKIAIS2NL7ODIW22FN7A',
    secretAccessKey: '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',
    region : 'ap-northeast-2'
});

var nodeMeta = require('./nodeMeta');
var nodeDelta = require('./nodeDelta');


var connection = new Sequelize(config.DATABASE, config.USERNAME, config.PASSWORD, {
    host: config.HOST,
    port: config.PORT,
    dialect: "mysql",
    pool: {
        max: 5,
        min: 0,
        idle: 100000
    },
    logging: false
});

log.info("index#Database(RDBMS)/(NOSQL) connected");


var models = [
    'delta',
    'group',
    'user',
    'auth',
    'accessToken',
    'client',
    'pushRegistration'
];


_.forEach(models, function(model){
    module.exports[model] = connection.import(__dirname + '/' + model);
});

(function(m){
    m.user.belongsToMany(m.group, {through: 'UserGroup'});
    m.user.hasOne(m.pushRegistration);
    m.user.belongsTo(m.auth);
    m.group.belongsToMany(m.user, {through: 'UserGroup'});
    m.group.hasMany(m.delta, {as : 'Deltas'});
    m.auth.hasOne(m.user);
    m.auth.belongsTo(m.accessToken);
    m.auth.belongsTo(m.client);
    m.accessToken.hasOne(m.auth);
    log.info("index#Database(RDBMS) association set completed");
})(module.exports);

connection.sync();
log.info("index#Database sync now");

module.exports.connection = connection;
