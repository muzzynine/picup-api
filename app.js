
/**
 * Created by impyeong-gang on 12/7/15.
 */

var express = require('express');
var bodyParser = require('body-parser');
var config = require('./config/config');
var passport = require('passport');
var path = require('path');
var cookieParser = require('cookie-parser');
var logging = require('./lib/logger');
var bunyan = require('bunyan');
var log = bunyan.getLogger('MainLogger');
var AppError = require('./lib/appError');
var GCMPusher = require('./amqp/amqp');
var SessionStore = require('./lib/session');
var Promise = require('bluebird');

var app = express();

if(process.env.NODE_ENV == 'development'){
    console.log("Server running Development Mode");
    app.use(require('morgan')('dev'));

    //Sequelize query log printed std out
    Promise.config({
	warnings : false
    }); 
} else if(process.env.NODE_ENV == 'production'){
    console.log("Server running Production Mode");
    process.on('uncaughtException', function(err){
	log.fatal("UncaughtExceptionEmit", {err : err.toString()}, {stack : err.stack});
    });
}

app.set('models', require('./model_migration'));
//session setup
//app.set('session', new SessionStore(config.SESSION));

GCMPusher.init(app.get('models'));
GCMPusher.connect();

app.set('amqp', GCMPusher);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// 304 disable
app.disable('etag');

// parser setup
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));
// session setup

app.use(passport.initialize());

app.get('/health', function(req, res, next(){
    res.status(200);
    res.json({});
    return;
});

var auth = require('./lib/auth');
auth.setPassportStrategy();

var apiRouter = require('./router/router');
app.use('/api', apiRouter);

log.info("Picup API server listening...");
app.listen(8090);










