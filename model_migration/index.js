/**
 * Created by impyeong-gang on 1/11/16.
 */
var config = require('../config/config').DB.MYSQL;
var Sequelize = require('sequelize');
var Dynamo = require('dynamoose');
var bunyan = require('bunyan');
var logger = require('../lib/logger');
var log = bunyan.getLogger('DatabaseConnectLogger');


Dynamo.AWS.config.update({
    accessKeyId: 'AKIAIS2NL7ODIW22FN7A',
    secretAccessKey: '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',
    region : 'ap-northeast-2'
});

var nodeMeta = require('./nodeMeta');
var nodeDelta = require('./nodeDelta');

var connection = new Sequelize(config.DATABASE, config.USERNAME, config.PASSWORD, {
    host : config.HOST,
    port : config.PORT,
    dialect: "mysql",
    pool: {
        max: 5,
        min: 0,
        idle: 100000
    },
    logging: false
});

log.info("index#Database(RDBMS/NOSQL) connected");

var models = [
    'client',
    'delta',
    'accessToken',
    'group',
    'pushRegistration',
    'user',
    'auth',
    'ban'
];

models.forEach(function(model){
    module.exports[model] = connection.import(__dirname + '/' + model);
});

(function(m){
    m.user.belongsToMany(m.group, {through: 'UserGroup'});
    m.user.hasOne(m.pushRegistration, {onDelete: 'CASCADE'});
    m.user.hasOne(m.auth, {onDelete : 'CASCADE'});
    m.group.belongsToMany(m.user, {through: 'UserGroup'});
    m.group.hasMany(m.delta, {as: 'Deltas'});
    m.auth.belongsTo(m.user, {onDelete : 'CASCADE'});
    m.auth.hasOne(m.accessToken, {onDelete : 'CASCADE'});
    m.auth.hasOne(m.client, {onDelete : 'CASCADE'});
    m.auth.hasMany(m.ban, {onDelete : 'CASCADE'});
    m.accessToken.belongsTo(m.auth, {onDelete : 'CASCADE'});
    log.info("index#Database(RDBMS) association set completed");
})(module.exports);


connection.sync();
log.info("index#Database sync now");

module.exports.connection = connection;
